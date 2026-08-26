# Authentification — fonctionnement et configuration

Remplace `SECURITY_ENHANCEMENTS.md`, qui décrivait une implémentation
(raffinement Zod asynchrone) retirée depuis : elle faisait lever `safeParse`
sur tout appel synchrone et n'était appliquée que côté navigateur, donc
contournable par un appel direct à l'API.

---

## 1. Vue d'ensemble

Deux parcours, une seule règle : **aucune session n'est ouverte tant qu'un
second facteur n'a pas été validé** — sauf sur un appareil déjà validé il y a
moins de 30 jours (§3).

### Inscription

```
Formulaire  ──POST /api/auth/register──▶  Turnstile vérifié
                                          Schéma serveur appliqué
                                          Mot de passe testé contre les fuites
                                          Compte créé (email_confirm: false)
                                          Code à 6 chiffres envoyé par email
                                                    │
/verification  ──POST /api/auth/verify──▶  Code vérifié (haché, expirant)
                                          Email confirmé
                                          Session ouverte  ──▶  tableau de bord
```

### Connexion

```
Formulaire  ──POST /api/auth/login──▶  Turnstile vérifié
                                       Verrouillage progressif consulté
                                       Mot de passe validé (client éphémère,
                                         sans cookie ni persistance)
                                                 │
                          ┌──────────────────────┴──────────────────────┐
                          │                                             │
             Appareil de confiance                          Appareil inconnu
             (validé < 30 jours)                            ou > 30 jours
                          │                                             │
             Session ouverte directement          Cookie de défi signé (10 min)
                          │                       Code envoyé par email
                          │                         — ou attendu de l'app TOTP
                          │                                             │
                          │              /verification ──POST /api/auth/verify──▶
                          │                       Second facteur vérifié
                          │                       Appareil mémorisé 30 jours
                          │                                             │
                          └──────────────▶  tableau de bord  ◀──────────┘
```

### Pourquoi ce découpage

L'ancienne 2FA ouvrait la session **avant** de demander le code, puis
redirigeait vers `/connexion/2fa` côté navigateur. Ignorer la redirection et
aller directement sur `/dashboard` suffisait à passer outre : le cookie de
session était déjà posé. La route `/api/2fa/validate` renvoyait `{success:
true}` sans que rien ne s'y rattache.

Désormais, l'état intermédiaire tient dans un cookie `httpOnly` signé en
HMAC-SHA256 (`sp_auth_challenge`) : il atteste « le mot de passe de cet
utilisateur a été validé », sans donner aucun accès. La session n'est créée
qu'après validation du code, par `/api/auth/verify`.

---

## 2. Codes à usage unique

| Propriété | Valeur | Raison |
|---|---|---|
| Longueur | 6 chiffres | recopiable depuis un téléphone |
| Génération | `crypto.randomInt` | CSPRNG, sans biais de modulo |
| Stockage | HMAC-SHA256 poivré (`AUTH_SECRET`) | une fuite de la base ne permet pas de rejouer |
| Liage | `(email, purpose)` | un code d'inscription ne vaut pas à la connexion |
| Durée | 10 minutes | |
| Tentatives | 5, puis le code est brûlé | borne la force brute sur 10⁶ possibilités |
| Rejeu | impossible (`consumed_at`) | |
| Délai anti-renvoi | 45 s par `(email, purpose)` | protège la facture SMTP |
| Comparaison | `timingSafeEqual` | `===` s'arrête au premier écart et laisse fuiter la position de l'erreur |

Table `otp_codes` : RLS activée, **aucune policy**, `REVOKE ALL` pour `anon` et
`authenticated`. Seule la service role y accède.

### Application d'authentification (TOTP)

Un compte qui a activé une application (`/dashboard/profil/2fa`) fournit son
code depuis celle-ci ; aucun email n'est alors envoyé. Deux canaux valides
simultanément affaibliraient le dispositif au lieu de le renforcer.

La graine TOTP n'est plus lisible depuis le navigateur : `GRANT SELECT` au
niveau colonne sur `two_factor_auth` expose `user_id`, `method`, `enabled` et
`updated_at`, jamais `secret`.

---

## 3. Appareils de confiance

Le second facteur n'est pas demandé à chaque connexion mais **une fois par
appareil et par période de 30 jours**. À l'inscription, il l'est toujours :
c'est lui qui prouve la possession de l'adresse email.

| Aspect | Choix |
|---|---|
| Identification | cookie opaque `sp_device`, `httpOnly`, aléatoire sur 32 octets |
| Empreinte stockée | HMAC-SHA256 de `(identifiant d'appareil, identifiant d'utilisateur)`, poivré |
| Durée | 30 jours **fixes**, non prolongés à l'usage |
| Administrateurs | jamais dispensés |
| Consentement | case cochée par défaut, décochable sur poste partagé |
| Révocation | liste et révocation dans « Sécurité », plus « tout révoquer » |
| Panne de base | pas de dispense — on retombe sur le code |

### Pourquoi ce compromis tient

L'OTP continue de se déclencher sur tout appareil inconnu. Or une attaque par
bourrage d'identifiants part par définition d'une machine que l'utilisateur n'a
jamais utilisée, donc dépourvue du cookie : le second facteur reste exactement
là où il sert.

En contrepartie, un utilisateur régulier reçoit un code par mois au lieu d'un
par jour. Sur 200 utilisateurs actifs quotidiens, le volume d'envois passe
d'environ **6 000 à 600 par mois** — la friction baisse et le plafond du
fournisseur d'email cesse d'être un facteur limitant.

### Deux détails qui comptent

**Le liage à l'utilisateur.** L'empreinte mêle l'identifiant d'appareil *et*
celui de l'utilisateur. Sans lui, un ordinateur familial mémorisé par le
premier compte dispenserait le second de tout code — une faille invisible, qui
ne se manifesterait que chez les utilisateurs partageant une machine. Un test
de non-régression couvre ce cas.

**L'expiration est fixe, pas glissante.** Si chaque connexion repoussait
l'échéance, un utilisateur quotidien ne reverrait jamais de code : « tous les
30 jours » perdrait son sens. `last_used_at` sert uniquement à l'affichage.

### Pourquoi un cookie plutôt qu'une empreinte de navigateur

Une empreinte fondée sur l'IP redemanderait un code en permanence : sur réseau
mobile, l'adresse change à chaque déplacement. Une empreinte fondée sur l'agent
utilisateur et les polices installées est à la fois fragile — elle casse à
chaque mise à jour du navigateur — et intrusive. Un cookie opaque *est*
l'appareil, et l'utilisateur peut l'effacer.

---

## 4. Vérification humaine

Cloudflare Turnstile, sur les deux formulaires et sur le renvoi de code
d'inscription. Le paramètre `action` (`signup` / `login`) est vérifié côté
serveur : un jeton obtenu sur l'inscription ne peut pas être rejoué sur la
connexion.

Deux protections complémentaires, sans friction :

- **Champ leurre** (`website`), hors écran et `aria-hidden`. Rempli ⇒ requête
  traitée comme un robot. L'inscription répond alors comme un succès, sans
  rien créer : un robot qui apprend qu'il a été détecté s'adapte.
- **Quotas par IP** : 5 inscriptions / 10 min, 10 connexions / 5 min,
  5 renvois / 15 min.

**Politique de repli** : en production, une indisponibilité de Cloudflare fait
échouer la vérification. Un anti-robot qui s'ouvre dès qu'on le rend
indisponible ne protège rien. En développement, l'indisponibilité laisse
passer, pour ne pas bloquer le travail hors ligne.

### Configuration

1. https://dash.cloudflare.com → **Turnstile** → *Add widget*
2. Mode **Managed**. Domaines : votre domaine de production **et** `localhost`.
3. Reporter les deux clés dans `.env` :

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAAAAA…
TURNSTILE_SECRET_KEY=0x4AAAAAAA…
```

Tant qu'elles sont vides, les **clés de test** de Cloudflare sont utilisées :
le widget s'affiche et valide toujours. C'est voulu pour le développement et
la CI ; **c'est insuffisant en production**.

---

## 5. Mots de passe

| Règle | Valeur |
|---|---|
| Longueur minimale | 12 caractères |
| Complexité | minuscule + majuscule + chiffre + caractère spécial |
| Fuites connues | vérifié via haveibeenpwned (k-anonymity : seuls 5 caractères du SHA-1 sont transmis) |

Ces règles s'appliquent **à l'inscription uniquement**, et sont désormais
appliquées côté serveur (`serverInscriptionSchema` + `checkCompromisedPassword`
dans `/api/auth/register`).

**Elles ne s'appliquent pas à la connexion**, volontairement. Une version
antérieure imposait 12 caractères minimum au formulaire de connexion : tous les
comptes créés sous la politique précédente — 8 à 11 caractères — se
retrouvaient bloqués côté navigateur, sans message expliquant pourquoi. Un test
de non-régression couvre ce cas.

---

## 6. Verrouillage progressif

Chaque tentative alimente `auth_events`. Au-delà de **8 échecs sur la même
adresse email en 15 minutes**, la connexion est refusée pour cette adresse.

Le quota par IP seul ne suffit pas : un attaquant disposant d'un parc de
proxies le contourne trivialement, alors que sa cible — un compte précis —
reste la même.

Si le journal est indisponible, on **ne verrouille pas** : le quota par IP et
Turnstile restent en place, et une panne de journalisation ne doit pas bloquer
l'ensemble des utilisateurs.

---

## 7. Variables d'environnement requises

```
AUTH_SECRET=                       # openssl rand -base64 48 — 32 car. minimum
NEXT_PUBLIC_SITE_URL=              # URL canonique
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
BREVO_API_KEY=                     # prioritaire ; API HTTP, sans contrainte d'IP
RESEND_API_KEY=                    # sinon
SMTP_USER=  SMTP_PASS=             # sinon : relais SMTP
SMTP_HOST=  SMTP_PORT=             # ex. smtp-relay.brevo.com:587
MAIL_FROM=                         # OBLIGATOIRE hors Gmail — voir §11
UPSTASH_REDIS_REST_URL=            # recommandé : sans lui le quota ne tient
UPSTASH_REDIS_REST_TOKEN=          #   pas entre instances serverless
```

`AUTH_SECRET` est **obligatoire en production** : le code refuse de démarrer
sans lui plutôt que de retomber sur une valeur par défaut, qui rendrait
forgeables tous les jetons qu'il protège. Le changer invalide les codes et les
défis en cours — les utilisateurs concernés recommencent leur connexion.

---

## 8. Migration à appliquer

```bash
npm run db:migrate      # ou : coller supabase/migrations/010_auth_hardening.sql
                        #      dans l'éditeur SQL Supabase
```

La migration 010 crée `otp_codes`, `auth_events`, `trusted_devices` et la
fonction de purge, et referme trois policies RLS ouvertes à tous.

Elle est **idempotente et sans prérequis** : tout y est en
`CREATE … IF NOT EXISTS` ou `DROP … IF EXISTS`, et sa section 3 recrée au
besoin les tables héritées qu'elle durcit (`audit_logs`, `email_confirmations`,
`two_factor_auth`). Elle s'applique donc aussi bien sur une base à jour que sur
une base où les migrations précédentes n'ont pas été passées intégralement, et
peut être rejouée sans risque.

> Attention au piège : `DROP POLICY IF EXISTS … ON t` et `REVOKE … ON TABLE t`
> échouent tous deux si `t` n'existe pas — le `IF EXISTS` porte sur la policy,
> pas sur la table. C'est ce qui produisait l'erreur
> `42P01: relation "audit_logs" does not exist`.

**Le déploiement du code sans cette migration casse la connexion** : les routes
écrivent dans `otp_codes`, qui n'existerait pas.

### Vérifier l'état réel de la base

Une erreur `relation … does not exist` sur la 010 signale que les migrations
antérieures n'ont pas toutes été appliquées. Pour faire le point :

```sql
SELECT expected.name,
       to_regclass('public.' || expected.name) IS NOT NULL AS presente
FROM (VALUES
  ('profils'), ('profils_secretaires'), ('profils_publics'),
  ('missions'), ('candidatures'), ('offres'), ('messages'), ('avis'),
  ('detailed_ratings'), ('notifications'), ('push_subscriptions'),
  ('kyc_verifications'), ('two_factor_auth'), ('audit_logs'),
  ('email_confirmations'), ('otp_codes'), ('auth_events'), ('trusted_devices')
) AS expected(name)
ORDER BY presente, expected.name;
```

Toute ligne à `false` après la 010 correspond à une migration antérieure à
rejouer (001 à 009, dans l'ordre).

---

## 9. Purge des données

`purge_auth_artifacts()` supprime les codes expirés depuis plus d'un jour et
les évènements de plus de 90 jours. Elle est appelée par `/api/digest`, la
route cron hebdomadaire. Sans elle, `otp_codes` conserve indéfiniment
l'empreinte de tous les codes émis.

---

## 10. Points de vigilance

| Point | Détail |
|---|---|
| Plafond SMTP Gmail | ~500 envois/jour. Avec les appareils de confiance (§3), le seuil recule d'environ un facteur dix. La bascule vers un fournisseur transactionnel reste câblée : `BREVO_API_KEY` ou `RESEND_API_KEY` suffit. |
| Délivrabilité | Voir §11 — c'est le point qui décide du classement en indésirable, et il ne se règle pas en changeant de fournisseur. |
| Taux d'abandon | Surveiller le rapport `login_password_ok` / `login_otp_ok` dans `auth_events` : l'écart mesure exactement la friction du second facteur. `login_trusted_device` donne la part des connexions dispensées. |
| Perte d'un appareil | L'utilisateur doit révoquer depuis « Sécurité ». Sans cette action, la dispense court jusqu'à son terme. |
| Durée de 30 jours | Réglable par `TRUST_DURATION_DAYS` dans `src/lib/trustedDevice.ts`. La raccourcir augmente le volume d'emails d'autant. |

---

## 11. Délivrabilité

Changer de fournisseur ne sort pas des indésirables. Ce qui décide du
classement, c'est **l'alignement DMARC** : l'adresse affichée dans « De : » doit
appartenir à un domaine dont vous contrôlez le DNS, et que le fournisseur signe
en DKIM.

### Le piège

Envoyer via Brevo « de la part de » `contact@gmail.com` :

1. Gmail publie une politique DMARC stricte sur `gmail.com` ;
2. l'email part des serveurs de Brevo, donc SPF et DKIM ne s'alignent pas avec
   `gmail.com` ;
3. le destinataire applique la politique de Gmail : **rejet ou indésirable**.

Le résultat est *pire* qu'un envoi direct depuis Gmail. Il faut donc un domaine
à vous. `secretariatpro-drab.vercel.app` ne convient pas non plus : le domaine
`vercel.app` ne vous appartient pas, aucun enregistrement DNS n'y est ajoutable.

### La marche à suivre

1. Acquérir un domaine (`secretariatpro.ci`, `.com`…).
2. Dans Brevo → **Expéditeurs, domaine, IP** → ajouter le domaine, puis créer
   les enregistrements DNS proposés (SPF et DKIM, sélecteur `mail`).
3. Ajouter une politique DMARC d'observation, sans risque de rejet :
   `_dmarc.votre-domaine  TXT  "v=DMARC1; p=none; rua=mailto:postmaster@votre-domaine"`.
4. Renseigner `MAIL_FROM="SecrétariatPro <no-reply@votre-domaine>"`.
5. Vérifier : `npm run check:email`, puis un envoi réel avec
   `npm run check:email -- --send vous@exemple.com`.
6. Ouvrir le message reçu, afficher la source, et confirmer que l'en-tête
   `Authentication-Results` indique `spf=pass`, `dkim=pass` et `dmarc=pass`.

Passer plus tard `p=none` à `p=quarantine` une fois les rapports propres.

### Brevo par SMTP ou par API ?

Brevo peut restreindre l'usage des clés SMTP à une liste d'adresses IP
autorisées. Les fonctions Vercel sortent par des adresses **dynamiques et non
documentées** : la liste ne peut pas être tenue à jour, et l'envoi cassera sans
prévenir — c'est-à-dire que les connexions cesseront de fonctionner.

Utilisez donc `BREVO_API_KEY` (API HTTP, aucune contrainte d'IP), ou laissez la
liste des IP autorisées vide.

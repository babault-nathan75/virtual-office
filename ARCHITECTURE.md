# Architecture — état des lieux et proposition

Document de travail rédigé après un audit complet du dépôt (25 août 2026).
Il décrit ce que le code fait aujourd'hui, ce qui pose problème, et la cible
proposée. Chaque recommandation est chiffrée en effort et en effet attendu.

---

## 1. Ce qui existe

**Pile** : Next.js 16.2 (App Router, Turbopack) · React 19.2 · TypeScript ·
Tailwind 4 · Supabase (Postgres + Auth + Storage + Realtime) · Vercel ·
Sentry · Upstash Redis (quotas) · Gemini (rapprochement) · nodemailer (SMTP).

**Domaine** : place de marché à deux versants — des *entreprises* publient des
missions, des *secrétaires* candidatent. Un troisième rôle, *admin*, valide les
dossiers d'identité (KYC) et administre.

**Tables** : `profils`, `profils_secretaires`, `profils_publics`, `missions`,
`candidatures`, `offres`, `messages`, `avis`, `detailed_ratings`,
`notifications`, `push_subscriptions`, `kyc_verifications`, `two_factor_auth`,
`audit_logs`, `email_confirmations`, plus `otp_codes`, `auth_events` et
`trusted_devices` ajoutées par la migration 010.

**Découpage actuel**

```
src/
├── app/            routes (pages + API)
├── components/     composants partagés
├── lib/
│   ├── data/       accès aux données, dédoublé serveur/client
│   │   ├── admin.ts        admin-client.ts
│   │   ├── entreprise.ts   entreprise-client.ts
│   │   └── secretaire.ts   secretaire-client.ts
│   └── …           utilitaires transverses
└── hooks/
```

---

## 2. Ce qui ne va pas

### 2.1 La logique métier vit dans les composants

`ChatWindow.tsx` faisait **4 045 lignes** : rendu, état local, appels Supabase,
abonnements Realtime, encodage audio, téléversement de pièces jointes,
recherche, réactions, épinglage, mentions — dans un seul fichier.

Première passe faite : types, constantes, fonctions pures, pictogrammes et
composants de présentation sont extraits dans `src/components/chat/`. Le
fichier tombe à **3 187 lignes**, et les 42 premiers tests de la messagerie
existent — dont ceux de `safeHttpUrl`, qui décide quelles URL sont ouvrables
depuis une conversation et constitue donc une frontière de sécurité.

Reste le corps du composant : ~3 200 lignes d'état et d'effets entrelacés. Le
découper suppose de déplacer des `useEffect` et des abonnements temps réel,
c'est-à-dire de changer des comportements observables. Ce travail exige
d'exercer réellement la messagerie dans un navigateur (envoi, réception,
enregistrement vocal, pièces jointes, reconnexion) — il n'est pas vérifiable
par la compilation et les tests unitaires seuls.

### 2.2 L'accès aux données est dédoublé par erreur

`lib/data/secretaire.ts` et `lib/data/secretaire-client.ts` contiennent des
requêtes voisines mais divergentes (idem pour `admin` et `entreprise`). Une
correction appliquée d'un côté ne l'est pas de l'autre — c'est exactement ce
qui a produit les incohérences de rôle corrigées dans les commits précédents.

### 2.3 Les règles de sécurité étaient réparties sur trois couches

Avant cette intervention : contrôle de rôle dans le proxy, *et* dans chaque
route API, *et* dans les policies RLS — avec des verdicts divergents. Trois
policies RLS étaient en `USING (true)` sans clause `TO`, dont une exposant les
jetons de confirmation d'email au rôle `anon`.

### 2.4 Deux mécanismes de vérification d'email cohabitaient

`email_confirmations` + `/api/send-confirmation` + `/confirmer-email` d'un côté,
la confirmation Supabase de l'autre. Aucun des deux n'était appelé par le
parcours d'inscription réel. Code mort, mais code mort **exposé**.

### 2.5 Aucun modèle économique n'est implémenté

Ni `abonnements`, ni `paiements`, ni `commissions`, ni `factures`. La FAQ
affichée sur le site annonce « inscription gratuite, tarifs fixés par chaque
secrétaire » : la plateforme met en relation, mais ne capte aucune valeur sur
la transaction qu'elle a permise.

---

## 3. Architecture cible

### 3.1 Découpage par domaine métier

Le découpage actuel est *technique* (`components/`, `lib/`, `hooks/`). Il ne
dit rien de ce que fait le produit, et oblige à ouvrir cinq dossiers pour
suivre une fonctionnalité. La cible regroupe par domaine :

```
src/
├── app/                     routes — fines, elles ne font qu'assembler
├── domains/
│   ├── auth/                inscription, connexion, OTP, anti-robot
│   │   ├── api/             logique appelée par les routes
│   │   ├── components/
│   │   └── schemas.ts
│   ├── kyc/
│   ├── missions/            missions, candidatures, offres
│   ├── messagerie/          ← découpe ChatWindow
│   │   ├── components/      MessageList, Composer, VoiceRecorder, …
│   │   ├── hooks/           useConversation, useRealtimeMessages
│   │   └── api/
│   ├── profils/
│   └── facturation/         ← nouveau (§4)
├── shared/
│   ├── ui/                  Button, Input, Modal, Toast…
│   ├── lib/                 env, mailer, rateLimit, sanitize…
│   └── hooks/
└── db/
    ├── client.ts            navigateur
    ├── server.ts            composants serveur
    ├── admin.ts             service role
    └── types.ts             types générés par `supabase gen types`
```

**Règle unique d'accès aux données** : une requête vit dans
`domains/<x>/api/`, et nulle part ailleurs. Les composants reçoivent des
données, ils n'en cherchent pas. Cela supprime mécaniquement le doublon
serveur/client de §2.2.

### 3.2 Une seule source de vérité par règle de sécurité

| Règle | Où elle est appliquée | Rôle des autres couches |
|---|---|---|
| Qui peut lire/écrire une ligne | **RLS Postgres** | rien à dupliquer |
| Qui peut atteindre une page | **`proxy.ts`** | redirection uniquement |
| Ce qu'une requête a le droit de contenir | **schéma Zod serveur** | le client valide pour le confort, jamais pour la sécurité |
| Combien de fois | **`rateLimit` + `auth_events`** | — |

Le principe : le proxy oriente, la RLS décide. Un contrôle de rôle dans une
route API est un signe que la policy correspondante manque.

### 3.3 Types générés depuis la base

`supabase gen types typescript --linked > src/db/types.ts`, exécuté en CI.
Aujourd'hui, `supabase.from('profils').select('role')` renvoie `any` : une
colonne renommée ne casse rien à la compilation, seulement en production.

### 3.4 Typage strict

`tsconfig.json` : activer `noUncheckedIndexedAccess` et
`exactOptionalPropertyTypes`. Le code manipule beaucoup de résultats
`maybeSingle()` potentiellement nuls ; le compilateur peut le vérifier.

---

## 4. Rentabilité

La plateforme crée de la valeur (rapprochement, confiance via KYC, messagerie,
contrats) sans en capter. Trois leviers, du plus simple au plus structurant.

### Levier A — Abonnement entreprise (à implémenter en premier)

Le versant qui paie sur une place de marché est celui qui a un budget et une
urgence : l'entreprise qui cherche à recruter.

| Palier | Prix indicatif | Contenu |
|---|---|---|
| Découverte | 0 | 1 mission active, 3 mises en relation/mois, fiches floutées au-delà |
| Pro | ~25 000 F CFA / mois | missions illimitées, coordonnées visibles, rapprochement IA, contrats générés |
| Entreprise | sur devis | multi-utilisateurs, marque blanche, export, API |

*Pourquoi ce levier d'abord* : revenu récurrent et prévisible, aucune
manipulation de fonds (pas d'agrément de paiement requis), et le seul verrou
technique nécessaire — masquer les coordonnées sous le palier gratuit — est
déjà à moitié en place via `profils_publics`.

**Effort** : ~2 semaines. Tables `abonnements` + `evenements_facturation`,
webhook du prestataire de paiement, garde `requirePlan()` côté serveur.

### Levier B — Commission sur mission

5 à 10 % du montant, prélevés à la validation de la mission. S'aligne sur la
valeur réellement créée, mais suppose que le paiement transite par la
plateforme — donc séquestre, litiges, et conformité. **À faire après A**, une
fois le volume connu.

### Levier C — Services à l'unité

Vérification d'identité renforcée, mise en avant d'un profil, contrat signé
électroniquement, export comptable. Marge élevée, développement incrémental,
utile pour tester l'élasticité au prix sans toucher au cœur.

### Réduction du coût de service

- **Upstash Redis** : sans lui, le quota en mémoire repart de zéro à chaque
  instance serverless — la limite ne tient pas. Le plan gratuit suffit
  longtemps et protège la facture SMTP et Gemini.
- **Rapprochement Gemini** : mettre le résultat en cache par couple
  (mission, secrétaire). Les profils changent rarement, les appels se
  répètent à chaque affichage.
- **SMTP Gmail** : plafonné à ~500 envois/jour. Avec un code OTP à chaque
  connexion, ce plafond se touche vers 150–200 utilisateurs actifs
  quotidiens. Prévoir la bascule vers un service transactionnel
  (Resend / Postmark / SES) **avant** d'atteindre ce seuil : `lib/mailer.ts`
  est déjà le point de bascule unique.

---

## 5. Feuille de route

### Fait dans cette intervention

- Authentification entièrement côté serveur : inscription et connexion passent
  par `/api/auth/*`, la politique de mot de passe et l'anti-robot ne sont plus
  contournables depuis le navigateur.
- Vérification humaine (Cloudflare Turnstile) + leurre + quotas sur les deux
  formulaires.
- Code à usage unique par email à l'inscription **et** à chaque connexion,
  haché, expirant, à usage unique, avec compteur de tentatives.
- Contournement de la 2FA supprimé : plus aucune session n'est ouverte avant
  la validation du second facteur.
- Trois policies RLS ouvertes à tous refermées ; secrets TOTP rendus illisibles
  depuis le navigateur.
- CSP, CSRF « fail-closed », verrouillage progressif par adresse email,
  journal `auth_events`.
- SEO : URL canonique dynamique, sitemap et robots corrigés, métadonnées
  enrichies.
- Suppression du parcours de confirmation d'email mort et des doublons de
  clients Supabase / transports SMTP.
- CSP à nonce sur les écrans d'authentification et le tableau de bord ; ces
  pages basculent en rendu dynamique, l'accueil reste pré-rendu.
- Locale et pays unifiés sur la Côte d'Ivoire (`src/lib/i18n.ts`), là où vingt
  appels écrivaient `fr-FR` et schema.org déclarait la France.
- Fournisseur d'email interchangeable : renseigner `RESEND_API_KEY` suffit à
  quitter le SMTP Gmail, sans toucher au code.
- Première passe de découpage de `ChatWindow.tsx` : 4 045 → 3 187 lignes,
  42 tests ajoutés.

### Court terme (2–4 semaines)

1. Terminer le découpage de `ChatWindow.tsx` (§2.1) — le corps du composant
   reste à traiter, en exerçant la messagerie dans un navigateur.
2. Générer les types Supabase et activer le typage strict (§3.3, §3.4).
3. Fusionner les paires `*-client.ts` / `*.ts` de `lib/data` (§2.2).
4. Implémenter le levier A (§4).

### Moyen terme (1–3 mois)

5. Migration progressive vers le découpage par domaine (§3.1), domaine par
   domaine, en commençant par `auth/` qui est déjà cohérent.
6. Tests end-to-end Playwright du parcours complet inscription → OTP →
   connexion → OTP → tableau de bord.
7. Étendre le CSP à nonce aux pages publiques si l'on accepte de perdre leur
   pré-rendu — à ne faire que si les mesures de trafic le justifient.

### Long terme

9. Levier B une fois le volume de missions établi.
10. Appareils de confiance : la table `trusted_devices` est déjà en place pour
    passer d'un OTP systématique à un OTP adaptatif (nouvel appareil ou
    nouvelle IP seulement), si la friction se révèle coûteuse en rétention.

---

## 6. Décisions et compromis assumés

**OTP à chaque connexion.** Choix produit explicite. C'est le réglage le plus
sûr et le plus coûteux en friction. Deux conséquences à surveiller : le plafond
d'envoi SMTP (§4) et le taux d'abandon à la seconde étape. `trusted_devices`
permet de revenir en arrière sans migration.

**CSP à nonce, mais pas partout.** La variante stricte impose un rendu
dynamique. Elle est appliquée aux écrans d'authentification et au tableau de
bord — les cibles d'une injection de script, et des pages qui lisent de toute
façon cookies et données personnelles. L'accueil et les pages légales restent
pré-rendus sous une politique sans nonce : elles n'affichent aucune donnée
utilisateur, et la vitrine ne doit pas payer une seconde d'affichage pour un
gain nul. Le partage des routes vit dans `src/lib/csp.ts`.

Conséquence à connaître : toute page servie sous nonce **doit** être en rendu
dynamique. Une page pré-rendue porterait un HTML figé sans nonce, et le
navigateur bloquerait tous ses scripts — page blanche. D'où les
`export const dynamic = 'force-dynamic'` dans les layouts concernés.

**Pays et locale : Côte d'Ivoire.** Le produit désigne la Côte d'Ivoire par
tous ses signaux internes ; schema.org déclarait la France et vingt appels
formataient en `fr-FR`. Tranché en faveur de `fr-CI` / `CI`, centralisé dans
`src/lib/i18n.ts`. Changer de marché se fait désormais dans un seul fichier.

**`checkCompromisedPassword` en « fail-open ».** Si haveibeenpwned est
injoignable, l'inscription passe. Bloquer toutes les créations de compte parce
qu'un service tiers est en panne coûte plus cher que de laisser passer
temporairement un mot de passe faible — qui reste soumis aux exigences de
longueur et de complexité.

**Turnstile en « fail-closed » en production.** À l'inverse : un anti-robot qui
s'ouvre en grand dès qu'on le rend indisponible ne protège rien, et rendre un
service tiers indisponible est précisément à la portée de l'attaquant qu'il
vise.

# SecrétariatPro

Plateforme de mise en relation entre entreprises et secrétaires qualifiées.

## Stack technique

- **Frontend** : Next.js 16, React 19, Tailwind CSS v4, TypeScript
- **Backend** : Supabase (PostgreSQL, Auth, Storage, Realtime)
- **IA** : Google Gemini (gemini-2.0-flash)
- **Email** : Nodemailer (Gmail SMTP)
- **Déploiement** : Vercel

## Fonctionnalités

### Utilisateurs
- Inscription/connexion (email + Google Auth)
- Profil complet avec photo
- Vérification d'identité (KYC)
- Authentification à deux facteurs (2FA)
- Messagerie temps réel avec l'administration
- Notifications push

### Admin
- Tableau de bord avec statistiques
- Gestion desKYC
- Messagerie avec tous les utilisateurs
- Matching IA entreprise-secrétaire

### Sécurité
- Rate limiting (Upstash Redis)
- CSP headers, XSS protection
- Audit logs
- Session timeout 30min
- Input sanitization

### UX/UI
- Dark mode
- Command palette (Cmd+K)
- Keyboard shortcuts
- Skeletons de chargement
- Messages optimistic
- Swipe actions (mobile)
- Bottom navigation (mobile)
- Offline support (PWA)

## Installation

```bash
npm install
cp .env.example .env  # Configurer les variables
npm run dev
```

## Variables d'environnement

Voir `.env.example` pour la liste complète.

## Tests

```bash
npm run test
npm run test:watch
```

## Scripts

- `npm run dev` — Serveur de développement
- `npm run build` — Build de production
- `npm run start` — Démarrer le build
- `npm run lint` — Linter le code
- `npm run test` — Lancer les tests

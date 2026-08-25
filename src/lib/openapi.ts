export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'SecrétariatPro API',
    description: 'API de la plateforme de mise en relation entre entreprises et secrétaires',
    version: '1.0.0',
  },
  servers: [
    { url: 'https://secretariatpro-drab.vercel.app', description: 'Production' },
    { url: 'http://localhost:3000', description: 'Development' },
  ],
  paths: {
    '/api/ensure-profile': {
      post: {
        tags: ['Auth'],
        summary: 'Créer ou récupérer un profil utilisateur',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'role'],
                properties: {
                  userId: { type: 'string', format: 'uuid' },
                  nom: { type: 'string', maxLength: 200 },
                  role: { type: 'string', enum: ['entreprise', 'secretaire', 'admin'] },
                  email: { type: 'string', format: 'email' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Profil créé ou existant' },
          '401': { description: 'Non autorisé' },
          '429': { description: 'Trop de requêtes' },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Créer un compte et envoyer le code de vérification',
        description:
          "Vérifie le jeton Turnstile, applique la politique de mot de passe côté serveur, crée le compte (email non confirmé) puis envoie un code à 6 chiffres. Aucune session n'est ouverte.",
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nom', 'email', 'telephone', 'password', 'role', 'turnstileToken'],
                properties: {
                  nom: { type: 'string', minLength: 2, maxLength: 200 },
                  email: { type: 'string', format: 'email' },
                  telephone: { type: 'string' },
                  password: { type: 'string', minLength: 12 },
                  role: { type: 'string', enum: ['entreprise', 'secretaire'] },
                  turnstileToken: { type: 'string' },
                  website: { type: 'string', description: 'Champ leurre : doit rester vide.' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Compte créé, code envoyé' },
          '400': { description: 'Données invalides ou anti-robot refusé' },
          '409': { description: 'Adresse email déjà utilisée' },
          '429': { description: 'Trop de tentatives' },
          '502': { description: "Envoi de l'email impossible" },
          '503': { description: 'SMTP non configuré' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Valider le mot de passe et déclencher le second facteur',
        description:
          "Aucune session n'est ouverte ici : un cookie de défi signé est posé et un code est envoyé par email (ou attendu de l'application TOTP).",
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'turnstileToken'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                  turnstileToken: { type: 'string' },
                  website: { type: 'string', description: 'Champ leurre : doit rester vide.' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Second facteur requis' },
          '401': { description: 'Identifiants incorrects' },
          '403': { description: 'Adresse email non vérifiée' },
          '429': { description: 'Trop de tentatives ou compte verrouillé' },
        },
      },
    },
    '/api/auth/verify': {
      post: {
        tags: ['Auth'],
        summary: 'Valider le second facteur et ouvrir la session',
        description:
          "Seul point de l'application qui crée une session par mot de passe. Pour « login », l'adresse provient du cookie de défi signé, jamais du corps de la requête.",
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'purpose'],
                properties: {
                  code: { type: 'string', pattern: '^[0-9]{6}$' },
                  purpose: { type: 'string', enum: ['signup', 'login'] },
                  email: {
                    type: 'string',
                    format: 'email',
                    description: 'Requis pour « signup » uniquement.',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Session ouverte' },
          '400': { description: 'Code incorrect, expiré ou épuisé' },
          '401': { description: 'Défi de connexion expiré' },
          '429': { description: 'Trop de tentatives' },
        },
      },
    },
    '/api/auth/resend': {
      post: {
        tags: ['Auth'],
        summary: 'Renvoyer un code à usage unique',
        description:
          "La réponse ne distingue jamais une adresse inconnue d'un renvoi effectif, pour ne pas permettre l'énumération des comptes.",
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['purpose'],
                properties: {
                  purpose: { type: 'string', enum: ['signup', 'login'] },
                  email: { type: 'string', format: 'email' },
                  turnstileToken: { type: 'string', description: 'Requis pour « signup ».' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Code renvoyé' },
          '429': { description: 'Délai anti-renvoi ou quota atteint' },
        },
      },
    },
    '/api/2fa/setup': {
      post: {
        tags: ['2FA'],
        summary: "Démarrer l'enrôlement d'une application d'authentification",
        description:
          "L'identité provient de la session : aucun identifiant n'est accepté dans le corps de la requête.",
        security: [{ cookieAuth: [] }],
        responses: {
          '200': { description: 'QR code et clé de secours' },
          '401': { description: 'Non autorisé' },
          '409': { description: 'Déjà activé' },
          '429': { description: 'Trop de requêtes' },
        },
      },
    },
    '/api/2fa/verify': {
      post: {
        tags: ['2FA'],
        summary: "Confirmer l'enrôlement de l'application d'authentification",
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code'],
                properties: { code: { type: 'string', pattern: '^[0-9]{6}$' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Second facteur activé' },
          '400': { description: 'Code incorrect' },
          '401': { description: 'Non autorisé' },
          '409': { description: 'Déjà activé' },
        },
      },
    },
    '/api/match-secretaire-entreprise': {
      post: {
        tags: ['AI'],
        summary: 'Analyser la correspondance secrétaire-entreprise',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['secretaire', 'filters'],
                properties: {
                  secretaire: { $ref: '#/components/schemas/Secretaire' },
                  filters: { $ref: '#/components/schemas/Filters' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Score et analyse IA' },
          '401': { description: 'Non autorisé' },
          '429': { description: 'Trop de requêtes' },
        },
      },
    },
    '/api/contracts/generate': {
      post: {
        tags: ['Contracts'],
        summary: 'Générer un contrat HTML',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['entrepriseNom', 'secretaireNom', 'missionTitre', 'missionDescription', 'dateDebut', 'dateFin', 'tarif'],
                properties: {
                  entrepriseNom: { type: 'string' },
                  secretaireNom: { type: 'string' },
                  missionTitre: { type: 'string' },
                  missionDescription: { type: 'string' },
                  dateDebut: { type: 'string' },
                  dateFin: { type: 'string' },
                  tarif: { type: 'string' },
                  conditions: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'HTML du contrat' },
          '401': { description: 'Non autorisé' },
        },
      },
    },
    '/api/messages/search': {
      get: {
        tags: ['Messages'],
        summary: 'Rechercher des messages',
        security: [{ cookieAuth: [] }],
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'with', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Messages trouvés' },
          '401': { description: 'Non autorisé' },
        },
      },
    },
    '/api/audit': {
      get: {
        tags: ['Admin'],
        summary: 'Récupérer les logs d\'audit',
        security: [{ cookieAuth: [] }],
        responses: {
          '200': { description: 'Logs d\'audit' },
          '401': { description: 'Non autorisé' },
          '403': { description: 'Accès réservé aux admins' },
        },
      },
    },
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check',
        responses: {
          '200': { description: 'OK' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'sb-access-token',
      },
    },
    schemas: {
      Secretaire: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          nom: { type: 'string' },
          bio: { type: 'string', nullable: true },
          ville: { type: 'string', nullable: true },
          specialite: { type: 'string', nullable: true },
          langues: { type: 'array', items: { type: 'string' } },
          outils: { type: 'array', items: { type: 'string' } },
          competences: { type: 'array', items: { type: 'string' } },
          annees_experience: { type: 'number', nullable: true },
        },
      },
      Filters: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          outils: { type: 'array', items: { type: 'string' } },
          langues: { type: 'array', items: { type: 'string' } },
          disponibilite: { type: 'string' },
          niveauEtudes: { type: 'string' },
          specialite: { type: 'string' },
          ville: { type: 'string' },
          experienceMin: { type: 'number' },
        },
      },
    },
  },
};

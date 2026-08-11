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
    '/api/2fa/setup': {
      post: {
        tags: ['2FA'],
        summary: 'Configurer la 2FA (QR code ou code email)',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'method'],
                properties: {
                  userId: { type: 'string', format: 'uuid' },
                  method: { type: 'string', enum: ['totp', 'email'] },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'QR code ou confirmation d\'envoi' },
          '401': { description: 'Non autorisé' },
          '429': { description: 'Trop de requêtes' },
        },
      },
    },
    '/api/2fa/verify': {
      post: {
        tags: ['2FA'],
        summary: 'Vérifier le code 2FA et activer la 2FA',
        security: [{ cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'code'],
                properties: {
                  userId: { type: 'string', format: 'uuid' },
                  code: { type: 'string', length: 6 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: '2FA activée' },
          '400': { description: 'Code invalide' },
          '401': { description: 'Non autorisé' },
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

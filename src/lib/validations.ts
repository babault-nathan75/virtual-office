import { z } from 'zod';

/**
 * Schémas de validation partagés client / serveur.
 *
 * Ce module doit rester **synchrone** : il est importé par des composants
 * client et par `validateBody()`, qui appelle `safeParse`. Un raffinement
 * asynchrone (comme la vérification des mots de passe compromis) y ferait
 * lever `safeParse` avec « Encountered Promise during synchronous parse ».
 * Cette vérification vit donc dans `@/lib/passwordCheck` et s'applique côté
 * serveur, dans /api/auth/register.
 */

/** Longueur minimale d'un mot de passe pour un compte créé aujourd'hui. */
export const PASSWORD_MIN_LENGTH = 12;

export const strongPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`)
  .max(200, 'Le mot de passe ne peut pas dépasser 200 caractères.')
  .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule.')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule.')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.')
  .regex(/[^a-zA-Z0-9]/, 'Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*...).');

/**
 * Téléphone international tolérant.
 *
 * `min(8)` acceptait « abcdefgh ». On exige désormais un format plausible
 * (chiffres, espaces, points, tirets, parenthèses, préfixe +) tout en restant
 * ouvert aux formats locaux ivoiriens comme aux numéros internationaux.
 */
export const telephoneSchema = z
  .string()
  .trim()
  .min(8, 'Numéro de téléphone trop court.')
  .max(20, 'Numéro de téléphone trop long.')
  .regex(/^\+?[\d(][\d\s.\-()]{6,}$/, 'Numéro de téléphone invalide.')
  // La forme seule ne suffit pas : « ((((((( » satisfait le motif. On exige
  // aussi un nombre de chiffres plausible pour un numéro composable.
  .refine(value => (value.match(/\d/g) ?? []).length >= 8, 'Numéro de téléphone invalide.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Adresse email invalide.')
  .max(254, 'Adresse email trop longue.');

const inscriptionShape = {
  nom: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères.').max(200),
  email: emailSchema,
  telephone: telephoneSchema,
  password: strongPassword,
  role: z.enum(['entreprise', 'secretaire']),
};

/** Schéma du formulaire d'inscription (inclut la confirmation du mot de passe). */
export const inscriptionSchema = z
  .object({
    ...inscriptionShape,
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas.',
    path: ['confirmPassword'],
  });

export type InscriptionFormData = z.infer<typeof inscriptionSchema>;

/**
 * Schéma appliqué côté serveur.
 *
 * Identique au formulaire mais sans `confirmPassword`, qui n'a de sens que
 * dans l'interface. Surtout : c'est **lui** qui fait autorité. Tant que la
 * politique n'était appliquée que dans le navigateur, un appel direct à
 * l'API suffisait à créer un compte avec « 1234 ».
 */
export const serverInscriptionSchema = z.object(inscriptionShape);

export type ServerInscriptionData = z.infer<typeof serverInscriptionSchema>;

/**
 * Schéma de connexion.
 *
 * Aucune contrainte de complexité ici, volontairement : la politique de mot de
 * passe appartient à l'inscription. L'appliquer à la connexion empêche les
 * comptes créés sous une politique antérieure — 8 à 11 caractères — de se
 * connecter, sans rien apporter en sécurité.
 */
export const connexionSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Veuillez saisir votre mot de passe.').max(200),
});

export type ConnexionFormData = z.infer<typeof connexionSchema>;

export const OTP_CODE_LENGTH = 6;

export const otpSchema = z.object({
  code: z
    .string()
    .regex(new RegExp(`^\\d{${OTP_CODE_LENGTH}}$`), `Le code doit contenir ${OTP_CODE_LENGTH} chiffres.`),
});

export type OtpFormData = z.infer<typeof otpSchema>;

export const kycSchema = z.object({
  prenom: z.string().trim().min(1, 'Prénom requis.').max(100),
  nom: z.string().trim().min(1, 'Nom requis.').max(100),
  date_naissance: z.string().min(1, 'Date de naissance requise.'),
  nationalite: z.string().max(100).optional(),
  nom_entreprise: z.string().max(200).optional(),
});

export type KycFormData = z.infer<typeof kycSchema>;

export const profilSecretaireSchema = z.object({
  bio: z.string().max(500, 'Bio trop longue (max 500 caractères).').optional(),
  ville: z.string().max(100).optional(),
  disponibilite: z.string().max(50).optional(),
  niveau_etudes: z.string().max(50).optional(),
  competences: z.string().max(500).optional(),
  experience: z.string().max(500).optional(),
});

export type ProfilSecretaireFormData = z.infer<typeof profilSecretaireSchema>;

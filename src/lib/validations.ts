import { z } from 'zod';

const strongPassword = z.string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères.')
  .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule.')
  .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule.')
  .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre.')
  .regex(/[^a-zA-Z0-9]/, 'Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*...).');

export const inscriptionSchema = z.object({
  nom: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.').max(200),
  email: z.string().email('Adresse email invalide.').max(254),
  telephone: z.string().min(8, 'Numéro de téléphone invalide.').max(20),
  password: strongPassword,
  confirmPassword: z.string(),
  role: z.enum(['entreprise', 'secretaire']),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas.',
  path: ['confirmPassword'],
});

export type InscriptionFormData = z.infer<typeof inscriptionSchema>;

export const connexionSchema = z.object({
  email: z.string().email('Adresse email invalide.').max(254),
  password: z.string().min(1, 'Mot de passe requis.'),
});

export type ConnexionFormData = z.infer<typeof connexionSchema>;

export const kycSchema = z.object({
  prenom: z.string().min(1, 'Prénom requis.').max(100),
  nom_naissance: z.string().min(1, 'Nom de naissance requis.').max(100),
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

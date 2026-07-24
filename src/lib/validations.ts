import { z } from 'zod';

export const inscriptionSchema = z.object({
  nom: z.string().min(2, 'Le nom doit contenir au moins 2 caractères.'),
  email: z.string().email('Adresse email invalide.'),
  telephone: z.string().min(8, 'Numéro de téléphone invalide.'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères.'),
  confirmPassword: z.string(),
  role: z.enum(['entreprise', 'secretaire']),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas.',
  path: ['confirmPassword'],
});

export type InscriptionFormData = z.infer<typeof inscriptionSchema>;

export const connexionSchema = z.object({
  email: z.string().email('Adresse email invalide.'),
  password: z.string().min(1, 'Mot de passe requis.'),
});

export type ConnexionFormData = z.infer<typeof connexionSchema>;

export const kycSchema = z.object({
  prenom: z.string().min(1, 'Prénom requis.'),
  nom_naissance: z.string().min(1, 'Nom de naissance requis.'),
  date_naissance: z.string().min(1, 'Date de naissance requise.'),
  nationalite: z.string().optional(),
  nom_entreprise: z.string().optional(),
});

export type KycFormData = z.infer<typeof kycSchema>;

export const profilSecretaireSchema = z.object({
  bio: z.string().max(500, 'Bio trop longue (max 500 caractères).').optional(),
  ville: z.string().optional(),
  disponibilite: z.string().optional(),
  niveau_etudes: z.string().optional(),
  competences: z.string().optional(),
  experience: z.string().optional(),
});

export type ProfilSecretaireFormData = z.infer<typeof profilSecretaireSchema>;

export type SecretaireProfil = {
  id: string;
  nom: string;
  photo_url?: string | null;
  bio?: string | null;
  ville?: string | null;
  disponibilite?: string | null;
  niveau_etudes?: string | null;
  langues?: string[] | null;
  outils?: string[] | null;
  soft_skills?: string[] | null;
  competences?: string[] | null;
  annees_experience?: number | null;
};

export type Mission = {
  id: number;
  titre: string;
  description: string;
  date_debut?: string | null;
  date_fin?: string | null;
  created_at: string;
  statut?: string;
  entreprise_id?: string;
  profils?: { nom: string } | null;
};

export type Candidature = {
  id: number;
  mission_id: number;
  secretaire_id?: string;
  statut: string;
  profils?: { id: string; nom: string } | { id: string; nom: string }[] | null;
  missions?: { titre: string } | null;
};

export type Offre = {
  id: number;
  statut: string;
  message?: string | null;
  created_at: string;
  entreprise_id: string;
  secretaire_id: string;
  mission_id?: number | null;
  candidature_id?: number | null;
  missions?: { titre: string } | null;
};

export type ContactProfil = {
  id: string;
  nom: string;
  email: string;
  telephone?: string | null;
};

export type AIScore = {
  score: number;
  explication: string;
  points_forts: string[];
  points_a_verifier: string[];
};

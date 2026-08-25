/**
 * Formes de données de la messagerie.
 *
 * Extraites de `ChatWindow.tsx`, qui atteignait 4 045 lignes : rendu, état,
 * requêtes, temps réel, encodage audio et téléversement y cohabitaient dans un
 * seul fichier, intestable et intégralement envoyé au navigateur.
 *
 * Ce module ne contient que des types : il disparaît à la compilation.
 */

export type Message = {
  // UUID côté base, et non un entier : les identifiants de messages ne se
  // comparent ni ne s'incrémentent.
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  read: boolean;
  read_at: string | null;
  closed: boolean;
  closed_by: string | null;
  closed_at: string | null;
  ephemeral: boolean;
  expires_at: string | null;
  created_at: string;
  // Message cité (migration 006). Optionnel : les bases antérieures à cette
  // migration renvoient simplement la colonne absente.
  reply_to?: string | null;
};

/*
 * Les messages en cours d'envoi reçoivent un identifiant local préfixé, seul
 * moyen de les distinguer des messages persistés maintenant que les vrais
 * identifiants sont des UUID. L'ancien procédé — un entier négatif comparé par
 * `id < 0` — reposait sur la coercition d'un UUID en NaN.
 */
export type Conversation = {
  otherId: string;
  otherNom: string;
  otherRole: string;
  lastMessage: string;
  lastDate: string;
  unread: number;
  closed: boolean;
  closedBy: string | null;
};

export type Profile = {
  id: string;
  nom: string;
  role: string;
  email?: string;
  telephone?: string;
};

export type SearchHit = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export type ContactOption = {
  id: string;
  nom: string;
  role: string;
  email?: string;
};

export type MessageAttachment = {
  url: string;
  type: string;
  name: string;
  legacy: boolean;
};

export type ChatWindowProps = {
  currentUserId: string;
  currentRole: "entreprise" | "secretaire" | "admin";
  /** @deprecated Conservé pour compatibilité ; les administrateurs sont désormais chargés depuis profils. */
  adminId?: string;
};

export type ConfirmAction =
  | { kind: "closeConversation"; otherId: string };

/**
 * Tests des fonctions pures de la messagerie.
 *
 * Elles vivaient jusqu'ici au milieu de `ChatWindow.tsx` — 4 045 lignes
 * mêlant rendu, état, requêtes, temps réel et encodage audio. Rien n'y était
 * atteignable sans monter le composant entier, donc rien n'était testé.
 * L'extraction dans `components/chat/helpers.ts` change cela : ces fonctions
 * décident notamment quelles URL sont ouvrables depuis une conversation, ce
 * qui en fait une frontière de sécurité.
 */
import { describe, it, expect } from 'vitest';
import {
  safeHttpUrl,
  fileNameFromUrl,
  inferFileType,
  audioFileExtension,
  chatFilePathFromUrl,
  parseLegacyAttachment,
  isMissingColumnError,
  isSameDay,
  getInitials,
  roleLabel,
  makeOptimisticId,
  isOptimistic,
} from '@/components/chat/helpers';

describe('safeHttpUrl', () => {
  it('accepte http et https', () => {
    expect(safeHttpUrl('https://exemple.test/a.pdf')).toBe('https://exemple.test/a.pdf');
    expect(safeHttpUrl('http://exemple.test/a.pdf')).toBe('http://exemple.test/a.pdf');
  });

  /*
   * Le cœur de la fonction : une pièce jointe est rendue comme un lien
   * cliquable. Sans ce filtre, un message contenant `javascript:...` produirait
   * un lien qui exécute du code dans la session du destinataire — une XSS
   * livrée par la messagerie elle-même.
   */
  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
  ])('rejette le schéma %s', value => {
    expect(safeHttpUrl(value)).toBeNull();
  });

  it('rejette les valeurs vides ou non analysables', () => {
    expect(safeHttpUrl('')).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
    expect(safeHttpUrl('pas une url')).toBeNull();
  });
});

describe('fileNameFromUrl', () => {
  it('extrait le dernier segment et le décode', () => {
    expect(fileNameFromUrl('https://x.test/a/b/Rapport%20final.pdf')).toBe('Rapport final.pdf');
  });

  it('retombe sur « Fichier » quand l\'URL est inexploitable', () => {
    expect(fileNameFromUrl('pas-une-url')).toBe('Fichier');
    expect(fileNameFromUrl('https://x.test/')).toBe('Fichier');
  });
});

describe('inferFileType', () => {
  it('privilégie le type fourni par la base', () => {
    expect(inferFileType('https://x.test/a.pdf', 'image/png')).toBe('image/png');
  });

  it.each([
    ['https://x.test/a.pdf', 'application/pdf'],
    ['https://x.test/a.JPG', 'image/jpeg'],
    ['https://x.test/a.m4a', 'audio/mp4'],
    ['https://x.test/a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ])('déduit le type de %s', (url, expected) => {
    expect(inferFileType(url)).toBe(expected);
  });

  it('retombe sur un type générique pour une extension inconnue', () => {
    expect(inferFileType('https://x.test/a.zzz')).toBe('application/octet-stream');
  });
});

describe('audioFileExtension', () => {
  it.each([
    ['audio/mp4;codecs=mp4a.40.2', 'm4a'],
    ['audio/ogg;codecs=opus', 'ogg'],
    ['audio/mpeg', 'mp3'],
    ['audio/wav', 'wav'],
    ['audio/webm;codecs=opus', 'webm'],
    ['inconnu', 'webm'],
  ])('%s → %s', (mime, expected) => {
    expect(audioFileExtension(mime)).toBe(expected);
  });
});

describe('chatFilePathFromUrl', () => {
  it('retrouve le chemin de stockage', () => {
    const url =
      'https://projet.supabase.co/storage/v1/object/public/chat-files/user-1/Rapport%20final.pdf';
    expect(chatFilePathFromUrl(url)).toBe('user-1/Rapport final.pdf');
  });

  it('renvoie null hors du bucket de la messagerie', () => {
    expect(
      chatFilePathFromUrl('https://projet.supabase.co/storage/v1/object/public/avatars/a.png')
    ).toBeNull();
    expect(chatFilePathFromUrl('https://exemple.test/a.pdf')).toBeNull();
    expect(chatFilePathFromUrl('pas-une-url')).toBeNull();
  });
});

describe('parseLegacyAttachment', () => {
  // Les anciens messages encodaient la pièce jointe dans le texte, avant
  // l'ajout des colonnes dédiées. Le format doit rester lisible.
  it('reconnaît le format historique', () => {
    const parsed = parseLegacyAttachment('📎 Contrat.pdf — https://x.test/Contrat.pdf');
    expect(parsed).not.toBeNull();
    expect(parsed?.url).toBe('https://x.test/Contrat.pdf');
    expect(parsed?.name).toBe('Contrat.pdf');
    expect(parsed?.type).toBe('application/pdf');
    expect(parsed?.legacy).toBe(true);
  });

  it('reconnaît un message vocal', () => {
    const parsed = parseLegacyAttachment('Message vocal — https://x.test/a.webm');
    expect(parsed?.name).toBe('Message vocal');
    expect(parsed?.type.startsWith('audio/')).toBe(true);
  });

  it('refuse une URL de schéma dangereux', () => {
    expect(parseLegacyAttachment('Piège — javascript:alert(1)')).toBeNull();
  });

  it('renvoie null sur un message ordinaire', () => {
    expect(parseLegacyAttachment('Bonjour, comment allez-vous ?')).toBeNull();
  });
});

describe('isMissingColumnError', () => {
  // Sert à dégrader proprement quand une migration n'a pas encore été
  // appliquée : la colonne manquante ne doit pas faire échouer la conversation.
  it('reconnaît les codes PostgREST et PostgreSQL', () => {
    expect(isMissingColumnError({ code: 'PGRST204', message: "column reply_to does not exist" }, 'reply_to')).toBe(true);
    expect(isMissingColumnError({ code: '42703', message: "column reply_to does not exist" }, 'reply_to')).toBe(true);
  });

  it('ignore les autres erreurs', () => {
    expect(isMissingColumnError({ code: '23505', message: 'duplicate key' }, 'reply_to')).toBe(false);
    expect(isMissingColumnError({ code: 'PGRST204', message: 'column autre_chose' }, 'reply_to')).toBe(false);
    expect(isMissingColumnError(null, 'reply_to')).toBe(false);
    expect(isMissingColumnError('erreur', 'reply_to')).toBe(false);
  });
});

describe('isSameDay', () => {
  it('compare bien deux instants du même jour', () => {
    expect(isSameDay('2026-08-25T00:10:00Z', '2026-08-25T23:50:00Z')).toBe(true);
  });

  it('distingue deux jours', () => {
    expect(isSameDay('2026-08-25T12:00:00Z', '2026-08-26T12:00:00Z')).toBe(false);
  });
});

describe('getInitials', () => {
  it.each([
    ['Marie Dupont', 'MD'],
    ['  Jean   Claude  Van Damme ', 'JC'],
    ['Cheick', 'C'],
    ['', '?'],
    ['   ', '?'],
  ])('%s → %s', (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });
});

describe('roleLabel', () => {
  it.each([
    ['admin', 'Administration'],
    ['entreprise', 'Entreprise'],
    ['secretaire', 'Secrétaire'],
    ['inconnu', 'Secrétaire'],
  ])('%s → %s', (role, expected) => {
    expect(roleLabel(role)).toBe(expected);
  });
});

describe('identifiants optimistes', () => {
  it('produit des identifiants reconnaissables et distincts', () => {
    const first = makeOptimisticId();
    const second = makeOptimisticId();
    expect(isOptimistic(first)).toBe(true);
    expect(isOptimistic(second)).toBe(true);
    expect(first).not.toBe(second);
  });

  it('ne confond pas un identifiant de base avec un optimiste', () => {
    expect(isOptimistic('7c9e6679-7425-40de-944b-e07fc1f90ae7')).toBe(false);
  });
});

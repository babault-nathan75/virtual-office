export const OUTILS = [
  'Word', 'Excel', 'PowerPoint',
  'Google Docs', 'Google Sheets',
  'Outlook', 'Gmail', 'WhatsApp Business',
  'Zoom', 'Teams', 'Google Meet',
  'Canva', 'Adobe Acrobat',
  'Sage', 'Saari', 'QuickBooks',
];

export const LANGUES = [
  'Français', 'Anglais', 'Espagnol',
  'Baoulé', 'Dioula', 'Bété', 'Sénoufo',
  'Allemand',
];

export const NIVEAUX = ['BEPC', 'BAC', 'BTS', 'Licence', 'Master', 'Doctorat'];

export const DISPOS = [
  { value: 'immediate', label: 'Immédiate' },
  { value: 'semaine', label: 'Sous une semaine' },
  { value: 'mois', label: 'Sous un mois' },
  { value: 'a_discuter', label: 'À discuter' },
] as const;

export const DISPO_LABEL: Record<string, string> = Object.fromEntries(
  DISPOS.map(d => [d.value, d.label])
);

export const SOFT_SKILLS = [
  'Rigueur', 'Ponctualité', 'Discrétion',
  'Organisation', 'Autonomie', 'Réactivité',
  'Communication écrite', 'Communication orale',
  'Gestion du stress', 'Esprit d\'équipe', 'Sens du service',
];

export const SPECIALITES_SECRETAIRE = [
  { group: 'Secrétariat Général et Administratif', items: [
    'Secrétaire administratif',
    'Secrétaire de direction',
    'Secrétaire assistant',
    'Secrétaire d\'accueil',
    'Secrétaire bureautique',
  ]},
  { group: 'Secrétariat Spécialisé par Secteur', items: [
    'Secrétaire médical',
    'Secrétaire juridique',
    'Secrétaire comptable',
    'Secrétaire commercial',
    'Secrétaire technique',
    'Secrétaire RH',
    'Secrétaire logistique',
    'Secrétaire vétérinaire',
    'Secrétaire paramédical',
  ]},
  { group: 'Langues et Communication', items: [
    'Secrétaire bilingue',
    'Secrétaire de rédaction',
    'Secrétaire d\'édition',
  ]},
  { group: 'Secteur Public, Éducatif et Associatif', items: [
    'Secrétaire de mairie',
    'Secrétaire scolaire',
    'Secrétaire d\'association',
  ]},
  { group: 'Formes Modernes', items: [
    'Télésecrétaire',
    'Secrétaire indépendant',
    'Assistant virtuel',
  ]},
] as const;

export const ALL_SPECIALITES: string[] = SPECIALITES_SECRETAIRE.flatMap(g => [...g.items]);

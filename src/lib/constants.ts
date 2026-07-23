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

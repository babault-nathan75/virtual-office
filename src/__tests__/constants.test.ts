import { describe, it, expect } from 'vitest';
import { OUTILS, LANGUES, NIVEAUX, DISPOS, DISPO_LABEL, SOFT_SKILLS, SPECIALITES_SECRETAIRE } from '@/lib/constants';

describe('OUTILS', () => {
  it('contains essential tools', () => {
    expect(OUTILS).toContain('Word');
    expect(OUTILS).toContain('Excel');
    expect(OUTILS).toContain('Zoom');
  });

  it('is a non-empty array', () => {
    expect(OUTILS.length).toBeGreaterThan(0);
  });
});

describe('LANGUES', () => {
  it('includes French', () => {
    expect(LANGUES).toContain('Français');
  });

  it('includes English', () => {
    expect(LANGUES).toContain('Anglais');
  });
});

describe('NIVEAUX', () => {
  it('has BEPC and Doctorat', () => {
    expect(NIVEAUX).toContain('BEPC');
    expect(NIVEAUX).toContain('Doctorat');
  });
});

describe('DISPOS', () => {
  it('has value/label pairs', () => {
    DISPOS.forEach(d => {
      expect(d).toHaveProperty('value');
      expect(d).toHaveProperty('label');
    });
  });
});

describe('DISPO_LABEL', () => {
  it('maps value to label', () => {
    expect(DISPO_LABEL['immediate']).toBe('Immédiate');
    expect(DISPO_LABEL['semaine']).toBe('Sous une semaine');
  });
});

describe('SOFT_SKILLS', () => {
  it('includes core skills', () => {
    expect(SOFT_SKILLS).toContain('Rigueur');
    expect(SOFT_SKILLS).toContain('Ponctualité');
    expect(SOFT_SKILLS).toContain('Discrétion');
  });
});

describe('SPECIALITES_SECRETAIRE', () => {
  it('has groups with items', () => {
    expect(SPECIALITES_SECRETAIRE.length).toBeGreaterThan(0);
    SPECIALITES_SECRETAIRE.forEach(g => {
      expect(g).toHaveProperty('group');
      expect(g).toHaveProperty('items');
      expect(g.items.length).toBeGreaterThan(0);
    });
  });

  it('includes Secrétaire administratif', () => {
    const allItems = SPECIALITES_SECRETAIRE.flatMap(g => g.items);
    expect(allItems).toContain('Secrétaire administratif');
  });
});

import { describe, it, expect } from 'vitest';
import { kycSchema, type KycFormData } from '@/lib/validations';

describe('kycSchema', () => {
  const validData: KycFormData = {
    prenom: 'Marie',
    nom: 'Dupont',
    date_naissance: '1990-05-15',
    nationalite: 'Ivoirienne',
    nom_entreprise: 'SAS Test',
  };

  describe('valid inputs', () => {
    it('accepts complete valid data', () => {
      const result = kycSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('accepts minimal data (only required fields)', () => {
      const result = kycSchema.safeParse({
        prenom: 'Marie',
        nom: 'Dupont',
        date_naissance: '1990-05-15',
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty optional fields', () => {
      const result = kycSchema.safeParse({
        prenom: 'Marie',
        nom: 'Dupont',
        date_naissance: '1990-05-15',
        nationalite: '',
        nom_entreprise: '',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('prenom validation', () => {
    it('rejects empty prenom', () => {
      const result = kycSchema.safeParse({ ...validData, prenom: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Prénom requis');
      }
    });

    it('accepts whitespace-only prenom (no trim in schema)', () => {
      const result = kycSchema.safeParse({ ...validData, prenom: '   ' });
      expect(result.success).toBe(true);
    });

    it('accepts prenom with accents', () => {
      const result = kycSchema.safeParse({ ...validData, prenom: 'Marie-Claire' });
      expect(result.success).toBe(true);
    });

    it('rejects prenom > 100 chars', () => {
      const result = kycSchema.safeParse({ ...validData, prenom: 'A'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('accepts prenom at max length (100)', () => {
      const result = kycSchema.safeParse({ ...validData, prenom: 'A'.repeat(100) });
      expect(result.success).toBe(true);
    });
  });

  describe('nom validation', () => {
    it('rejects empty nom', () => {
      const result = kycSchema.safeParse({ ...validData, nom: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Nom requis');
      }
    });

    it('accepts compound names', () => {
      const result = kycSchema.safeParse({ ...validData, nom: 'Kouassi-Mensah' });
      expect(result.success).toBe(true);
    });

    it('rejects nom > 100 chars', () => {
      const result = kycSchema.safeParse({ ...validData, nom: 'B'.repeat(101) });
      expect(result.success).toBe(false);
    });
  });

  describe('date_naissance validation', () => {
    it('rejects empty date', () => {
      const result = kycSchema.safeParse({ ...validData, date_naissance: '' });
      expect(result.success).toBe(false);
    });

    it('accepts valid date string', () => {
      const result = kycSchema.safeParse({ ...validData, date_naissance: '1990-05-15' });
      expect(result.success).toBe(true);
    });

    it('accepts any string for date (Zod string)', () => {
      const result = kycSchema.safeParse({ ...validData, date_naissance: 'not-a-date' });
      expect(result.success).toBe(true);
    });
  });

  describe('nationalite validation', () => {
    it('accepts missing nationalite', () => {
      const { nationalite, ...data } = validData;
      const result = kycSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('rejects nationalite > 100 chars', () => {
      const result = kycSchema.safeParse({ ...validData, nationalite: 'C'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('accepts nationalite at max length', () => {
      const result = kycSchema.safeParse({ ...validData, nationalite: 'C'.repeat(100) });
      expect(result.success).toBe(true);
    });
  });

  describe('nom_entreprise validation', () => {
    it('accepts missing nom_entreprise', () => {
      const { nom_entreprise, ...data } = validData;
      const result = kycSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('rejects nom_entreprise > 200 chars', () => {
      const result = kycSchema.safeParse({ ...validData, nom_entreprise: 'D'.repeat(201) });
      expect(result.success).toBe(false);
    });

    it('accepts nom_entreprise at max length', () => {
      const result = kycSchema.safeParse({ ...validData, nom_entreprise: 'D'.repeat(200) });
      expect(result.success).toBe(true);
    });
  });

  describe('type inference', () => {
    it('produces correct type from schema', () => {
      const result = kycSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        const data: KycFormData = result.data;
        expect(typeof data.prenom).toBe('string');
        expect(typeof data.nom).toBe('string');
        expect(typeof data.date_naissance).toBe('string');
      }
    });
  });
});

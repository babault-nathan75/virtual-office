import { describe, it, expect } from 'vitest';
import {
  inscriptionSchema,
  serverInscriptionSchema,
  connexionSchema,
  kycSchema,
  telephoneSchema,
  otpSchema,
} from '@/lib/validations';

const validSignup = {
  nom: 'Test User',
  email: 'test@test.com',
  telephone: '+22501020304',
  password: 'Tes7UniqueP@ss9876!',
  confirmPassword: 'Tes7UniqueP@ss9876!',
  role: 'secretaire' as const,
};

describe('inscriptionSchema', () => {
  it('rejette un nom trop court', () => {
    const result = inscriptionSchema.safeParse({ ...validSignup, nom: 'A' });
    expect(result.success).toBe(false);
  });

  it('rejette un email invalide', () => {
    const result = inscriptionSchema.safeParse({ ...validSignup, email: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejette un mot de passe trop court', () => {
    const result = inscriptionSchema.safeParse({
      ...validSignup,
      password: '123456Aa!',
      confirmPassword: '123456Aa!',
    });
    expect(result.success).toBe(false);
  });

  it('rejette un mot de passe sans caractère spécial', () => {
    const result = inscriptionSchema.safeParse({
      ...validSignup,
      password: 'MotDePasse12345',
      confirmPassword: 'MotDePasse12345',
    });
    expect(result.success).toBe(false);
  });

  it('rejette des mots de passe différents', () => {
    const result = inscriptionSchema.safeParse({
      ...validSignup,
      confirmPassword: 'Different@Password123',
    });
    expect(result.success).toBe(false);
  });

  it('accepte des données valides', () => {
    const result = inscriptionSchema.safeParse(validSignup);
    expect(result.success).toBe(true);
  });

  /*
   * Le schéma doit rester synchrone.
   *
   * Une version antérieure y avait greffé un raffinement asynchrone (appel à
   * haveibeenpwned) : `safeParse` lève alors « Encountered Promise during
   * synchronous parse », ce qui aurait fait tomber en 500 toute route serveur
   * validant ces données. La vérification vit maintenant dans
   * `@/lib/passwordCheck`, appelée explicitement côté serveur.
   */
  it('reste utilisable en analyse synchrone', () => {
    expect(() => inscriptionSchema.safeParse(validSignup)).not.toThrow();
    expect(() => serverInscriptionSchema.safeParse(validSignup)).not.toThrow();
  });

  it('normalise l\'email en minuscules', () => {
    const result = serverInscriptionSchema.safeParse({
      ...validSignup,
      email: 'Test.User@Example.COM',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('test.user@example.com');
  });
});

describe('connexionSchema', () => {
  it('rejette un email vide', () => {
    const result = connexionSchema.safeParse({ email: '', password: 'peu importe' });
    expect(result.success).toBe(false);
  });

  it('rejette un mot de passe vide', () => {
    const result = connexionSchema.safeParse({ email: 'test@test.com', password: '' });
    expect(result.success).toBe(false);
  });

  /*
   * Régression : une politique de complexité avait été appliquée à la
   * connexion (12 caractères minimum). Tous les comptes créés sous la
   * politique précédente — 8 à 11 caractères — se retrouvaient bloqués côté
   * navigateur, sans aucun message expliquant pourquoi.
   */
  it('accepte un mot de passe hérité de moins de 12 caractères', () => {
    const result = connexionSchema.safeParse({ email: 'test@test.com', password: 'ancien8c' });
    expect(result.success).toBe(true);
  });
});

describe('telephoneSchema', () => {
  it.each(['+22501020304', '01 02 03 04 05', '+33 6 12 34 56 78', '(225)0102030405'])(
    'accepte %s',
    value => {
      expect(telephoneSchema.safeParse(value).success).toBe(true);
    }
  );

  // « abcdefgh » passait l'ancienne règle, qui n'exigeait qu'une longueur.
  it.each(['abcdefgh', 'pas-un-numero', '123'])('rejette %s', value => {
    expect(telephoneSchema.safeParse(value).success).toBe(false);
  });
});

describe('otpSchema', () => {
  it('accepte six chiffres', () => {
    expect(otpSchema.safeParse({ code: '048213' }).success).toBe(true);
  });

  it.each(['12345', '1234567', '12a456', ''])('rejette %s', code => {
    expect(otpSchema.safeParse({ code }).success).toBe(false);
  });
});

describe('kycSchema', () => {
  it('rejette un prénom vide', () => {
    const result = kycSchema.safeParse({ prenom: '', nom: 'Dupont', date_naissance: '2000-01-01' });
    expect(result.success).toBe(false);
  });

  it('accepte des données valides', () => {
    const result = kycSchema.safeParse({
      prenom: 'Marie',
      nom: 'Dupont',
      date_naissance: '2000-01-01',
    });
    expect(result.success).toBe(true);
  });
});

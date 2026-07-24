import { describe, it, expect } from 'vitest';
import { inscriptionSchema, connexionSchema, kycSchema } from '@/lib/validations';

describe('inscriptionSchema', () => {
  it('rejects short name', () => {
    const result = inscriptionSchema.safeParse({
      nom: 'A',
      email: 'test@test.com',
      telephone: '+22501020304',
      password: '123456',
      confirmPassword: '123456',
      role: 'entreprise',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = inscriptionSchema.safeParse({
      nom: 'Test',
      email: 'invalid',
      telephone: '+22501020304',
      password: '123456',
      confirmPassword: '123456',
      role: 'entreprise',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = inscriptionSchema.safeParse({
      nom: 'Test',
      email: 'test@test.com',
      telephone: '+22501020304',
      password: '123',
      confirmPassword: '123',
      role: 'entreprise',
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    const result = inscriptionSchema.safeParse({
      nom: 'Test',
      email: 'test@test.com',
      telephone: '+22501020304',
      password: '123456',
      confirmPassword: '654321',
      role: 'entreprise',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid data', () => {
    const result = inscriptionSchema.safeParse({
      nom: 'Test User',
      email: 'test@test.com',
      telephone: '+22501020304',
      password: '123456',
      confirmPassword: '123456',
      role: 'secretaire',
    });
    expect(result.success).toBe(true);
  });
});

describe('connexionSchema', () => {
  it('rejects empty email', () => {
    const result = connexionSchema.safeParse({ email: '', password: '123456' });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = connexionSchema.safeParse({ email: 'test@test.com', password: '' });
    expect(result.success).toBe(false);
  });

  it('accepts valid data', () => {
    const result = connexionSchema.safeParse({ email: 'test@test.com', password: '123456' });
    expect(result.success).toBe(true);
  });
});

describe('kycSchema', () => {
  it('rejects empty prenom', () => {
    const result = kycSchema.safeParse({ prenom: '', nom_naissance: 'Dupont', date_naissance: '2000-01-01' });
    expect(result.success).toBe(false);
  });

  it('accepts valid data', () => {
    const result = kycSchema.safeParse({ prenom: 'Marie', nom_naissance: 'Dupont', date_naissance: '2000-01-01' });
    expect(result.success).toBe(true);
  });
});

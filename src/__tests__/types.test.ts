import { describe, it, expectTypeOf } from 'vitest';
import type { SecretaireProfil, Mission, Candidature, Offre, ContactProfil, AIScore } from '@/lib/types';

describe('types', () => {
  it('SecretaireProfil has required fields', () => {
    expectTypeOf<SecretaireProfil>().toHaveProperty('id');
    expectTypeOf<SecretaireProfil>().toHaveProperty('nom');
  });

  it('Mission has required fields', () => {
    expectTypeOf<Mission>().toHaveProperty('id');
    expectTypeOf<Mission>().toHaveProperty('titre');
    expectTypeOf<Mission>().toHaveProperty('description');
    expectTypeOf<Mission>().toHaveProperty('created_at');
  });

  it('Candidature has statut', () => {
    expectTypeOf<Candidature>().toHaveProperty('statut');
  });

  it('Offre has statut', () => {
    expectTypeOf<Offre>().toHaveProperty('statut');
  });

  it('ContactProfil has email', () => {
    expectTypeOf<ContactProfil>().toHaveProperty('email');
  });

  it('AIScore has score', () => {
    expectTypeOf<AIScore>().toHaveProperty('score');
    expectTypeOf<AIScore>().toHaveProperty('explication');
    expectTypeOf<AIScore>().toHaveProperty('points_forts');
  });
});

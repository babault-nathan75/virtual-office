import { describe, it, expect } from 'vitest';
import { getStrength } from '@/components/PasswordStrength';

/*
 * On teste la vraie implémentation du composant. La version précédente
 * redéfinissait `getStrength` en local avec d'autres seuils (6/10 au lieu
 * de 8/12) : le test passait quel que soit le comportement réel.
 */
describe('getStrength', () => {
  it('classe un mot de passe très court en Trop faible', () => {
    const result = getStrength('abc');
    expect(result.label).toBe('Trop faible');
    expect(result.score).toBeLessThanOrEqual(1);
    // Un simple mot de passe court n'est PAS « trop courant » :
    // c'était le bug de hasCommon forcé à true dans le composant.
    expect(result.hasCommon).toBe(false);
  });

  it('signale un mot de passe de la liste interdite', () => {
    const result = getStrength('azerty123');
    expect(result.hasCommon).toBe(true);
    expect(result.label).toBe('Trop faible');
  });

  it('monte en Moyen des que la base est reunie', () => {
    // 8 caracteres, casse mixte, chiffre — sans caractere special.
    const result = getStrength('Abcdef12');
    expect(result.score).toBe(3);
    expect(result.label).toBe('Moyen');
  });

  it('classe un mot de passe conforme a la politique en Fort', () => {
    // 12 caracteres, minuscule + majuscule + chiffre + special.
    const result = getStrength('Abcdef12!xyz');
    expect(result.score).toBe(5);
    expect(result.label).toBe('Fort');
  });

  it('renvoie Trop faible pour une chaine vide', () => {
    const result = getStrength('');
    expect(result.label).toBe('Trop faible');
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

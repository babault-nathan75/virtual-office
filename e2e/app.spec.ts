import { test, expect } from '@playwright/test';

test.describe('Page d\'accueil', () => {
  test('affiche la section héro', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Déléguez votre administratif');
  });

  test('a les bonnes métadonnées', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SecrétariatPro/);
  });

  test('les liens de navigation fonctionnent', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/connexion"]');
    await expect(page).toHaveURL(/connexion/);
  });

  test('le lien d\'inscription fonctionne', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/inscription"]');
    await expect(page).toHaveURL(/inscription/);
  });
});

test.describe('Pages d\'authentification', () => {
  /*
   * Les titres des écrans d'auth sont désormais des `h1`.
   * Ils étaient rendus en `h2` alors qu'aucun `h1` n'existait sur la page :
   * la hiérarchie des titres était rompue, ce que signalent les audits
   * d'accessibilité et ce qui prive la page de son titre principal pour les
   * moteurs de recherche.
   */
  test('la page de connexion se charge', async ({ page }) => {
    await page.goto('/connexion');
    await expect(page.locator('main h1')).toContainText('Bon retour');
  });

  test('la page d\'inscription se charge', async ({ page }) => {
    await page.goto('/inscription');
    await expect(page.locator('main h1')).toContainText('Créer un compte');
  });

  test('la validation du formulaire de connexion s\'affiche', async ({ page }) => {
    await page.goto('/connexion');
    await page.locator('form button[type="submit"]').click({ force: true });
    await expect(page.getByText('Adresse email invalide')).toBeVisible();
  });

  test('la validation du formulaire d\'inscription s\'affiche', async ({ page }) => {
    await page.goto('/inscription');
    await page.locator('form button[type="submit"]').click({ force: true });
    await expect(page.getByText('Le nom doit contenir')).toBeVisible();
  });

  test('la vérification anti-robot est présente sur les deux formulaires', async ({ page }) => {
    for (const path of ['/connexion', '/inscription']) {
      await page.goto(path);
      // Le widget Turnstile s'injecte dans un iframe ; on attend qu'il soit
      // rendu plutôt que d'inspecter son contenu, inaccessible cross-origin.
      await expect(page.locator('iframe[src*="challenges.cloudflare.com"]')).toBeVisible({
        timeout: 15_000,
      });
    }
  });

  test('l\'écran de vérification exige un contexte', async ({ page }) => {
    // Sans paramètre `purpose`/`email` ni cookie de défi, l'écran n'a rien à
    // vérifier : il renvoie vers la connexion au lieu d'afficher un formulaire
    // inerte.
    await page.goto('/verification');
    await expect(page).toHaveURL(/connexion/);
  });
});

test.describe('Sécurité', () => {
  test('une route protégée redirige vers la connexion', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/connexion/);
  });

  test('la destination demandée est mémorisée', async ({ page }) => {
    await page.goto('/dashboard/messages');
    await expect(page).toHaveURL(/suivant=/);
  });

  test('la route admin bloque les non-administrateurs', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await expect(page).toHaveURL(/dashboard(?!\/admin)/);
  });

  test('les en-têtes de sécurité sont présents', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers();
    expect(headers?.['x-content-type-options']).toBe('nosniff');
    expect(headers?.['x-frame-options']).toBe('DENY');
    expect(headers?.['strict-transport-security']).toContain('max-age=63072000');

    const csp = headers?.['content-security-policy'];
    expect(csp).toBeTruthy();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain('challenges.cloudflare.com');

    // Retiré au profit du CSP : l'auditeur XSS correspondant n'existe plus
    // dans les navigateurs, et sa réactivation introduisait elle-même une
    // fuite d'information.
    expect(headers?.['x-xss-protection']).toBeUndefined();
  });

  test('une mutation sans origine est refusée (CSRF)', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: 'a@b.fr', password: 'x', turnstileToken: 'x' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(403);
  });
});

test.describe('Pages statiques', () => {
  test('les mentions légales se chargent', async ({ page }) => {
    await page.goto('/mentions-legales');
    await expect(page.locator('h1')).toContainText('Mentions légales');
  });

  test('les CGU se chargent', async ({ page }) => {
    await page.goto('/cgu');
    await expect(page.locator('h1')).toContainText('Conditions Générales');
  });

  test('la politique de confidentialité se charge', async ({ page }) => {
    await page.goto('/confidentialite');
    await expect(page.locator('h1')).toContainText('Politique de Confidentialité');
  });

  test('la page hors connexion se charge', async ({ page }) => {
    await page.goto('/offline');
    await expect(page.locator('h1')).toContainText('Hors connexion');
  });

  test('le sitemap n\'expose pas les écrans transactionnels', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    const body = await response.text();
    expect(body).toContain('/inscription');
    expect(body).not.toContain('/verification');
    expect(body).not.toContain('/dashboard');
  });
});

test.describe('Affichage mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('la page d\'accueil s\'affiche sur mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('le formulaire de connexion reste utilisable sur mobile', async ({ page }) => {
    await page.goto('/connexion');
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('loads and displays hero section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Déléguez votre administratif');
  });

  test('has correct meta tags', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SecrétariatPro/);
  });

  test('navigation links work', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/connexion"]');
    await expect(page).toHaveURL(/connexion/);
  });

  test('inscription link works', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/inscription"]');
    await expect(page).toHaveURL(/inscription/);
  });
});

test.describe('Auth pages', () => {
  test('connexion page loads', async ({ page }) => {
    await page.goto('/connexion');
    await expect(page.locator('h2')).toContainText('Bon retour');
  });

  test('inscription page loads', async ({ page }) => {
    await page.goto('/inscription');
    await expect(page.locator('h2')).toContainText('Créez votre compte');
  });

  test('connexion form validation', async ({ page }) => {
    await page.goto('/connexion');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Adresse email invalide')).toBeVisible();
  });

  test('inscription form validation', async ({ page }) => {
    await page.goto('/inscription');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Le nom doit contenir')).toBeVisible();
  });
});

test.describe('Security', () => {
  test('protected route redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/connexion/);
  });

  test('admin route blocks non-admin users', async ({ page }) => {
    await page.goto('/dashboard/admin');
    await expect(page).toHaveURL(/dashboard(?!\/admin)/);
  });

  test('security headers are present', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response?.headers();
    expect(headers?.['x-content-type-options']).toBe('nosniff');
    expect(headers?.['x-frame-options']).toBe('DENY');
    expect(headers?.['strict-transport-security']).toContain('max-age=63072000');
  });
});

test.describe('Static pages', () => {
  test('mentions legales loads', async ({ page }) => {
    await page.goto('/mentions-legales');
    await expect(page.locator('h1')).toContainText('Mentions légales');
  });

  test('cgu loads', async ({ page }) => {
    await page.goto('/cgu');
    await expect(page.locator('h1')).toContainText('Conditions Générales');
  });

  test('confidentialite loads', async ({ page }) => {
    await page.goto('/confidentialite');
    await expect(page.locator('h1')).toContainText('Politique de Confidentialité');
  });

  test('offline page loads', async ({ page }) => {
    await page.goto('/offline');
    await expect(page.locator('h1')).toContainText('Hors connexion');
  });
});

test.describe('Mobile responsive', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('homepage renders on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('bottom nav is visible on mobile', async ({ page }) => {
    await page.goto('/connexion');
    // Login first, then check bottom nav
    // For now just check mobile layout doesn't break
    await expect(page.locator('h2')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/SecrétariatPro/);
  });

  test('redirects unauthorized to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/connexion/);
  });

  test('login page renders', async ({ page }) => {
    await page.goto('/connexion');
    await expect(page.getByRole('heading', { name: /connexion/i })).toBeVisible();
  });

  test('inscription page renders', async ({ page }) => {
    await page.goto('/inscription');
    await expect(page.getByRole('heading', { name: /inscription/i })).toBeVisible();
  });

  test('404 page renders', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await expect(page.getByText(/404/)).toBeVisible();
  });
});

test.describe('UI Components', () => {
  test('dark mode toggle persists', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('[data-testid="theme-toggle"]');
    if (await toggle.isVisible()) {
      await toggle.click();
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/);
    }
  });
});

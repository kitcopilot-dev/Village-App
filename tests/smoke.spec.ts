import { test, expect } from '@playwright/test';

test.describe('Village Homeschool - Smoke Tests', () => {
  
  test.describe('Public Pages', () => {
    test('homepage loads with login form', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('h1:has-text("Village")').first()).toBeVisible();
      await expect(page.locator('input[type="email"]').first()).toBeVisible();
      await expect(page.locator('input[type="password"]').first()).toBeVisible();
    });

    test('legal guides page loads without auth', async ({ page }) => {
      await page.goto('/legal-guides');
      await expect(page.locator('text=Legal Guides')).toBeVisible();
      await expect(page.locator('text=Disclaimer')).toBeVisible();
    });

    test('legal guides shows state cards', async ({ page }) => {
      await page.goto('/legal-guides');
      await expect(page.locator('h3:has-text("Texas")').first()).toBeVisible({ timeout: 10000 });
      await expect(page.locator('h3:has-text("California")').first()).toBeVisible();
    });
  });

  test.describe('Authentication Flow', () => {
    test('can attempt login', async ({ page }) => {
      await page.goto('/');
      const loginForm = page.locator('form').filter({ hasText: 'Login' });
      await loginForm.locator('input[type="email"]').fill('test@example.com');
      await loginForm.locator('input[type="password"]').fill('wrongpassword');
      await loginForm.locator('button:has-text("Login")').click();
      // Should show error (we're using wrong credentials)
      await expect(page.locator('text=Invalid email or password').or(page.locator('text=failed')).or(page.locator('text=Failed'))).toBeVisible({ timeout: 10000 });
    });

    test('register form has required fields', async ({ page }) => {
      await page.goto('/');
      // Find register section
      await expect(page.locator('text=Join the community')).toBeVisible();
      await expect(page.locator('input[placeholder*="Family"]')).toBeVisible();
    });
  });

  test.describe('Protected Pages Redirect', () => {
    test('profile redirects to login when not authenticated', async ({ page }) => {
      await page.goto('/profile');
      // Should redirect to home/login
      await expect(page).toHaveURL('/');
    });

    test('manage-kids redirects to login when not authenticated', async ({ page }) => {
      await page.goto('/manage-kids');
      await expect(page).toHaveURL('/');
    });

    test('dashboard redirects to login when not authenticated', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL('/');
    });

    test('assignments redirects to login when not authenticated', async ({ page }) => {
      await page.goto('/assignments');
      await expect(page).toHaveURL('/');
    });

    test('transcript redirects to login when not authenticated', async ({ page }) => {
      await page.goto('/transcript');
      await expect(page).toHaveURL('/');
    });

    test('calendar redirects to login when not authenticated', async ({ page }) => {
      await page.goto('/calendar');
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('homepage is mobile friendly', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/');
      await expect(page.locator('h1:has-text("Village")').first()).toBeVisible();
      // Content should fit without horizontal scroll
      const body = page.locator('body');
      const scrollWidth = await body.evaluate(el => el.scrollWidth);
      const clientWidth = await body.evaluate(el => el.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10); // Allow small margin
    });

    test('legal guides is mobile friendly', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/legal-guides');
      await expect(page.locator('text=Legal Guides')).toBeVisible();
    });
  });

  test.describe('State Details Navigation', () => {
    test('can click into a state and see details', async ({ page }) => {
      await page.goto('/legal-guides');
      await page.locator('h3:has-text("Texas")').first().click();
      await expect(page.locator('text=All States')).toBeVisible();
      await expect(page.locator('h3:has-text("Overview")').or(page.locator('h3:has-text("Key Requirements")')).first()).toBeVisible();
    });

    test('can navigate back from state details', async ({ page }) => {
      await page.goto('/legal-guides');
      await page.locator('h3:has-text("Texas")').first().click();
      await page.click('text=All States');
      await expect(page.locator('text=Legal Guides')).toBeVisible();
    });
  });
});

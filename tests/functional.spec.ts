import { test, expect } from '@playwright/test';

test.describe('Village Homeschool - Functional Flows (Mocked Backend)', () => {
  const childName = "Emma Mock";

  test.beforeEach(async ({ page }) => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXItMSIsImV4cCI6NDgxMTUwNDAwMH0.fake-sig';

    // Mock PocketBase API
    await page.route('**/api/collections/profiles/auth-with-password', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: fakeToken,
          record: { id: 'user-1', email: 'test@example.com', family_name: 'Test Family' }
        })
      });
    });

    await page.route('**/api/collections/profiles/auth-refresh', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: fakeToken,
          record: { id: 'user-1', email: 'test@example.com', family_name: 'Test Family' }
        })
      });
    });

    await page.route('**/api/collections/children/records*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            page: 1, perPage: 100, totalItems: 1, totalPages: 1,
            items: [
              { id: 'kid-1', name: childName, age: 8, grade: '3rd Grade', user: 'user-1' }
            ]
          })
        });
      } else {
        await route.fulfill({ status: 200, body: '{}' });
      }
    });

    await page.route('**/api/collections/courses/records*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            page: 1, perPage: 100, totalItems: 1, totalPages: 1,
            items: [
              { id: 'course-1', child: 'kid-1', name: 'Space Science', total_lessons: 100, current_lesson: 1, active_days: 'Tue,Thu' }
            ]
          })
        });
      } else {
        await route.fulfill({ status: 200, body: '{}' });
      }
    });

    await page.route('**/api/collections/portfolio/records*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] })
      });
    });

    await page.route('**/api/collections/assignments/records*', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              { id: 'asgn-1', child: 'kid-1', title: 'Math Quiz', subject: 'Math', score: 95, status: 'Graded', due_date: new Date().toISOString() }
            ]
          })
        });
      } else {
        await route.fulfill({ status: 200, body: '{}' });
      }
    });

    await page.route('**/api/collections/school_years/records*', async route => {
      const today = new Date();
      const nextYear = new Date();
      nextYear.setFullYear(today.getFullYear() + 1);
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { 
              id: 'sy-1', 
              name: '2024-2025', 
              start_date: today.toISOString().split('T')[0], 
              end_date: nextYear.toISOString().split('T')[0] 
            }
          ]
        })
      });
    });

    await page.route('**/api/collections/school_breaks/records*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] })
      });
    });

    await page.route('**/api/collections/activity_logs/records*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] })
      });
    });

    // 1. Login
    await page.goto('/');
    const loginForm = page.locator('form').filter({ has: page.locator('button:has-text("Login")') });
    await loginForm.getByPlaceholder('Email').fill('test@example.com');
    await loginForm.getByPlaceholder('Password').fill('password123');
    await loginForm.locator('button:has-text("Login")').click();

    await expect(page).toHaveURL('/profile', { timeout: 10000 });
  });

  test('full child management and scheduling lifecycle', async ({ page }) => {
    // 2. Go to Manage Kids
    await page.click('text=Manage Kids');
    await expect(page).toHaveURL('/manage-kids');
    
    // Verify child card appears
    await expect(page.locator(`h3:has-text("${childName}")`)).toBeVisible();

    // 3. Open Learning Vault
    await page.click('button[title="Open Learning Vault"]');

    // Verify course appears in Overview
    await expect(page.locator('h4:has-text("Space Science")')).toBeVisible();
    await expect(page.locator('text=Lesson 1 of 100')).toBeVisible();
    
    // Verify status badge (could be On Track or Ahead depending on current day)
    await expect(page.locator('span:has-text("Lessons ahead")').or(page.locator('text=On Track'))).toBeVisible();

    // 4. Verify scheduling logic
    await page.click('text=Weekly Schedule');
    
    // Thursday column should have the course
    const thuCol = page.locator('.bg-bg-alt').filter({ has: page.locator('h5:has-text("Thu")') });
    await expect(thuCol.first()).toContainText('Space Science');
    
    // Wednesday column should show "No courses scheduled"
    const wedCol = page.locator('.bg-bg-alt').filter({ has: page.locator('h5:has-text("Wed")') });
    await expect(wedCol.first()).toContainText('No courses scheduled');

    // 5. Test progress advancement
    await page.click('text=Overview');
    
    // Setup mock for update
    await page.route('**/api/collections/courses/records/course-1', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'course-1', current_lesson: 2 })
      });
    });

    await page.click('button:has-text("Next Lesson →")');
    await expect(page.locator('text=Lesson recorded!')).toBeVisible();
  });

  test('portfolio rendering', async ({ page }) => {
    await page.click('text=Manage Kids');
    await page.click('button[title="Open Learning Vault"]');
    await page.click('text=Portfolio');
    
    // Verify example project (when list is empty)
    await expect(page.locator('text=Example: Volcano Model')).toBeVisible();
  });

  test('assignments and grading analytics', async ({ page }) => {
    // Go to Assignments
    await page.click('text=Assignments');
    await expect(page).toHaveURL('/assignments');
    
    // Verify existing assignment
    await expect(page.locator('text=Math Quiz')).toBeVisible();
    await expect(page.locator('text=95%')).toBeVisible();

    // Go to Dashboard to check analytics
    await page.click('text=Dashboard');
    await expect(page).toHaveURL('/dashboard');
    
    // Verify GPA Analytics card appears
    await expect(page.locator('text=Grading Analytics')).toBeVisible();
    await expect(page.locator('text=GPA by Student')).toBeVisible();
    await expect(page.locator('text=4.00')).toBeVisible(); // 95% is an A (4.0)
  });

  test('transcript generation', async ({ page }) => {
    await page.click('text=Transcript');
    await expect(page).toHaveURL('/transcript');
    
    // Verify transcript content
    await expect(page.locator('h1:has-text("Academic Transcript")').last()).toBeVisible();
    await expect(page.locator(`p:has-text("${childName}")`).last()).toBeVisible();
    await expect(page.locator('text=Course Record')).toBeVisible();
    await expect(page.locator('text=Space Science')).toBeVisible();
    await expect(page.locator('text=Cumulative GPA')).toBeVisible();
  });

  test('school year calendar', async ({ page }) => {
    await page.click('text=Calendar');
    await expect(page).toHaveURL('/calendar');
    
    // Verify school year info
    await expect(page.locator('text=2024-2025')).toBeVisible();
    await expect(page.locator('text=Total School Days')).toBeVisible();
    await expect(page.locator('text=Breaks & Holidays')).toBeVisible();
  });
});

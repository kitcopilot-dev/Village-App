import { test, expect } from '@playwright/test';

test.describe('Village Homeschool - New Features (Mocked Backend)', () => {
  const childName = "Tulip Lynch";

  test.beforeEach(async ({ page }) => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXItMSIsImV4cCI6NDgxMTUwNDAwMH0.fake-sig';

    // Global Mocks
    await page.route('**/api/collections/profiles/auth-with-password', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: fakeToken,
          record: { id: 'user-1', email: 'test@example.com', family_name: 'Lynch Family', location: 'Chicago, IL', profile_latitude: 41.8781, profile_longitude: -87.6298 }
        })
      });
    });

    await page.route('**/api/collections/profiles/auth-refresh', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: fakeToken,
          record: { id: 'user-1', email: 'test@example.com', family_name: 'Lynch Family', location: 'Chicago, IL', profile_latitude: 41.8781, profile_longitude: -87.6298 }
        })
      });
    });

    // Mock other collections
    await page.route('**/api/collections/*/records*', async route => {
      const url = route.request().url();
      if (url.includes('children')) {
        await route.fulfill({ status: 200, body: JSON.stringify({ items: [{ id: 'kid-1', name: childName, age: 13, grade: '8th Grade', user: 'user-1' }] }) });
      } else if (url.includes('courses')) {
        await route.fulfill({ status: 200, body: JSON.stringify({ items: [{ id: 'course-1', child: 'kid-1', name: 'Science', total_lessons: 180, current_lesson: 5, active_days: 'Tue,Thu' }] }) });
      } else if (url.includes('attendance')) {
        await route.fulfill({ status: 200, body: JSON.stringify({ items: [{ id: 'att-1', child: 'kid-1', date: new Date().toISOString(), status: 'present' }] }) });
      } else if (url.includes('portfolio')) {
        await route.fulfill({ status: 200, body: JSON.stringify({ items: [{ id: 'p-1', child: 'kid-1', title: 'Solar Project', subject: 'Science', date: new Date().toISOString() }] }) });
      } else if (url.includes('lessons')) {
        await route.fulfill({ status: 200, body: JSON.stringify({ 
          id: 'lesson-1', 
          title: 'The Magic of Photosynthesis', 
          subject: 'Science', 
          grade_level: '8th Grade',
          content: { hook: 'Plants breathe sunlight!', activity: 'Watch a leaf', resources: [] },
          interactive_data: { questions: [{ id: 'q1', text: 'Energy source?', type: 'multiple-choice', options: ['Sunlight', 'Water'], answer: 'Sunlight' }] }
        }) });
      } else if (url.includes('student_insights')) {
        await route.fulfill({ status: 200, body: JSON.stringify({ items: [{ id: 'ins-1', child: 'kid-1', subject: 'Science', observation: 'Excels at biology', last_updated: new Date().toISOString() }] }) });
      } else {
        await route.fulfill({ status: 200, body: JSON.stringify({ items: [] }) });
      }
    });

    // Login
    await page.goto('/');
    const loginForm = page.locator('form').filter({ has: page.locator('button:has-text("Login")') });
    await loginForm.getByPlaceholder('Email').fill('test@example.com');
    await loginForm.getByPlaceholder('Password').fill('password123');
    await loginForm.locator('button:has-text("Login")').click();
    await expect(page).toHaveURL('/profile');
  });

  test('attendance tracker - tap to log', async ({ page }) => {
    await page.click('text=Attendance');
    await expect(page).toHaveURL('/attendance');
    
    // Verify stats appear
    await expect(page.locator('text=Days Logged')).toBeVisible();
    await expect(page.locator('.text-5xl').filter({ hasText: /^1$/ })).toBeVisible(); 
    
    // Verify calendar renders
    const today = new Date().getDate().toString();
    const todayButton = page.locator('button').filter({ hasText: new RegExp(`^${today}$`) });
    await expect(todayButton.first()).toBeVisible();
    
    // Toggle logic (this would trigger a POST/DELETE in real life)
    await page.route('**/api/collections/attendance/records*', async route => {
      await route.fulfill({ status: 200, body: '{}' });
    });
    await todayButton.first().click();
  });

  test('village community map rendering', async ({ page }) => {
    // Navigate via dashboard button (using regex to ignore emoji)
    await page.getByRole('button', { name: /Map/ }).click();
    await expect(page).toHaveURL('/map');
    
    // Verify leaflet map container
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15000 });
    
    // Verify privacy note
    await expect(page.locator('text=Exact addresses are never shared')).toBeVisible();
  });

  test('subject portfolio grouping', async ({ page }) => {
    await page.click('text=Portfolio');
    await expect(page).toHaveURL('/portfolio');
    
    // Verify subject grouping header
    await expect(page.locator('h3:has-text("Science")')).toBeVisible();
    await expect(page.locator('text=1 Sample')).toBeVisible();
    
    // Verify card content
    await expect(page.locator('h4:has-text("Solar Project")')).toBeVisible();
  });

  test('AI Lesson Spark and Player flow', async ({ page }) => {
    await page.click('text=Manage Kids');
    await page.click('text=Vault');
    
    // Verify AI Spark button
    const sparkBtn = page.locator('button:has-text("Get AI Spark")');
    await expect(sparkBtn).toBeVisible();

    // Mock API call to generate spark
    await page.route('**/api/generate-spark', async route => {
      await route.fulfill({ 
        status: 200, 
        contentType: 'application/json',
        body: JSON.stringify({ 
          title: 'The Magic of Photosynthesis', 
          subject: 'Science', 
          grade_level: '8th Grade',
          content: { hook: 'Plants breathe sunlight!', activity: 'Watch a leaf', resources: [] },
          interactive_data: { questions: [{ id: 'q1', text: 'Energy source?', type: 'multiple-choice', options: ['Sunlight', 'Water'], answer: 'Sunlight' }] }
        }) 
      });
    });

    // Mock creation of new tailored lesson (POST)
    await page.route('**/api/collections/lessons/records', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ 
          status: 200, 
          contentType: 'application/json',
          body: JSON.stringify({ id: 'new-lesson-id' }) 
        });
      } else {
        await route.continue();
      }
    });

    // Mock fetching the new lesson (GET)
    await page.route('**/api/collections/lessons/records/new-lesson-id', async route => {
      await route.fulfill({ 
        status: 200, 
        contentType: 'application/json',
        body: JSON.stringify({ 
          id: 'new-lesson-id', 
          title: 'The Magic of Photosynthesis', 
          subject: 'Science', 
          grade_level: '8th Grade',
          content: { hook: 'Plants breathe sunlight!', activity: 'Watch a leaf', resources: [] },
          interactive_data: { questions: [{ id: 'q1', text: 'Energy source?', type: 'multiple-choice', options: ['Sunlight', 'Water'], answer: 'Sunlight' }] }
        }) 
      });
    });

    await sparkBtn.click();
    
    // Should navigate to lesson player
    await expect(page).toHaveURL(/\/lessons\/new-lesson-id/, { timeout: 15000 });
    
    // Test interactive player
    await expect(page.locator('text=Plants breathe sunlight!')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Energy source?')).toBeVisible();
    
    // Use more specific button selector and wait for state
    const optBtn = page.getByRole('button', { name: 'Sunlight', exact: true });
    await optBtn.click();
    
    const checkBtn = page.getByRole('button', { name: 'Check Answer' });
    await expect(checkBtn).toBeEnabled();
    await checkBtn.click();
    
    await expect(page.locator('text=✓')).toBeVisible();
    
    await page.getByRole('button', { name: 'Finish Lesson' }).click();
    await expect(page.locator('text=Lesson Complete!')).toBeVisible();
  });

  test('location autocomplete and coordinate capture', async ({ page }) => {
    await page.click('text=Edit Profile');
    
    // Mock OpenStreetMap Nominatim API
    await page.route('**/nominatim.openstreetmap.org/search*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ display_name: 'Chicago, Illinois, USA', lat: '41.8', lon: '-87.6' }])
      });
    });

    const locInput = page.getByPlaceholder('Location (e.g., Chicago, IL)');
    await locInput.fill('Chic');
    
    // Wait for suggestion
    await expect(page.locator('text=Chicago, Illinois, USA')).toBeVisible();
    await page.click('text=Chicago, Illinois, USA');
    
    // Input should be updated
    await expect(locInput).toHaveValue('Chicago, Illinois, USA');
  });
});

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

async function handleSetupIfNeeded(page) {
    if (page.url().includes('/setup')) {
        const zipPath = path.resolve(__dirname, '../CamporeeConfig.zip');
        if (fs.existsSync(zipPath)) {
            const fileInput = page.locator('input[type="file"]');
            await fileInput.setInputFiles(zipPath);
            await page.click('button[type="submit"]');
            await page.waitForURL('**/admin.html');
        } else {
            console.warn('CamporeeConfig.zip not found, skipping setup automation.');
        }
    }
}

test('has title', async ({ page }) => {
  await page.goto('/admin.html');
  await handleSetupIfNeeded(page);
  await expect(page).toHaveTitle(/Coyote Collator/);
});

test('admin dashboard loads', async ({ page }) => {
  await page.goto('/admin.html');
  await handleSetupIfNeeded(page);
  await expect(page.locator('h1')).toContainText('Coyote Admin');
});

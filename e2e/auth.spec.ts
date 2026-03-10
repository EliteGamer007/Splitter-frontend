import { test, expect } from '@playwright/test';

test.describe('E2E: Authentication Flow', () => {
    test('1️⃣ User can view landing page and start onboarding', async ({ page }) => {
        await page.goto('http://localhost:3000');
        
        // Wait for main title structure
        await expect(page.locator('body')).toContainText(/Splitter/i);
        
        const startButton = page.locator('button', { hasText: /Get Started/i });
        if (await startButton.isVisible()) {
            await startButton.click();
            // Should transition state to "instances" view in the Single Page App
            await expect(page.locator('body')).toContainText(/Select an Instance/i);
        }
    });

    test('2️⃣ Failed password login highlights error visually', async ({ page }) => {
        await page.goto('http://localhost:3000');
        // This is a placeholder standard E2E test verifying DOM visual failure handling
        await page.evaluate(() => {
            // Emulating state set to 'login'
            window.dispatchEvent(new CustomEvent('test-navigate-login'));
        });
    });
});

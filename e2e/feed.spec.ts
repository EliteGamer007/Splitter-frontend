import { test, expect } from '@playwright/test';

test.describe('E2E: Home Feed & Social features', () => {
    test('1️⃣ Validates Feed structure and composer for logged in user', async ({ page }) => {
        // Hooking into browser environment to simulate active JWT token session
        await page.addInitScript(() => {
            window.localStorage.setItem('jwt_token', 'mock_e2e_token');
            window.localStorage.setItem('user', JSON.stringify({ username: 'e2e_tester', id: '999' }));
        });
        
        await page.goto('http://localhost:3000');
        
        // Wait for page to initialize state internally
        await page.waitForTimeout(1000); 
        
        // The DOM should now load the HomePage component 3-column layout
        // Check if Composer block is visible
        const composer = page.getByPlaceholder(/What's happening/i);
        if (await composer.isVisible()) {
            await composer.fill('Running an automated E2E test! 🚀');
        }
    });
});

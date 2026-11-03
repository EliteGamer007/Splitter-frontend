import {test,expect} from '@playwright/test';
test('API errors appear in the real login form without a fabricated success',async({page})=>{
 await page.route('**/api/v1/**',route=>route.fulfill({status:401,json:{error:'Invalid credentials'}}));
 await page.goto('/?page=login');
 await page.getByLabel(/^Username:/).fill('disposable_fixture');
 await page.getByLabel(/^Password:/).fill('invalid-fixture-password');
 await page.getByRole('button',{name:'Sign In',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Invalid credentials');
 await expect(page.getByRole('heading',{name:'Welcome Back'})).toBeVisible();
});

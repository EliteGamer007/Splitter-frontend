import {test,expect} from '@playwright/test';
test('guest navigation, logo, URL refresh and back work without waking any backend',async({page})=>{
 const requests:string[]=[];
 await page.route('**/api/v1/**',route=>{requests.push(route.request().url());return route.fulfill({status:503,json:{error:'Fixture API asleep'}});});
 await page.goto('/');
 await expect(page.getByRole('button',{name:/get started/i}).first()).toBeVisible();
 await page.getByRole('button',{name:/get started/i}).first().click();
 await expect(page).toHaveURL(/page=signup/);
 await expect(page.getByText('Select Your Server')).toBeVisible();
 await expect(page.getByText('splitter-2',{exact:true})).toHaveCount(0);
 await page.reload();await expect(page.getByText('Select Your Server')).toBeVisible();
 await page.goBack();
 await expect(page.getByRole('button',{name:/get started/i}).first()).toBeVisible();
 await page.getByAltText('Logo',{exact:true}).first().click();
 await expect(page.getByRole('button',{name:/get started/i}).first()).toBeVisible();
 expect(requests).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('unknown URL and unauthorized privileged deep links have useful states',async({page})=>{
 await page.goto('/?page=unknown');await expect(page.getByRole('heading',{name:'Page not found'})).toBeVisible();
 await page.goto('/?page=admin');await expect(page.getByRole('heading',{name:'Welcome Back'})).toBeVisible();
});

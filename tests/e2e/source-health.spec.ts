import {test,expect} from '@playwright/test';
import {defaultPreferences} from '../../packages/core/index';
test('a failed manual check refreshes visible source health immediately',async({page})=>{
  let failed=false;
  await page.route('**/api/me',route=>route.fulfill({json:{email:'source-health@example.test'}}));
  await page.route('**/api/data',route=>route.fulfill({json:{courses:[],items:[],changes:[],preferences:defaultPreferences,sources:[{id:'test-feed',name:'Test Moodle calendar',kind:'feed',status:failed?'failed':'connected',last_attempt:new Date().toISOString(),last_success:new Date().toISOString(),error:failed?'Source unavailable. Previous records retained.':null,imported_count:0}]}}));
  await page.route('**/api/sources/test-feed/sync',async route=>{failed=true;await route.fulfill({status:502,json:{error:'Calendar check failed. Previous information may be outdated.'}});});
  await page.goto('/');await page.getByRole('navigation').getByRole('button',{name:'Sources',exact:true}).click();
  await expect(page.locator('.source-state')).toHaveText('Checked');await page.getByRole('button',{name:'Check now'}).click();await expect(page.locator('.source-state')).toHaveText('Check failed');await expect(page.getByText('0 of 1 sources checked within the last hour.')).toBeVisible();
});

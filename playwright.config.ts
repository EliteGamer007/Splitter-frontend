import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'./__tests__/e2e', fullyParallel:false, timeout:30000,
 use:{baseURL:'http://127.0.0.1:3017',trace:'retain-on-failure'},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['Pixel 7']}}],
 webServer:{command:'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3017',url:'http://127.0.0.1:3017',reuseExistingServer:!process.env.CI,timeout:120000,env:{NEXT_PUBLIC_INSTANCE_1_URL:'http://127.0.0.1:18000/api/v1',NEXT_PUBLIC_API_URL:'http://127.0.0.1:18000/api/v1',NEXT_PUBLIC_INSTANCE_2_URL:''}}
});

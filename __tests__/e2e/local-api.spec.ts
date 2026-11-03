import {test,expect} from '@playwright/test';
import {generateKeyPairSync,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
const api='http://127.0.0.1:18000/api/v1';
const password='Local-QA-only-2026!';
async function account(request:any,prefix:string) {
 const cache=`.cache/browser-live/fixture-${prefix}.json`;
 if(existsSync(cache)){const saved=JSON.parse(readFileSync(cache,'utf8'));const login=await request.post(`${api}/auth/login`,{data:{username:saved.username,password}});if(login.ok()){const value={...saved,...await login.json()};writeFileSync(cache,JSON.stringify(value));return value;}}
 const enc=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const ed=generateKeyPairSync('ed25519');
 const pub=ed.publicKey.export({format:'der',type:'spki'}).subarray(-32);
 const seed=ed.privateKey.export({format:'der',type:'pkcs8'}).subarray(-32);
 const keys={public_key:pub.toString('base64'),private_key:Buffer.concat([seed,pub]).toString('hex'),did:`did:key:qa${randomUUID()}`,encryption_public_key:enc.publicKey.export({format:'der',type:'spki'}).toString('base64'),encryption_private_key:enc.privateKey.export({format:'der',type:'pkcs8'}).toString('base64')};
 const username=`qa_${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random()*1000)}`;
 const r=await request.post(`${api}/auth/register`,{data:{username,email:`${username}@fixture.invalid`,password,display_name:username,did:keys.did,public_key:keys.public_key,encryption_public_key:keys.encryption_public_key}});
 expect(r.status(),await r.text()).toBe(201);const value={...await r.json(),keys,username};mkdirSync('.cache/browser-live',{recursive:true});writeFileSync(cache,JSON.stringify(value));return value;
}
async function install(page:any,acct:any,withToken=true){await page.addInitScript(({acct,api,withToken}:any)=>{localStorage.setItem('splitter_api_base',api);localStorage.setItem('splitter_instance','splitter-1');localStorage.setItem('user',JSON.stringify(acct.user));localStorage.setItem(`splitter:v2:${encodeURIComponent(new URL(api).origin)}:${encodeURIComponent(acct.user.id)}:keys`,JSON.stringify(acct.keys));localStorage.setItem('homepage-walkthrough-completed','true');if(withToken)localStorage.setItem('jwt_token',acct.token);},{acct,api,withToken});}
test.describe('Disposable local API browser verification',()=>{
 test.skip(process.env.LOCAL_API_E2E!=='1','Requires explicitly started disposable local API');
 test('password login, post, reply, like, locked follow approval, encrypted DM, security and every page',async({page,request,browser},info)=>{
  test.setTimeout(150000);
  const a=await account(request,`${info.project.name}_a`),b=await account(request,`${info.project.name}_b`);
  const artifact=`.cache/browser-live/${info.project.name}`;mkdirSync(artifact,{recursive:true});writeFileSync(`${artifact}/accounts.json`,JSON.stringify({alice:{id:a.user.id,username:a.username},bob:{id:b.user.id,username:b.username}},null,2));
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await install(page,a,false);await page.goto('/?page=login');
  await page.getByLabel(/^Username:/).fill(a.username);await page.getByLabel(/^Password:/).fill(password);await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page.getByPlaceholder('Share your thoughts with the federated network...')).toBeVisible();
  await page.screenshot({path:`${artifact}/home.png`,fullPage:true});
  const content=`Local browser post ${info.project.name} ${Date.now()}`;
  await page.getByPlaceholder('Share your thoughts with the federated network...').fill(content);
  const postResponse=page.waitForResponse(r=>r.url()===`${api}/posts`&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Post',exact:true}).click();const postResult=await postResponse;expect(postResult.status()).toBe(201);const post=await postResult.json();const postId=post.id||post.post?.id;
  await expect(page.getByText(content,{exact:true})).toBeVisible();
  await page.getByTitle('Like this post').first().click();await expect(page.getByTitle('Unlike').first()).toBeVisible();
  await page.goto(`/?page=thread&postId=${postId}`);await expect(page.getByText(content,{exact:true})).toBeVisible();
  await page.locator('textarea.reply-textarea').fill('Local browser reply');await page.getByRole('button',{name:'Reply',exact:true}).click();await expect(page.getByText('Local browser reply',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('Local browser reply',{exact:true})).toBeVisible();await page.screenshot({path:`${artifact}/thread.png`,fullPage:true});
  await request.delete(`${api}/users/${b.user.id}/follow`,{headers:{Authorization:`Bearer ${a.token}`}});
  expect((await request.put(`${api}/users/me`,{headers:{Authorization:`Bearer ${b.token}`},data:{display_name:b.username,bio:'Local QA',account_locked:true,message_privacy:'everyone',default_visibility:'followers'}})).ok()).toBe(true);
  await page.goto(`/?page=profile&userId=${b.user.id}`);await page.getByRole('button',{name:'Follow',exact:true}).click();await expect(page.getByRole('button',{name:'Request pending',exact:true})).toBeVisible();
  const bc=await browser.newContext({viewport:page.viewportSize()!});const bp=await bc.newPage();await install(bp,b);await bp.goto('http://127.0.0.1:3017/?page=profile');await expect(bp.getByRole('heading',{name:'Follow requests'})).toBeVisible();await bp.getByRole('button',{name:'Accept',exact:true}).click();await expect(bp.getByText('No pending requests')).toBeVisible();await bc.close();
  expect((await request.post(`${api}/messages/conversation/${b.user.id}`,{headers:{Authorization:`Bearer ${a.token}`}})).ok()).toBe(true);
  await page.goto('/?page=dm');await expect(page.getByPlaceholder('Type an encrypted message...')).toBeVisible();const secret=`Private browser DM ${info.project.name}`;await page.getByPlaceholder('Type an encrypted message...').fill(secret);
  const sent=page.waitForResponse(r=>r.url().endsWith('/messages/send')&&r.request().method()==='POST');await page.getByTitle('Send encrypted').click();const sentResponse=await sent;expect(sentResponse.ok()).toBe(true);const wire=sentResponse.request().postDataJSON();expect(wire.content).toBe('');expect(wire.ciphertext).toBeTruthy();expect(JSON.stringify(wire)).not.toContain(secret);await expect(page.getByText(secret,{exact:true})).toBeVisible();await page.screenshot({path:`${artifact}/dm.png`,fullPage:true});
  for(const target of ['profile','security','trending','hashtag&hashtag=qa','federation','moderation','admin','instances']){
   await page.goto(`/?page=${target}`);await expect(page.locator('body')).not.toBeEmpty();await expect(page.getByText('Loading Splitter...')).toHaveCount(0);await page.screenshot({path:`${artifact}/${target.split('&')[0]}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),target).toBe(true);
  }
  expect(errors).toEqual([]);
 });
});
 test('authenticated mobile layout fits its viewport and keeps floating tools above navigation',async({page},info)=>{
  test.skip(process.env.LOCAL_API_E2E!=='1' || info.project.name!=='mobile');
  const a=JSON.parse(readFileSync('.cache/browser-live/fixture-mobile_a.json','utf8'));await install(page,a);await page.goto('/?page=home');await expect(page.getByPlaceholder('Share your thoughts with the federated network...')).toBeVisible();await page.locator('.post-content').first().waitFor();
  const geometry=await page.evaluate(()=>({width:innerWidth,visual:visualViewport?.width,body:document.body.getBoundingClientRect().width,overflow:[...document.querySelectorAll('*')].map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right,left:e.getBoundingClientRect().left,position:getComputedStyle(e).position})).filter(x=>x.right>innerWidth+1||x.left< -1).slice(0,30)}));
  writeFileSync('.cache/browser-live/mobile/geometry.json',JSON.stringify(geometry,null,2));
  const shot=await page.screenshot({path:'.cache/browser-live/mobile/home-with-post-dark.png',fullPage:true,scale:'css'});expect(shot.readUInt32BE(16)).toBe(page.viewportSize()!.width);
  const replay=page.getByTitle('Replay walkthrough');const compose=page.getByRole('button',{name:'Compose post'});const nav=page.locator('.mobile-bottom-nav');if(await replay.isVisible()){expect((await replay.boundingBox())!.y+(await replay.boundingBox())!.height).toBeLessThanOrEqual((await nav.boundingBox())!.y);}
  await page.getByRole('button',{name:'Toggle color theme'}).click();await expect(page.locator('.composer-textarea')).toHaveCSS('background-color','rgb(252, 242, 236)');await page.screenshot({path:'.cache/browser-live/mobile/home-with-post-light.png',fullPage:true,scale:'css'});
 });

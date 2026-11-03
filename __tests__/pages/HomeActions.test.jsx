import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import HomePage from '@/components/pages/HomePage';
jest.mock('@/components/ui/theme-provider',()=>({useTheme:()=>({theme:'dark',toggleTheme:jest.fn()})}));
beforeEach(()=>{localStorage.clear();localStorage.setItem('jwt_token','fixture');localStorage.setItem('user',JSON.stringify({id:'alice'}));localStorage.setItem('splitter_api_base','https://fixture.example/api/v1');global.fetch=jest.fn(async(input)=>{
 const u=String(input);let data={};
 if(u.includes('/posts/feed'))data=[{id:'post',author_id:'bob',username:'bob',content:'A fixture post',created_at:new Date().toISOString(),like_count:0}];
 else if(u.includes('/following'))data=[];else if(u.includes('/stats'))data={followers:0,following:0};else if(u.includes('/stories'))data={stories:[]};else if(u.includes('trending'))data={hashtags:[]};
 return {ok:true,status:200,json:async()=>data};});});
test('like and repost controls execute backend writes in the real feed',async()=>{
 render(<HomePage userData={{id:'alice',username:'alice'}} isAuthenticated onNavigate={jest.fn()}/>);
 fireEvent.click(await screen.findByTitle('Like this post'));
 await waitFor(()=>expect(fetch.mock.calls.some(([u,o])=>String(u).endsWith('/posts/post/like')&&o.method==='POST')).toBe(true));
 fireEvent.click(screen.getByTitle('Repost to your followers'));
 await waitFor(()=>expect(fetch.mock.calls.some(([u,o])=>String(u).endsWith('/posts/post/repost')&&o.method==='POST')).toBe(true));
});
test('later feed posts remain reachable through a user-triggered bounded page',async()=>{
 const original=fetch;
 global.fetch=jest.fn(async(input,options)=>{const u=String(input);if(u.includes('/posts/feed'))return {ok:true,status:200,json:async()=>u.includes('offset=20')?[{id:'later',username:'bob',content:'A later post',created_at:new Date().toISOString()}]:Array.from({length:20},(_,i)=>({id:`first-${i}`,username:'bob',content:`First page ${i}`,created_at:new Date().toISOString()}))};return original(input,options);});
 render(<HomePage userData={{id:'alice',username:'alice'}} isAuthenticated onNavigate={jest.fn()}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Load more posts'}));
 expect(await screen.findByText('A later post')).toBeInTheDocument();expect(screen.getByText('First page 0')).toBeInTheDocument();
});

import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import SecurityPage from '@/components/pages/SecurityPage';
jest.mock('@/components/ui/theme-provider',()=>({useTheme:()=>({theme:'dark',toggleTheme:jest.fn()})}));
beforeEach(()=>{localStorage.clear();localStorage.setItem('splitter_api_base','https://fixture.example/api/v1');localStorage.setItem('user',JSON.stringify({id:'alice'}));localStorage.setItem('jwt_token','fixture');window.alert=jest.fn();global.fetch=jest.fn(async()=>({ok:true,status:200,json:async()=>({id:'alice',is_locked:true})}));});
test('locked-account privacy save uses the backend account_locked request field',async()=>{render(<SecurityPage userData={{id:'alice',username:'alice',account_locked:true}} onNavigate={jest.fn()} updateUserData={jest.fn()}/>);fireEvent.click(screen.getByRole('button',{name:/Save Privacy Settings/i}));await waitFor(()=>expect(fetch.mock.calls.some(([,o])=>o.method==='PUT'&&JSON.parse(o.body).account_locked===true)).toBe(true));});

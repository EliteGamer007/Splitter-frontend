import '@testing-library/jest-dom';
import React from 'react';
import {render,screen,waitFor,act} from '@testing-library/react';
import ProtectedImage from '@/components/ui/ProtectedImage';
beforeEach(()=>{localStorage.clear();localStorage.setItem('splitter_api_base','https://fixture.example/api/v1');localStorage.setItem('user',JSON.stringify({id:'alice'}));localStorage.setItem('jwt_token','fixture-token');URL.createObjectURL=jest.fn(()=> 'blob:fixture');URL.revokeObjectURL=jest.fn();global.fetch=jest.fn(async()=>({ok:true,blob:async()=>new Blob(['image'])})) as any;});
test('private local media uses bearer fetch and revokes decrypted session blobs on logout',async()=>{
 render(<ProtectedImage src="https://fixture.example/api/v1/media/id" alt="Private photo"/>);
 await waitFor(()=>expect(screen.getByAltText('Private photo')).toHaveAttribute('src','blob:fixture'));
 expect(fetch).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({headers:expect.objectContaining({Authorization:'Bearer fixture-token'})}));
 act(()=>window.dispatchEvent(new Event('splitter:logout')));expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fixture');
});
test('remote images never receive a session token',()=>{render(<ProtectedImage src="https://remote.example/api/v1/media/id" alt="Public remote"/>);expect(fetch).not.toHaveBeenCalled();expect(screen.getByAltText('Public remote')).toHaveAttribute('src','https://remote.example/api/v1/media/id');});

test('frontend branding stays on the frontend origin',()=>{
 render(<ProtectedImage src="/splitter.png" alt="Logo"/>);
 expect(screen.getByAltText('Logo')).toHaveAttribute('src','/splitter.png');
 expect(fetch).not.toHaveBeenCalled();
});

test('locked-account story media uses authenticated retrieval at the selected API',async()=>{
 render(<ProtectedImage src="/api/v1/stories/story-id/media" alt="Private story"/>);
 await waitFor(()=>expect(screen.getByAltText('Private story')).toHaveAttribute('src','blob:fixture'));
 expect(fetch).toHaveBeenCalledWith('https://fixture.example/api/v1/stories/story-id/media',expect.objectContaining({headers:expect.objectContaining({Authorization:'Bearer fixture-token'})}));
});

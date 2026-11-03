import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {webcrypto} from 'node:crypto';
import DMPage from '@/components/pages/DMPage';
import {generateEncryptionKeyPair,storeKeyPair,deriveSharedSecret,decryptMessage} from '@/lib/crypto';
jest.mock('@/components/ui/theme-provider',()=>({useTheme:()=>({theme:'dark',toggleTheme:jest.fn()})}));
let alice:any,bob:any,writes:any[],storedMessages:any[];
const thread = ()=>({id:'thread',participant_a_id:'alice',participant_b_id:'bob',other_user:{id:'bob',username:'bob',encryption_public_key:bob.encryptionPublicKeyBase64},participant_a:{id:'alice',username:'alice'},participant_b:{id:'bob',username:'bob',encryption_public_key:bob.encryptionPublicKeyBase64}});
beforeAll(()=>{Object.defineProperty(window,'crypto',{value:webcrypto,configurable:true});HTMLElement.prototype.scrollIntoView=jest.fn();});
beforeEach(async()=>{
 localStorage.clear(); localStorage.setItem('splitter_api_base','https://fixture.example/api/v1'); localStorage.setItem('jwt_token','local-fixture'); localStorage.setItem('user',JSON.stringify({id:'alice'}));
 alice=await generateEncryptionKeyPair();bob=await generateEncryptionKeyPair(); writes=[];storedMessages=[];
 global.fetch=jest.fn(async(input:any,options:any={})=>{
  const url=String(input).split('?')[0];let data:any={};
  if(url.endsWith('/users/me'))data={id:'alice',encryption_public_key:alice.encryptionPublicKeyBase64};
  else if(url.endsWith('/messages/threads'))data={threads:[thread()]};
  else if(url.includes('/messages/threads/thread'))data={messages:storedMessages,thread:thread()};
  else if(url.endsWith('/users/bob'))data={id:'bob',encryption_public_key:bob.encryptionPublicKeyBase64};
  else if(url.endsWith('/messages/send')){const body=JSON.parse(options.body);writes.push(body);const msg={...body,id:'msg',sender_id:'alice',created_at:new Date().toISOString()};storedMessages=[msg];data={message:msg};}
  else if(url.endsWith('/messages/msg')&&options.method==='PUT'){const body=JSON.parse(options.body);writes.push(body);storedMessages=[{...storedMessages[0],...body}];data={message:'updated'};}
  return {ok:true,status:200,json:async()=>data} as Response;
 });
});
test('fresh device cannot send while its existing key is missing and never overwrites it',async()=>{
 const alert=jest.spyOn(window,'alert').mockImplementation(()=>{});
 render(<DMPage selectedUser={null} userData={{id:'alice'}} onNavigate={jest.fn()}/>);
 await screen.findByText(/Device key mismatch/);
 fireEvent.change(screen.getByPlaceholderText('Type a message...'),{target:{value:'secret'}});
 fireEvent.click(screen.getByRole('button',{name:'Send'}));
 await waitFor(()=>expect(alert).toHaveBeenCalled());
 expect(writes).toEqual([]);expect((fetch as jest.Mock).mock.calls.some(([u])=>String(u).includes('encryption-key'))).toBe(false);
 alert.mockRestore();
});
test('real conversation encrypts send and edit without wire plaintext',async()=>{
 storeKeyPair({did:'did:fixture',publicKeyBase64:'',privateKeyBase64:'',...alice} as any);
 render(<DMPage selectedUser={null} userData={{id:'alice'}} onNavigate={jest.fn()}/>);
 const input=await screen.findByPlaceholderText('Type an encrypted message...');
 fireEvent.change(input,{target:{value:'a private message'}});fireEvent.click(screen.getByTitle('Send encrypted'));
 await screen.findByTitle('Edit (within 3 hours)');
 expect(writes[0].content).toBe('');expect(JSON.stringify(writes[0])).not.toContain('a private message');
 fireEvent.click(screen.getByTitle('Edit (within 3 hours)'));
 const edit=screen.getAllByRole('textbox').find(e=>(e as HTMLTextAreaElement).value==='a private message')!;
 fireEvent.change(edit,{target:{value:'edited private message'}});fireEvent.click(screen.getByRole('button',{name:'Save'}));
 await waitFor(()=>expect(writes).toHaveLength(2));expect(writes[1].content).toBe('');
 const secret=await deriveSharedSecret(bob.encryptionPrivateKey,alice.encryptionPublicKey);
 const {c,iv}=JSON.parse(writes[1].ciphertext);expect(await decryptMessage(c,iv,secret)).toBe('edited private message');
});

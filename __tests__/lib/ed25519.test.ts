import {webcrypto} from 'node:crypto';
import {generateKeyPairFromSeed,sign} from '@/lib/ed25519-browser';
beforeAll(()=>Object.defineProperty(window,'crypto',{value:webcrypto,configurable:true}));
const hex=(s:string)=>new Uint8Array(Buffer.from(s,'hex'));
test('RFC 8032 Ed25519 vector 1 produces the interoperable public key and signature',async()=>{
 const keys=await generateKeyPairFromSeed(hex('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60'));
 expect(Buffer.from(keys.publicKey).toString('hex')).toBe('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');
 expect(Buffer.from(await sign(new Uint8Array(),keys.secretKey)).toString('hex')).toBe('e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b');
});

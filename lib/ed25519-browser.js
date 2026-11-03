// Standard Ed25519 via the browser's Web Crypto implementation.
// Existing callers use the NaCl-compatible 64-byte secret format (seed || public).
const pkcs8Prefix = new Uint8Array([0x30,0x2e,0x02,0x01,0x00,0x30,0x05,0x06,0x03,0x2b,0x65,0x70,0x04,0x22,0x04,0x20]);
async function privateKeyFromSeed(seed) {
 if (!(seed instanceof Uint8Array) || seed.length !== 32) throw new Error('An Ed25519 seed must contain 32 bytes');
 const der = new Uint8Array(pkcs8Prefix.length + seed.length);der.set(pkcs8Prefix);der.set(seed,pkcs8Prefix.length);
 return crypto.subtle.importKey('pkcs8',der,{name:'Ed25519'},true,['sign']);
}
function decodeBase64Url(value) {
 const raw = atob(value.replace(/-/g,'+').replace(/_/g,'/'));
 return Uint8Array.from(raw,c => c.charCodeAt(0));
}
export async function generateKeyPairFromSeed(seed) {
 const privateKey=await privateKeyFromSeed(seed);
 const jwk=await crypto.subtle.exportKey('jwk',privateKey);
 const publicKey=decodeBase64Url(jwk.x);
 const secretKey=new Uint8Array(64);secretKey.set(seed);secretKey.set(publicKey,32);
 return {publicKey,secretKey};
}
export async function generateKeyPair() {return generateKeyPairFromSeed(crypto.getRandomValues(new Uint8Array(32)));}
export async function sign(message,secretKey) {
 if (!(secretKey instanceof Uint8Array) || secretKey.length !== 64) throw new Error('An Ed25519 signing secret must contain 64 bytes');
 const seed=secretKey.slice(0,32);const pair=await generateKeyPairFromSeed(seed);
 if (!pair.publicKey.every((value,index)=>value===secretKey[index+32])) throw new Error('Stored signing keys do not match. Use password login and recover your signing key.');
 return new Uint8Array(await crypto.subtle.sign({name:'Ed25519'},await privateKeyFromSeed(seed),message));
}

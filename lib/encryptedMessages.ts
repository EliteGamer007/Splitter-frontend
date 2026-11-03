import { encryptMessage } from './crypto';
export async function encryptedPayload(text: string, key: CryptoKey | null) {
 if (!key) throw new Error('Encryption keys are unavailable. Recover your keys or wait for the conversation to be ready.');
 const {ciphertext,iv} = await encryptMessage(text,key);
 return {content:'',ciphertext:JSON.stringify({c:ciphertext,iv})};
}

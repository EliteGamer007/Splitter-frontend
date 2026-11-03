import { scopedStorageKey, clearSessionData } from '@/lib/browserState';
import { ensureEncryptionKeys, exportRecoveryFile, generateEncryptionKeyPair, deriveSharedSecret, encryptMessage, decryptMessage } from '@/lib/crypto';
import { encryptedPayload } from '@/lib/encryptedMessages';
import { webcrypto } from 'node:crypto';

beforeAll(() => { Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true }); });
beforeEach(() => { localStorage.clear(); localStorage.setItem('splitter_api_base', 'https://one.example/api/v1'); localStorage.setItem('user', JSON.stringify({id:'alice'})); });
test('account and backend scope private browser state', () => {
 const alice = scopedStorageKey('timeline');
 localStorage.setItem('user', JSON.stringify({id:'bob'}));
 expect(scopedStorageKey('timeline')).not.toBe(alice);
 localStorage.setItem('splitter_api_base', 'https://two.example/api/v1');
 expect(scopedStorageKey('timeline')).not.toContain('one.example');
});
test('logout clears private caches while retaining recovery keys', () => {
 const key = scopedStorageKey('keys'); const cache = scopedStorageKey('timeline');
 localStorage.setItem(key,'secret'); localStorage.setItem(cache,'private post'); clearSessionData();
 expect(localStorage.getItem(cache)).toBeNull(); expect(localStorage.getItem(key)).toBe('secret');
});
test('fresh device never generates keys over existing server keys', async () => {
 await expect(ensureEncryptionKeys({id:'alice',encryption_public_key:'existing'})).rejects.toThrow(/recover|device|key/i);
 expect(localStorage.getItem('encryption_private_key')).toBeNull();
});
test('weak recovery export fails explicitly before creating a file', async () => {
 await expect(exportRecoveryFile({} as any,'alice','one','weak')).rejects.toThrow(/passphrase/i);
});
test('encrypted send fails closed and roundtrips without wire plaintext', async () => {
 await expect(encryptedPayload('private',null)).rejects.toThrow(/key|encryption/i);
 const a = await generateEncryptionKeyPair(); const b = await generateEncryptionKeyPair();
 const ab = await deriveSharedSecret(a.encryptionPrivateKey,b.encryptionPublicKey);
 const ba = await deriveSharedSecret(b.encryptionPrivateKey,a.encryptionPublicKey);
 const payload = await encryptedPayload('private',ab);
 expect(payload.content).toBe(''); expect(JSON.stringify(payload)).not.toContain('private');
 const {c,iv} = JSON.parse(payload.ciphertext); expect(await decryptMessage(c,iv,ba)).toBe('private');
});

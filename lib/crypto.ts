// This runs in the browser using Web Crypto API and a custom Ed25519 utility
import { generateKeyPair as generateEdKeyPair, sign as signEd } from './ed25519-browser';

export interface KeyPair {
  publicKey: CryptoKey | Uint8Array | null;
  privateKey: CryptoKey | Uint8Array | null | any;
  publicKeyBase64: string;
  privateKeyBase64: string;
  did: string;
  // Encryption keys (ECDH)
  encryptionPublicKey?: CryptoKey;
  encryptionPrivateKey?: CryptoKey;
  encryptionPublicKeyBase64?: string;
  encryptionPrivateKeyBase64?: string;
}

interface RecoveryFileV2 {
  version: 2;
  encrypted: true;
  algorithm: 'AES-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  checksum: string;
}

// Generate a new Ed25519 keypair for DID and P-256 for encryption
export async function generateKeyPair(): Promise<KeyPair> {
  // Generate Signing Keypair (Ed25519) using custom browser utility for raw key support
  const edKeyPair = await generateEdKeyPair();

  const signPublicKeyBase64 = uint8ArrayToBase64(edKeyPair.publicKey);
  // Store secretKey (64 bytes) as hex to match SecurityPage.jsx standard
  const signPrivateKeyHex = Array.from(edKeyPair.secretKey).map(b => b.toString(16).padStart(2, '0')).join('');

  // Generate DID from signing public key
  const did = await generateDID(signPublicKeyBase64);

  // Generate Encryption Keypair (ECDH P-256)
  const encKeyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );

  const encPublicKeyBuffer = await window.crypto.subtle.exportKey('spki', encKeyPair.publicKey);
  const encPublicKeyBase64 = bufferToBase64(encPublicKeyBuffer);

  const encPrivateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', encKeyPair.privateKey);
  const encPrivateKeyBase64 = bufferToBase64(encPrivateKeyBuffer);

  return {
    publicKey: edKeyPair.publicKey,
    privateKey: edKeyPair.secretKey,
    publicKeyBase64: signPublicKeyBase64,
    privateKeyBase64: signPrivateKeyHex,
    did,
    encryptionPublicKey: encKeyPair.publicKey,
    encryptionPrivateKey: encKeyPair.privateKey,
    encryptionPublicKeyBase64: encPublicKeyBase64,
    encryptionPrivateKeyBase64: encPrivateKeyBase64,
  };
}

// Generate DID from public key
async function generateDID(publicKeyBase64: string): Promise<string> {
  // Create a simple DID:key from the public key
  const hash = await hashString(publicKeyBase64);
  return `did:key:z6Mk${hash.substring(0, 40)}`;
}

// Sign a challenge with private key (Ed25519)
export async function signChallenge(privateKey: Uint8Array | string, challenge: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(challenge);

  let keyBytes: Uint8Array;
  if (typeof privateKey === 'string') {
    keyBytes = await importPrivateKey(privateKey);
  } else {
    keyBytes = privateKey;
  }

  const signature = await signEd(data, keyBytes);
  return uint8ArrayToBase64(signature);
}

// Import a private key (Ed25519) — handles both Hex (SecurityPage) and Base64
export async function importPrivateKey(keyString: string): Promise<Uint8Array> {
  // Check if it's hex (128 chars for 64-byte Ed25519 secret key)
  if (/^[0-9a-fA-F]{128}$/.test(keyString)) {
    const bytes = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      bytes[i] = parseInt(keyString.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  // Otherwise assume Base64
  try {
    const buffer = base64ToBuffer(keyString);
    return new Uint8Array(buffer);
  } catch (e) {
    console.error('Failed to decode private key as hex or base64');
    throw new Error('Invalid private key format');
  }
}

// Import Encryption Private Key (ECDH)
export async function importEncryptionPrivateKey(base64Key: string): Promise<CryptoKey> {
  const buffer = base64ToBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    'pkcs8',
    buffer,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );
}

// Import Encryption Public Key (ECDH)
export async function importEncryptionPublicKey(base64Key: string): Promise<CryptoKey> {
  const buffer = base64ToBuffer(base64Key);
  return await window.crypto.subtle.importKey(
    'spki',
    buffer,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    [] // Public key doesn't need usages for import, but for deriveKey it will be used as public
  );
}

// Derive Shared Secret (AES-GCM Key)
export async function deriveSharedSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  return await window.crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: publicKey,
    },
    privateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable (maybe false is better for security, but we might need to export/debug)
    ['encrypt', 'decrypt']
  );
}

// Encrypt Message
export async function encryptMessage(text: string, sharedKey: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    sharedKey,
    data
  );

  return {
    ciphertext: bufferToBase64(ciphertextBuffer),
    iv: bufferToBase64(iv.buffer),
  };
}

// Decrypt Message
export async function decryptMessage(ciphertext: string, iv: string, sharedKey: CryptoKey): Promise<string> {
  const ciphertextBuffer = base64ToBuffer(ciphertext);
  const ivBuffer = base64ToBuffer(iv);

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(ivBuffer),
      },
      sharedKey,
      ciphertextBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt message');
  }
}

async function deriveRecoveryKey(passphrase: string, saltBuffer: ArrayBuffer): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passphraseKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(saltBuffer),
      iterations: 210000,
      hash: 'SHA-256',
    },
    passphraseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function assertRecoveryDataIntegrity(recoveryData: any): void {
  const required = ['did', 'public_key', 'private_key', 'username', 'server', 'timestamp'];
  for (const key of required) {
    if (!recoveryData[key] || typeof recoveryData[key] !== 'string') {
      throw new Error(`Recovery file missing required field: ${key}`);
    }
  }

  if (!recoveryData.did.startsWith('did:')) {
    throw new Error('Invalid DID in recovery file');
  }

  if (!recoveryData.public_key || !recoveryData.private_key) {
    throw new Error('Recovery file keys are incomplete');
  }
}


// Helper: Convert Uint8Array to Base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Convert ArrayBuffer to Base64 (legacy name)
function bufferToBase64(buffer: ArrayBuffer): string {
  return uint8ArrayToBase64(new Uint8Array(buffer));
}

// Helper: Convert Base64 to ArrayBuffer
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Helper: Hash a string
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return bufferToBase64(hashBuffer);
}

// Store keypair in localStorage
export function storeKeyPair(keyPair: KeyPair): void {
  // Store private_key in the format it came in (Hex for Ed25519 if it was generated/rotated in SecurityPage)
  // or use the base64 string provided in the KeyPair object.
  const sk = keyPair.privateKeyBase64; // This might actually be hex now, but we keep the name for compatibility
  localStorage.setItem('private_key', sk);
  localStorage.setItem('public_key', keyPair.publicKeyBase64);
  localStorage.setItem('did', keyPair.did);

  if (keyPair.encryptionPrivateKeyBase64 && keyPair.encryptionPublicKeyBase64) {
    localStorage.setItem('encryption_private_key', keyPair.encryptionPrivateKeyBase64);
    localStorage.setItem('encryption_public_key', keyPair.encryptionPublicKeyBase64);
  }
}

// Retrieve keypair from localStorage
export async function loadKeyPair(): Promise<KeyPair | null> {
  const privateKeyBase64 = localStorage.getItem('private_key');
  const publicKeyBase64 = localStorage.getItem('public_key');
  const did = localStorage.getItem('did');

  const encryptionPrivateKeyBase64 = localStorage.getItem('encryption_private_key');
  const encryptionPublicKeyBase64 = localStorage.getItem('encryption_public_key');

  if (!privateKeyBase64 || !publicKeyBase64 || !did) {
    return null;
  }

  try {
    const privateKey = await importPrivateKey(privateKeyBase64);

    let encryptionPrivateKey: CryptoKey | undefined;
    let encryptionPublicKey: CryptoKey | undefined;

    if (encryptionPrivateKeyBase64) {
      encryptionPrivateKey = await importEncryptionPrivateKey(encryptionPrivateKeyBase64);
    }
    // Note: encryptionPublicKey is typically not needed for *our* operations (we need private to decrypt, and others' public to encrypt), 
    // but generating shared secret with OUR public key doesn't make sense unless self-sending. 
    // We strictly need our private key and *their* public key. 
    // But for completeness and structure, we load it if we need to export it. Maybe.
    // Actually, storeKeyPair stores it, so might as well load it.
    if (encryptionPublicKeyBase64) {
      encryptionPublicKey = await importEncryptionPublicKey(encryptionPublicKeyBase64);
    }

    return {
      privateKey,
      publicKey: null,
      publicKeyBase64,
      privateKeyBase64,
      did,
      encryptionPrivateKey,
      encryptionPublicKey,
      encryptionPrivateKeyBase64: encryptionPrivateKeyBase64 || undefined,
      encryptionPublicKeyBase64: encryptionPublicKeyBase64 || undefined,
    };
  } catch (error) {
    console.error('Failed to load keypair:', error);
    return null;
  }
}

// Export recovery file
export async function exportRecoveryFile(keyPair: KeyPair, username: string, server: string, passphrase?: string): Promise<void> {
  const recoveryData = {
    did: keyPair.did,
    public_key: keyPair.publicKeyBase64,
    private_key: keyPair.privateKeyBase64,
    encryption_public_key: keyPair.encryptionPublicKeyBase64,
    encryption_private_key: keyPair.encryptionPrivateKeyBase64,
    username,
    server,
    timestamp: new Date().toISOString(),
    warning: 'KEEP THIS FILE SECURE! Anyone with this file can access your account.',
  };

  assertRecoveryDataIntegrity(recoveryData);

  let dataStr = JSON.stringify(recoveryData, null, 2);

  if (passphrase && passphrase.trim().length >= 8) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveRecoveryKey(passphrase.trim(), salt.buffer);
    const plaintext = new TextEncoder().encode(dataStr);
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plaintext
    );

    const checksum = await hashString(dataStr);
    const encryptedFile: RecoveryFileV2 = {
      version: 2,
      encrypted: true,
      algorithm: 'AES-GCM',
      kdf: 'PBKDF2-SHA256',
      iterations: 210000,
      salt: bufferToBase64(salt.buffer),
      iv: bufferToBase64(iv.buffer),
      ciphertext: bufferToBase64(ciphertext),
      checksum,
    };
    dataStr = JSON.stringify(encryptedFile, null, 2);
  }

  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `splitter-recovery-${username}-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Clear stored keys (logout)
export function clearStoredKeys(): void {
  localStorage.removeItem('private_key');
  localStorage.removeItem('public_key');
  localStorage.removeItem('did');
  localStorage.removeItem('encryption_private_key');
  localStorage.removeItem('encryption_public_key');
  localStorage.removeItem('jwt_token');
}

// Alias for loadKeyPair (for backward compatibility)
export const getStoredKeyPair = loadKeyPair;

// Import recovery file
export async function importRecoveryFile(file: File, passphrase?: string): Promise<KeyPair> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        let recoveryData: any = JSON.parse(content);

        if (recoveryData?.encrypted === true && recoveryData?.version === 2) {
          const envelopeChecksum = recoveryData.checksum;
          if (!passphrase || passphrase.trim().length < 8) {
            throw new Error('Recovery file is encrypted. A valid passphrase is required.');
          }

          const saltBuffer = base64ToBuffer(recoveryData.salt || '');
          const ivBuffer = base64ToBuffer(recoveryData.iv || '');
          const cipherBuffer = base64ToBuffer(recoveryData.ciphertext || '');
          const key = await deriveRecoveryKey(passphrase.trim(), saltBuffer);
          const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
            key,
            cipherBuffer
          );
          const decryptedJson = new TextDecoder().decode(decrypted);
          recoveryData = JSON.parse(decryptedJson);

          if (envelopeChecksum) {
            const checksum = await hashString(JSON.stringify(recoveryData, null, 2));
            if (checksum !== envelopeChecksum) {
              throw new Error('Recovery file integrity check failed');
            }
          }
        }

        assertRecoveryDataIntegrity(recoveryData);

        if (!recoveryData.private_key || !recoveryData.public_key || !recoveryData.did) {
          throw new Error('Invalid recovery file format');
        }

        const privateKey = await importPrivateKey(recoveryData.private_key);
        let encryptionPrivateKey: CryptoKey | undefined;

        if (recoveryData.encryption_private_key) {
          encryptionPrivateKey = await importEncryptionPrivateKey(recoveryData.encryption_private_key);
        }

        const keyPair: KeyPair = {
          privateKey,
          publicKey: null as any,
          publicKeyBase64: recoveryData.public_key,
          privateKeyBase64: recoveryData.private_key,
          did: recoveryData.did,
          encryptionPrivateKey,
          encryptionPrivateKeyBase64: recoveryData.encryption_private_key,
          encryptionPublicKeyBase64: recoveryData.encryption_public_key,
        };

        // Store the imported keys
        storeKeyPair(keyPair);

        resolve(keyPair);
      } catch (error) {
        reject(new Error('Failed to parse recovery file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
// Load ONLY encryption keys (for users without DID/signing keys)
export async function loadEncryptionKeys(): Promise<{ encryptionPrivateKey?: CryptoKey; encryptionPublicKey?: CryptoKey; encryptionPrivateKeyBase64?: string; encryptionPublicKeyBase64?: string } | null> {
  const encryptionPrivateKeyBase64 = localStorage.getItem('encryption_private_key');
  const encryptionPublicKeyBase64 = localStorage.getItem('encryption_public_key');

  if (!encryptionPrivateKeyBase64 || !encryptionPublicKeyBase64) {
    return null;
  }

  try {
    const encryptionPrivateKey = await importEncryptionPrivateKey(encryptionPrivateKeyBase64);
    const encryptionPublicKey = await importEncryptionPublicKey(encryptionPublicKeyBase64);

    return {
      encryptionPrivateKey,
      encryptionPublicKey,
      encryptionPrivateKeyBase64,
      encryptionPublicKeyBase64,
    };
  } catch (error) {
    console.error('Failed to load encryption keys:', error);
    return null;
  }
}

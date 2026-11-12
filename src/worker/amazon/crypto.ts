/**
 * Web Crypto AES-GCM encryption for BYO Amazon Credentials
 */

async function getKey(rawSecret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(rawSecret.padEnd(32, '0').slice(0, 32)),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('creatorbrain_salt_2026'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptCredential(
  plaintext: string,
  secretPassphrase = 'creatorbrain_default_dev_key_32b'
): Promise<{ encrypted: string; iv: string }> {
  const key = await getKey(secretPassphrase);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encoded
  );

  const encrypted = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  const ivHex = Array.from(iv)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return { encrypted, iv: ivHex };
}

export async function decryptCredential(
  encryptedBase64: string,
  ivHex: string,
  secretPassphrase = 'creatorbrain_default_dev_key_32b'
): Promise<string> {
  const key = await getKey(secretPassphrase);
  const iv = new Uint8Array(
    (ivHex.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
  );

  const binaryString = atob(encryptedBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    bytes
  );

  return new TextDecoder().decode(decrypted);
}

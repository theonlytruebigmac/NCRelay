
'use server'; // Ensure this runs on the server

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32; // For aes-256
const IV_LENGTH_BYTES = 12; // GCM recommended
const AUTH_TAG_LENGTH_BYTES = 16; // GCM standard

let encryptionKeyBuffer: Buffer | null = null;

function getKey(): Buffer | null {
  if (encryptionKeyBuffer) {
    return encryptionKeyBuffer;
  }
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey || envKey === 'your_super_secret_64_character_hex_encryption_key_here') {
    console.warn(
      'WARNING: ENCRYPTION_KEY is not set or is using the default placeholder. Data will NOT be encrypted/decrypted properly. This is insecure for production. Please set a unique 64-character hex string in your .env file.'
    );
    return null;
  }
  if (envKey.length !== 64) {
    console.error(
      'ERROR: ENCRYPTION_KEY must be a 64-character hex string (representing 32 bytes). Data encryption/decryption will fail or be insecure.'
    );
    return null;
  }
  try {
    const key = Buffer.from(envKey, 'hex');
    if (key.length !== KEY_LENGTH_BYTES) {
        console.error(
            `ERROR: ENCRYPTION_KEY, after hex decoding, is not ${KEY_LENGTH_BYTES} bytes long (${key.length} bytes found). Data encryption/decryption will fail or be insecure.`
        );
        return null;
    }
    encryptionKeyBuffer = key; // Cache the buffer
    return encryptionKeyBuffer;
  } catch (error) {
    console.error('ERROR: Failed to parse ENCRYPTION_KEY from hex. Ensure it is a valid 64-character hex string.', error);
    return null;
  }
}

export async function encrypt(text: string): Promise<string> {
  const key = getKey();
  if (text === null || typeof text === 'undefined') {
    // Handle null or undefined input gracefully, perhaps by returning as is or an empty string
    return text;
  }
  if (!key) {
    // If key is not available (e.g., not set or invalid), return original text
    // This is a security risk, but prevents app from crashing during setup.
    // A critical warning is already logged by getKey().
    return text;
  }

  try {
    const iv = crypto.randomBytes(IV_LENGTH_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    return text; // Fallback to original text on error
  }
}

export async function decrypt(encryptedText: string): Promise<string> {
  const key = getKey();
   if (encryptedText === null || typeof encryptedText === 'undefined') {
    return encryptedText;
  }
  if (!key || !encryptedText.includes(':') || encryptedText.split(':').length !== 3) {
    // If no key, or not in the expected format "iv:authTag:ciphertext",
    // assume it's plaintext or corrupted.
    // A critical warning about the key is already logged by getKey().
    return encryptedText;
  }

  try {
    const parts = encryptedText.split(':');
    const ivHex = parts[0];
    const authTagHex = parts[1];
    const encryptedHex = parts[2];

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    if (iv.length !== IV_LENGTH_BYTES) {
        // console.warn('Decryption failed: IV length is incorrect. Returning original text.');
        return encryptedText;
    }
    if (authTag.length !== AUTH_TAG_LENGTH_BYTES) {
        // console.warn('Decryption failed: AuthTag length is incorrect. Returning original text.');
        return encryptedText;
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    // console.warn('Decryption failed. Data may be corrupted, a wrong key might be used, or it might be plaintext. Returning original text.');
    return encryptedText; // Return original (likely still encrypted or corrupted) text on error
  }
}

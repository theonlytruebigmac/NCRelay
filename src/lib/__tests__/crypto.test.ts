import { describe, it, expect, beforeAll } from '@jest/globals';
import { encrypt, decrypt } from '../crypto';

describe('Crypto', () => {
  // Set a test encryption key before running tests (must be 64 hex characters)
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string successfully', async () => {
      const plaintext = 'Hello, World!';
      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for the same plaintext', async () => {
      const plaintext = 'Test message';
      const encrypted1 = await encrypt(plaintext);
      const encrypted2 = await encrypt(plaintext);

      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same plaintext
      const decrypted1 = await decrypt(encrypted1);
      const decrypted2 = await decrypt(encrypted2);
      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    it('should handle empty strings', async () => {
      const plaintext = '';
      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', async () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', async () => {
      const plaintext = '你好世界 🌍 مرحبا بالعالم';
      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', async () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = await encrypt(plaintext);
      const decrypted = await decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error when decrypting invalid data', async () => {
      await expect(decrypt('invalid-encrypted-data')).rejects.toThrow();
    });

    it('should produce encrypted string with IV and auth tag', async () => {
      const plaintext = 'Test';
      const encrypted = await encrypt(plaintext);

      // Encrypted format should be: iv:authTag:encrypted
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBeTruthy(); // IV
      expect(parts[1]).toBeTruthy(); // Auth tag
      expect(parts[2]).toBeTruthy(); // Encrypted data
    });
  });
});

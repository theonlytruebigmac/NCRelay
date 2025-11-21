import { describe, it, expect, beforeAll } from '@jest/globals';
import { generateAuthToken, verifyAuthToken } from '../auth';
import type { User } from '../types';

describe('Auth', () => {
  // Set a test JWT secret before running tests
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-required';
  });

  const mockUser: User = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed-password',
    isAdmin: true,
    createdAt: new Date().toISOString()
  };

  describe('generateAuthToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateAuthToken(mockUser);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      // JWT tokens have 3 parts separated by dots
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include user data in token payload', () => {
      const token = generateAuthToken(mockUser);
      const payload = verifyAuthToken(token);

      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe(mockUser.id);
      expect(payload?.email).toBe(mockUser.email);
    });

    it('should generate different tokens for same user (due to timestamp)', (done) => {
      const token1 = generateAuthToken(mockUser);

      // Wait a bit to ensure different timestamps
      setTimeout(() => {
        const token2 = generateAuthToken(mockUser);
        expect(token1).not.toBe(token2);
        done();
      }, 10);
    });
  });

  describe('verifyAuthToken', () => {
    it('should verify a valid token', () => {
      const token = generateAuthToken(mockUser);
      const payload = verifyAuthToken(token);

      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe(mockUser.id);
      expect(payload?.email).toBe(mockUser.email);
    });

    it('should return null for invalid token', () => {
      const payload = verifyAuthToken('invalid-token');
      expect(payload).toBeNull();
    });

    it('should return null for malformed token', () => {
      const payload = verifyAuthToken('not.a.valid.jwt.token');
      expect(payload).toBeNull();
    });

    it('should include exp and iat fields', () => {
      const token = generateAuthToken(mockUser);
      const payload = verifyAuthToken(token);

      expect(payload).toBeTruthy();
      expect(payload?.exp).toBeTruthy();
      expect(payload?.iat).toBeTruthy();
      expect(typeof payload?.exp).toBe('number');
      expect(typeof payload?.iat).toBe('number');
    });

    it('should set expiration to 7 days from now', () => {
      const token = generateAuthToken(mockUser);
      const payload = verifyAuthToken(token);

      expect(payload).toBeTruthy();
      if (payload && payload.iat && payload.exp) {
        const diffInSeconds = payload.exp - payload.iat;
        const diffInDays = diffInSeconds / (60 * 60 * 24);
        expect(diffInDays).toBe(7);
      }
    });
  });
});

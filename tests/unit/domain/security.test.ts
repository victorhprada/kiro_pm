import { describe, it, expect } from 'vitest';
import {
  sanitize,
  createSanitizer,
  sanitizeError,
  sanitizeObject,
} from '../../../src/domain/security';

describe('security - PAT sanitization', () => {
  const testPat = 'my-secret-pat-token-12345';

  describe('sanitize', () => {
    it('replaces PAT with [REDACTED]', () => {
      const text = `Connection failed for token ${testPat}`;
      const result = sanitize(text, testPat);
      expect(result).toBe('Connection failed for token [REDACTED]');
      expect(result).not.toContain(testPat);
    });

    it('replaces multiple occurrences of PAT', () => {
      const text = `Token: ${testPat}, again: ${testPat}`;
      const result = sanitize(text, testPat);
      expect(result).toBe('Token: [REDACTED], again: [REDACTED]');
      expect(result).not.toContain(testPat);
    });

    it('returns text unchanged when PAT is empty', () => {
      const text = 'Some log message';
      expect(sanitize(text, '')).toBe(text);
    });

    it('returns text unchanged when PAT is not present', () => {
      const text = 'No token here';
      expect(sanitize(text, testPat)).toBe(text);
    });

    it('handles empty text', () => {
      expect(sanitize('', testPat)).toBe('');
    });
  });

  describe('createSanitizer', () => {
    it('creates a reusable sanitizer bound to a PAT', () => {
      const sanitizer = createSanitizer(testPat);
      const result = sanitizer(`Error with ${testPat}`);
      expect(result).toBe('Error with [REDACTED]');
      expect(result).not.toContain(testPat);
    });

    it('sanitizer works across multiple calls', () => {
      const sanitizer = createSanitizer(testPat);
      expect(sanitizer(`A: ${testPat}`)).toBe('A: [REDACTED]');
      expect(sanitizer(`B: ${testPat}`)).toBe('B: [REDACTED]');
    });

    it('sanitizer with empty PAT returns text unchanged', () => {
      const sanitizer = createSanitizer('');
      expect(sanitizer('hello world')).toBe('hello world');
    });
  });

  describe('sanitizeError', () => {
    it('redacts PAT from error message', () => {
      const error = new Error(`Auth failed with token ${testPat}`);
      const result = sanitizeError(error, testPat);
      expect(result.message).toBe('Auth failed with token [REDACTED]');
      expect(result.message).not.toContain(testPat);
    });

    it('preserves error name', () => {
      const error = new TypeError(`Invalid ${testPat}`);
      const result = sanitizeError(error, testPat);
      expect(result.name).toBe('TypeError');
    });

    it('redacts PAT from stack trace', () => {
      const error = new Error(`Failed ${testPat}`);
      const result = sanitizeError(error, testPat);
      if (result.stack) {
        expect(result.stack).not.toContain(testPat);
      }
    });

    it('returns error unchanged when PAT is empty', () => {
      const error = new Error('Some error');
      const result = sanitizeError(error, '');
      expect(result).toBe(error);
    });
  });

  describe('sanitizeObject', () => {
    it('sanitizes string values in objects', () => {
      const obj = { message: `Token is ${testPat}`, code: 401 };
      const result = sanitizeObject(obj, testPat) as Record<string, unknown>;
      expect(result.message).toBe('Token is [REDACTED]');
      expect(result.code).toBe(401);
    });

    it('sanitizes nested objects', () => {
      const obj = {
        outer: {
          inner: `secret: ${testPat}`,
        },
      };
      const result = sanitizeObject(obj, testPat) as any;
      expect(result.outer.inner).toBe('secret: [REDACTED]');
    });

    it('sanitizes arrays', () => {
      const arr = [`token: ${testPat}`, 'safe', `again: ${testPat}`];
      const result = sanitizeObject(arr, testPat) as string[];
      expect(result[0]).toBe('token: [REDACTED]');
      expect(result[1]).toBe('safe');
      expect(result[2]).toBe('again: [REDACTED]');
    });

    it('sanitizes arrays within objects', () => {
      const obj = { tokens: [`${testPat}`, 'other'] };
      const result = sanitizeObject(obj, testPat) as any;
      expect(result.tokens[0]).toBe('[REDACTED]');
      expect(result.tokens[1]).toBe('other');
    });

    it('handles null and undefined', () => {
      expect(sanitizeObject(null, testPat)).toBeNull();
      expect(sanitizeObject(undefined, testPat)).toBeUndefined();
    });

    it('handles primitive types', () => {
      expect(sanitizeObject(42, testPat)).toBe(42);
      expect(sanitizeObject(true, testPat)).toBe(true);
    });

    it('sanitizes Error instances within objects', () => {
      const obj = { error: new Error(`Failed: ${testPat}`) };
      const result = sanitizeObject(obj, testPat) as any;
      expect(result.error.message).toBe('Failed: [REDACTED]');
    });

    it('returns object unchanged when PAT is empty', () => {
      const obj = { key: 'value' };
      expect(sanitizeObject(obj, '')).toBe(obj);
    });
  });
});

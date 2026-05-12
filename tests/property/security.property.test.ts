/**
 * Property-Based Tests for PAT Security
 *
 * Tests that Personal Access Tokens (PAT) are NEVER exposed in any output,
 * including sanitized text, error messages, and nested objects.
 *
 * **Validates: Requirements 1.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sanitize, createSanitizer, sanitizeError, sanitizeObject } from '../../src/domain/security';

/**
 * Arbitrary generator for PAT strings: non-empty, minimum length 3
 * to avoid false positives with very short strings that could appear
 * as substrings of unrelated text.
 */
const patArb = () => fc.string({ minLength: 3, maxLength: 100 }).filter((s) => s.trim().length >= 3);

/**
 * Helper: recursively checks that a value does not contain the PAT anywhere.
 */
function deepContainsPat(value: unknown, pat: string): boolean {
  if (typeof value === 'string') {
    return value.includes(pat);
  }
  if (value instanceof Error) {
    return value.message.includes(pat) || (value.stack ? value.stack.includes(pat) : false);
  }
  if (Array.isArray(value)) {
    return value.some((item) => deepContainsPat(item, pat));
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value).some((v) => deepContainsPat(v, pat));
  }
  return false;
}

describe('Security Property Tests', () => {
  /**
   * Property 1: PAT Security — Token Never Exposed
   *
   * For ANY PAT string and ANY operation performed by the sanitization module,
   * the PAT value shall NEVER appear in any output.
   *
   * **Validates: Requirements 1.4**
   */
  describe('Property 1: PAT Security — Token Never Exposed', () => {
    it('sanitize() removes PAT from any text containing it', () => {
      fc.assert(
        fc.property(
          patArb(),
          fc.string(),
          fc.string(),
          (pat: string, prefix: string, suffix: string) => {
            const text = `${prefix}${pat}${suffix}`;
            const result = sanitize(text, pat);
            expect(result).not.toContain(pat);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('createSanitizer() produces a function that removes PAT from any text', () => {
      fc.assert(
        fc.property(
          patArb(),
          fc.string(),
          fc.string(),
          (pat: string, prefix: string, suffix: string) => {
            const sanitizer = createSanitizer(pat);
            const text = `${prefix}${pat}${suffix}`;
            const result = sanitizer(text);
            expect(result).not.toContain(pat);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sanitizeError() removes PAT from error messages', () => {
      fc.assert(
        fc.property(
          patArb(),
          fc.string(),
          fc.string(),
          (pat: string, prefix: string, suffix: string) => {
            const errorMessage = `${prefix}${pat}${suffix}`;
            const error = new Error(errorMessage);
            const sanitized = sanitizeError(error, pat);

            expect(sanitized.message).not.toContain(pat);
            if (sanitized.stack) {
              expect(sanitized.stack).not.toContain(pat);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sanitizeObject() removes PAT from nested objects with string values', () => {
      fc.assert(
        fc.property(
          patArb(),
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.oneof(
              // Simple string values containing PAT
              fc.tuple(fc.string(), fc.string()).map(([a, b]) => `${a}${fc.sample(patArb(), 1)[0] ?? 'x'}${b}`),
              // Nested object with PAT in values
              fc.dictionary(
                fc.string({ minLength: 1, maxLength: 10 }),
                fc.string()
              )
            )
          ),
          (pat: string, obj: Record<string, unknown>) => {
            // Inject PAT into the object values to ensure it's present
            const objWithPat: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(obj)) {
              if (typeof value === 'string') {
                objWithPat[key] = `${value}${pat}`;
              } else if (typeof value === 'object' && value !== null) {
                const nested: Record<string, string> = {};
                for (const [nk, nv] of Object.entries(value as Record<string, string>)) {
                  nested[nk] = `${nv}${pat}`;
                }
                objWithPat[key] = nested;
              } else {
                objWithPat[key] = value;
              }
            }

            const result = sanitizeObject(objWithPat, pat);
            expect(deepContainsPat(result, pat)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('sanitizeObject() removes PAT from arrays containing strings with PAT', () => {
      fc.assert(
        fc.property(
          patArb(),
          fc.array(fc.tuple(fc.string(), fc.string()), { minLength: 1, maxLength: 10 }),
          (pat: string, parts: [string, string][]) => {
            // Build an array where each element contains the PAT
            const arrayWithPat = parts.map(([a, b]) => `${a}${pat}${b}`);

            const result = sanitizeObject(arrayWithPat, pat);
            expect(deepContainsPat(result, pat)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

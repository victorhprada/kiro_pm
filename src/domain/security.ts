/**
 * PAT Security Sanitization Module
 *
 * Ensures that Personal Access Tokens (PAT) never appear in any output,
 * including log messages, error messages, and user-facing responses.
 *
 * Validates: Requirements 1.4
 */

const REDACTED = '[REDACTED]';

/**
 * Replaces any occurrence of the PAT in the text with [REDACTED].
 * Returns the original text unchanged if PAT is empty.
 */
export function sanitize(text: string, pat: string): string {
  if (!pat) {
    return text;
  }
  return text.split(pat).join(REDACTED);
}

/**
 * Creates a reusable sanitizer function bound to a specific PAT.
 * Useful for creating a single sanitizer instance at startup and reusing it.
 */
export function createSanitizer(pat: string): (text: string) => string {
  return (text: string) => sanitize(text, pat);
}

/**
 * Creates a new Error with the PAT redacted from the message.
 * Preserves the error name and stack trace structure.
 */
export function sanitizeError(error: Error, pat: string): Error {
  if (!pat) {
    return error;
  }

  const sanitizedMessage = sanitize(error.message, pat);
  const sanitizedError = new Error(sanitizedMessage);
  sanitizedError.name = error.name;

  if (error.stack) {
    sanitizedError.stack = sanitize(error.stack, pat);
  }

  return sanitizedError;
}

/**
 * Deep sanitizes any object, replacing PAT occurrences in string values.
 * Handles nested objects, arrays, and primitive types.
 * Returns the value unchanged if PAT is empty.
 */
export function sanitizeObject(obj: unknown, pat: string): unknown {
  if (!pat) {
    return obj;
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitize(obj, pat);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (obj instanceof Error) {
    return sanitizeError(obj, pat);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, pat));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value, pat);
    }
    return sanitized;
  }

  return obj;
}

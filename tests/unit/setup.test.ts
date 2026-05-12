import { describe, it, expect } from 'vitest';

describe('Project Setup', () => {
  it('should have vitest configured correctly', () => {
    expect(true).toBe(true);
  });

  it('should support TypeScript in tests', () => {
    const value: number = 42;
    expect(value).toBe(42);
  });
});

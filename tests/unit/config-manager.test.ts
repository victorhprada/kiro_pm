import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from '../../src/infrastructure/config-manager';
import { ValidationError } from '../../src/domain/errors';

describe('ConfigManager', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('validateConfig', () => {
    it('should return valid for correct config', () => {
      const manager = new ConfigManager();
      const result = manager.validateConfig({
        organizationUrl: 'https://dev.azure.com/my-org',
        pat: 'some-valid-pat-token',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error when organizationUrl is empty', () => {
      const manager = new ConfigManager();
      const result = manager.validateConfig({
        organizationUrl: '',
        pat: 'some-valid-pat-token',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'AZURE_DEVOPS_ORG_URL is required and must not be empty'
      );
    });

    it('should return error when organizationUrl is whitespace only', () => {
      const manager = new ConfigManager();
      const result = manager.validateConfig({
        organizationUrl: '   ',
        pat: 'some-valid-pat-token',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'AZURE_DEVOPS_ORG_URL is required and must not be empty'
      );
    });

    it('should return error when pat is empty', () => {
      const manager = new ConfigManager();
      const result = manager.validateConfig({
        organizationUrl: 'https://dev.azure.com/my-org',
        pat: '',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'AZURE_DEVOPS_PAT is required and must not be empty'
      );
    });

    it('should return error when pat is whitespace only', () => {
      const manager = new ConfigManager();
      const result = manager.validateConfig({
        organizationUrl: 'https://dev.azure.com/my-org',
        pat: '   ',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'AZURE_DEVOPS_PAT is required and must not be empty'
      );
    });

    it('should return multiple errors when both fields are missing', () => {
      const manager = new ConfigManager();
      const result = manager.validateConfig({
        organizationUrl: '',
        pat: '',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should return error for invalid URL format', () => {
      const manager = new ConfigManager();
      const result = manager.validateConfig({
        organizationUrl: 'not-a-valid-url',
        pat: 'some-valid-pat-token',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'AZURE_DEVOPS_ORG_URL must be a valid URL (e.g., https://dev.azure.com/your-org)'
      );
    });

    it('should accept http URLs', () => {
      const manager = new ConfigManager();
      const result = manager.validateConfig({
        organizationUrl: 'http://dev.azure.com/my-org',
        pat: 'some-valid-pat-token',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should never include PAT value in error messages', () => {
      const manager = new ConfigManager();
      const secretPat = 'super-secret-pat-12345';
      const result = manager.validateConfig({
        organizationUrl: 'not-a-valid-url',
        pat: secretPat,
      });

      // Ensure PAT is never in any error message
      for (const error of result.errors) {
        expect(error).not.toContain(secretPat);
      }
    });
  });

  describe('loadConfig', () => {
    it('should load config from environment variables', async () => {
      process.env.AZURE_DEVOPS_ORG_URL = 'https://dev.azure.com/test-org';
      process.env.AZURE_DEVOPS_PAT = 'test-pat-token';

      const manager = new ConfigManager('/nonexistent/.env');
      const config = await manager.loadConfig();

      expect(config.organizationUrl).toBe('https://dev.azure.com/test-org');
      expect(config.pat).toBe('test-pat-token');
    });

    it('should throw ValidationError when ORG_URL is missing', async () => {
      process.env.AZURE_DEVOPS_ORG_URL = '';
      process.env.AZURE_DEVOPS_PAT = 'test-pat-token';

      const manager = new ConfigManager('/nonexistent/.env');

      await expect(manager.loadConfig()).rejects.toThrow(ValidationError);
      await expect(manager.loadConfig()).rejects.toThrow(
        /AZURE_DEVOPS_ORG_URL is required/
      );
    });

    it('should throw ValidationError when PAT is missing', async () => {
      process.env.AZURE_DEVOPS_ORG_URL = 'https://dev.azure.com/test-org';
      process.env.AZURE_DEVOPS_PAT = '';

      const manager = new ConfigManager('/nonexistent/.env');

      await expect(manager.loadConfig()).rejects.toThrow(ValidationError);
      await expect(manager.loadConfig()).rejects.toThrow(
        /AZURE_DEVOPS_PAT is required/
      );
    });

    it('should throw ValidationError with all errors when both are missing', async () => {
      process.env.AZURE_DEVOPS_ORG_URL = '';
      process.env.AZURE_DEVOPS_PAT = '';

      const manager = new ConfigManager('/nonexistent/.env');

      try {
        await manager.loadConfig();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const validationError = error as ValidationError;
        expect(validationError.fields.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('should never expose PAT in thrown error messages', async () => {
      const secretPat = 'my-super-secret-pat-value';
      process.env.AZURE_DEVOPS_ORG_URL = 'invalid-url';
      process.env.AZURE_DEVOPS_PAT = secretPat;

      const manager = new ConfigManager('/nonexistent/.env');

      try {
        await manager.loadConfig();
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as Error).message).not.toContain(secretPat);
      }
    });
  });
});

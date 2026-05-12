/**
 * ConfigManager - Loads and validates application configuration from environment variables.
 * Ensures PAT is never logged or exposed in any output.
 */

import * as dotenv from 'dotenv';
import { AppConfig, ValidationResult } from '../domain/models';
import { ValidationError } from '../domain/errors';

export interface IConfigManager {
  loadConfig(): Promise<AppConfig>;
  validateConfig(config: AppConfig): ValidationResult;
}

export class ConfigManager implements IConfigManager {
  private envPath: string;

  constructor(envPath?: string) {
    this.envPath = envPath || '.env';
  }

  /**
   * Loads configuration from .env file and environment variables.
   * Validates that required fields are present and non-empty.
   * @throws ValidationError if required configuration is missing or invalid.
   */
  async loadConfig(): Promise<AppConfig> {
    dotenv.config({ path: this.envPath });

    const organizationUrl = process.env.AZURE_DEVOPS_ORG_URL || '';
    const pat = process.env.AZURE_DEVOPS_PAT || '';

    const config: AppConfig = { organizationUrl, pat };

    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new ValidationError(
        `Invalid configuration: ${validation.errors.join('; ')}`,
        validation.errors
      );
    }

    return config;
  }

  /**
   * Validates that the configuration has all required fields with non-empty values.
   * PAT value is never included in error messages to prevent exposure.
   */
  validateConfig(config: AppConfig): ValidationResult {
    const errors: string[] = [];

    if (!config.organizationUrl || config.organizationUrl.trim() === '') {
      errors.push('AZURE_DEVOPS_ORG_URL is required and must not be empty');
    }

    if (!config.pat || config.pat.trim() === '') {
      errors.push('AZURE_DEVOPS_PAT is required and must not be empty');
    }

    if (
      config.organizationUrl &&
      config.organizationUrl.trim() !== '' &&
      !this.isValidOrganizationUrl(config.organizationUrl)
    ) {
      errors.push(
        'AZURE_DEVOPS_ORG_URL must be a valid URL (e.g., https://dev.azure.com/your-org)'
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates that the organization URL has a valid format.
   */
  private isValidOrganizationUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }
}

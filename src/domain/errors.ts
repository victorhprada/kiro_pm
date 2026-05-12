/**
 * Custom error classes for Azure DevOps Work Items Creator
 */

import { WorkItemResult } from './models';

export class AzureDevOpsAuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'AzureDevOpsAuthError';
  }
}

export class WorkItemCreationError extends Error {
  constructor(
    message: string,
    public workItemType: string,
    public workItemTitle: string,
    public createdItems: WorkItemResult[]
  ) {
    super(message);
    this.name = 'WorkItemCreationError';
  }
}

export class RefinementError extends Error {
  constructor(
    message: string,
    public sessionId: string,
    public section?: string
  ) {
    super(message);
    this.name = 'RefinementError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public fields: string[]
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

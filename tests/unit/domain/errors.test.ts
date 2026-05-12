import { describe, it, expect } from 'vitest';
import {
  AzureDevOpsAuthError,
  WorkItemCreationError,
  RefinementError,
  ValidationError,
} from '../../../src/domain/errors';

describe('AzureDevOpsAuthError', () => {
  it('should create an error with message and statusCode', () => {
    const error = new AzureDevOpsAuthError('Authentication failed', 401);

    expect(error.message).toBe('Authentication failed');
    expect(error.statusCode).toBe(401);
    expect(error.name).toBe('AzureDevOpsAuthError');
  });

  it('should be an instance of Error', () => {
    const error = new AzureDevOpsAuthError('Unauthorized', 401);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AzureDevOpsAuthError);
  });

  it('should handle 403 forbidden status', () => {
    const error = new AzureDevOpsAuthError('Forbidden', 403);

    expect(error.statusCode).toBe(403);
  });
});

describe('WorkItemCreationError', () => {
  it('should create an error with work item details and created items', () => {
    const createdItems = [
      { id: 1, url: 'https://dev.azure.com/org/project/_workitems/edit/1', type: 'Epic', title: 'My Epic' },
    ];

    const error = new WorkItemCreationError(
      'Failed to create Feature',
      'Feature',
      'My Feature',
      createdItems
    );

    expect(error.message).toBe('Failed to create Feature');
    expect(error.workItemType).toBe('Feature');
    expect(error.workItemTitle).toBe('My Feature');
    expect(error.createdItems).toEqual(createdItems);
    expect(error.name).toBe('WorkItemCreationError');
  });

  it('should be an instance of Error', () => {
    const error = new WorkItemCreationError('Failed', 'User Story', 'Story 1', []);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(WorkItemCreationError);
  });

  it('should preserve empty createdItems when failure occurs on first item', () => {
    const error = new WorkItemCreationError('Failed to create Epic', 'Epic', 'My Epic', []);

    expect(error.createdItems).toEqual([]);
  });
});

describe('RefinementError', () => {
  it('should create an error with sessionId and section', () => {
    const error = new RefinementError('Session failed', 'session-123', 'background');

    expect(error.message).toBe('Session failed');
    expect(error.sessionId).toBe('session-123');
    expect(error.section).toBe('background');
    expect(error.name).toBe('RefinementError');
  });

  it('should allow section to be undefined', () => {
    const error = new RefinementError('General refinement error', 'session-456');

    expect(error.section).toBeUndefined();
  });

  it('should be an instance of Error', () => {
    const error = new RefinementError('Error', 'session-789', 'objective');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RefinementError);
  });
});

describe('ValidationError', () => {
  it('should create an error with fields list', () => {
    const error = new ValidationError('Validation failed', ['title', 'description']);

    expect(error.message).toBe('Validation failed');
    expect(error.fields).toEqual(['title', 'description']);
    expect(error.name).toBe('ValidationError');
  });

  it('should be an instance of Error', () => {
    const error = new ValidationError('Invalid', ['areaPath']);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ValidationError);
  });

  it('should handle single field validation failure', () => {
    const error = new ValidationError('Title is required', ['title']);

    expect(error.fields).toHaveLength(1);
    expect(error.fields[0]).toBe('title');
  });
});

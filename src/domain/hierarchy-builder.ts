/**
 * HierarchyBuilder — Constructs and validates the WorkItemHierarchy.
 *
 * Responsibilities:
 * - Assemble a WorkItemHierarchy from Epic, Feature, and User Stories
 * - Validate that the hierarchy meets structural requirements
 * - Add new User Stories immutably (preserving existing items)
 *
 * Requirements: 4.1, 4.2, 4.3, 5.5
 */

import {
  EpicData,
  FeatureData,
  UserStoryData,
  ValidationResult,
  WorkItemHierarchy,
} from './models';

export interface IHierarchyBuilder {
  build(epic: EpicData, feature: FeatureData, stories: UserStoryData[]): WorkItemHierarchy;
  validate(hierarchy: WorkItemHierarchy): ValidationResult;
  addUserStory(hierarchy: WorkItemHierarchy, story: UserStoryData): WorkItemHierarchy;
}

export class HierarchyBuilder implements IHierarchyBuilder {
  /**
   * Assembles a WorkItemHierarchy from the provided parts.
   */
  build(epic: EpicData, feature: FeatureData, stories: UserStoryData[]): WorkItemHierarchy {
    return {
      epic,
      feature,
      userStories: [...stories],
    };
  }

  /**
   * Validates the hierarchy structure:
   * - Epic has non-empty title and description
   * - Feature has non-empty title and description
   * - At least 1 User Story exists
   * - Each User Story has non-empty title, description, and acceptanceCriteria
   */
  validate(hierarchy: WorkItemHierarchy): ValidationResult {
    const errors: string[] = [];

    // Validate Epic
    if (!hierarchy.epic.title || hierarchy.epic.title.trim() === '') {
      errors.push('Epic title must not be empty');
    }
    if (!hierarchy.epic.description || hierarchy.epic.description.trim() === '') {
      errors.push('Epic description must not be empty');
    }

    // Validate Feature
    if (!hierarchy.feature.title || hierarchy.feature.title.trim() === '') {
      errors.push('Feature title must not be empty');
    }
    if (!hierarchy.feature.description || hierarchy.feature.description.trim() === '') {
      errors.push('Feature description must not be empty');
    }

    // Validate User Stories
    if (!hierarchy.userStories || hierarchy.userStories.length === 0) {
      errors.push('Hierarchy must contain at least 1 User Story');
    } else {
      hierarchy.userStories.forEach((story, index) => {
        if (!story.title || story.title.trim() === '') {
          errors.push(`User Story ${index + 1} title must not be empty`);
        }
        if (!story.description || story.description.trim() === '') {
          errors.push(`User Story ${index + 1} description must not be empty`);
        }
        if (!story.acceptanceCriteria || story.acceptanceCriteria.trim() === '') {
          errors.push(`User Story ${index + 1} acceptance criteria must not be empty`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Adds a new User Story to the hierarchy immutably.
   * Returns a NEW hierarchy with the story appended, preserving all existing items.
   */
  addUserStory(hierarchy: WorkItemHierarchy, story: UserStoryData): WorkItemHierarchy {
    return {
      epic: { ...hierarchy.epic },
      feature: { ...hierarchy.feature },
      userStories: [...hierarchy.userStories, story],
    };
  }
}

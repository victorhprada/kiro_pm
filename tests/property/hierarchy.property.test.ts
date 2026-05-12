/**
 * Property-Based Tests for Hierarchy Generation
 *
 * Tests universal properties of the hierarchy generation and builder
 * using fast-check to verify correctness across all valid inputs.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DefaultHierarchyTemplateEngine } from '../../src/domain/hierarchy-template-engine';
import { HierarchyBuilder } from '../../src/domain/hierarchy-builder';
import { CollectedInfo } from '../../src/domain/types';
import { UserStoryData, WorkItemHierarchy } from '../../src/domain/models';

/**
 * Arbitrary generator for non-empty trimmed strings (simulating user answers).
 */
const nonEmptyString = () =>
  fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

/**
 * Arbitrary generator for valid CollectedInfo objects with all required fields non-empty.
 */
const collectedInfoArb = (): fc.Arbitrary<CollectedInfo> =>
  fc.record({
    context: nonEmptyString(),
    objective: nonEmptyString(),
    customerBenefit: nonEmptyString(),
    targetAudience: nonEmptyString(),
    customerJobs: nonEmptyString(),
    customerGains: nonEmptyString(),
    keyFeatures: nonEmptyString(),
    scopeLimits: nonEmptyString(),
    userScenarios: nonEmptyString(),
    acceptanceCriteria: nonEmptyString(),
    // Optional fields
    whyNow: fc.option(nonEmptyString(), { nil: undefined }),
    recentlyPossible: fc.option(nonEmptyString(), { nil: undefined }),
    successMetrics: fc.option(nonEmptyString(), { nil: undefined }),
    strategicAlignment: fc.option(nonEmptyString(), { nil: undefined }),
    constraints: fc.option(nonEmptyString(), { nil: undefined }),
    competitiveAdvantage: fc.option(nonEmptyString(), { nil: undefined }),
    assumptions: fc.option(nonEmptyString(), { nil: undefined }),
    integrations: fc.option(nonEmptyString(), { nil: undefined }),
    v1Scope: fc.option(nonEmptyString(), { nil: undefined }),
    dependencies: fc.option(nonEmptyString(), { nil: undefined }),
    risks: fc.option(nonEmptyString(), { nil: undefined }),
    alternativeScenarios: fc.option(nonEmptyString(), { nil: undefined }),
    estimatedStories: fc.option(fc.integer({ min: 1, max: 20 }), { nil: undefined }),
    businessRules: fc.option(nonEmptyString(), { nil: undefined }),
    definitionOfDone: fc.option(nonEmptyString(), { nil: undefined }),
  });

/**
 * Arbitrary generator for valid UserStoryData.
 */
const userStoryDataArb = (): fc.Arbitrary<UserStoryData> =>
  fc.record({
    title: nonEmptyString(),
    description: nonEmptyString(),
    acceptanceCriteria: nonEmptyString(),
    areaPath: fc.string(),
  });

/**
 * Arbitrary generator for a valid WorkItemHierarchy with at least 1 User Story.
 */
const workItemHierarchyArb = (): fc.Arbitrary<WorkItemHierarchy> =>
  fc.record({
    epic: fc.record({
      title: nonEmptyString(),
      description: nonEmptyString(),
      areaPath: fc.string(),
    }),
    feature: fc.record({
      title: nonEmptyString(),
      description: nonEmptyString(),
      areaPath: fc.string(),
    }),
    userStories: fc.array(userStoryDataArb(), { minLength: 1, maxLength: 10 }),
  });

describe('Hierarchy Property Tests', () => {
  const templateEngine = new DefaultHierarchyTemplateEngine();
  const hierarchyBuilder = new HierarchyBuilder();

  /**
   * Property 3: Hierarchy Structural Invariant
   *
   * For ANY valid set of answers (CollectedInfo with non-empty required fields),
   * the generated WorkItemHierarchy shall contain:
   * - Exactly 1 Epic with non-empty title and description
   * - Exactly 1 Feature with non-empty title and description
   * - At least 1 User Story, each with non-empty title, description, and acceptanceCriteria
   *
   * **Validates: Requirements 3.6, 4.1, 4.2, 4.3**
   */
  describe('Property 3: Hierarchy Structural Invariant', () => {
    it('should produce a hierarchy with exactly 1 Epic, 1 Feature, and ≥1 User Story with non-empty fields for any valid CollectedInfo', () => {
      fc.assert(
        fc.property(collectedInfoArb(), (collectedInfo: CollectedInfo) => {
          // Build hierarchy using the template engine
          const epic = templateEngine.buildEpic(collectedInfo);
          const feature = templateEngine.buildFeature(collectedInfo);
          const userStories = templateEngine.buildUserStories(collectedInfo);

          const hierarchy = hierarchyBuilder.build(epic, feature, userStories);

          // Exactly 1 Epic with non-empty title and description
          expect(hierarchy.epic).toBeDefined();
          expect(hierarchy.epic.title.trim().length).toBeGreaterThan(0);
          expect(hierarchy.epic.description.trim().length).toBeGreaterThan(0);

          // Exactly 1 Feature with non-empty title and description
          expect(hierarchy.feature).toBeDefined();
          expect(hierarchy.feature.title.trim().length).toBeGreaterThan(0);
          expect(hierarchy.feature.description.trim().length).toBeGreaterThan(0);

          // At least 1 User Story
          expect(hierarchy.userStories.length).toBeGreaterThanOrEqual(1);

          // Each User Story has non-empty title, description, and acceptanceCriteria
          for (const story of hierarchy.userStories) {
            expect(story.title.trim().length).toBeGreaterThan(0);
            expect(story.description.trim().length).toBeGreaterThan(0);
            expect(story.acceptanceCriteria.trim().length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Adding User Stories Preserves Existing Hierarchy
   *
   * For ANY valid WorkItemHierarchy and ANY new UserStoryData:
   * - Adding the new User Story preserves the Epic unchanged
   * - Adding the new User Story preserves the Feature unchanged
   * - All previous User Stories remain unchanged
   * - The resulting hierarchy has exactly one more User Story than before
   *
   * **Validates: Requirements 5.5**
   */
  describe('Property 5: Adding User Stories Preserves Existing Hierarchy', () => {
    it('should preserve all existing items and increase user story count by 1 when adding a new story', () => {
      fc.assert(
        fc.property(
          workItemHierarchyArb(),
          userStoryDataArb(),
          (hierarchy: WorkItemHierarchy, newStory: UserStoryData) => {
            const originalStoryCount = hierarchy.userStories.length;

            // Snapshot existing stories for comparison
            const originalEpic = { ...hierarchy.epic };
            const originalFeature = { ...hierarchy.feature };
            const originalStories = hierarchy.userStories.map((s) => ({ ...s }));

            // Add the new user story
            const updatedHierarchy = hierarchyBuilder.addUserStory(hierarchy, newStory);

            // Epic is unchanged
            expect(updatedHierarchy.epic.title).toBe(originalEpic.title);
            expect(updatedHierarchy.epic.description).toBe(originalEpic.description);
            expect(updatedHierarchy.epic.areaPath).toBe(originalEpic.areaPath);

            // Feature is unchanged
            expect(updatedHierarchy.feature.title).toBe(originalFeature.title);
            expect(updatedHierarchy.feature.description).toBe(originalFeature.description);
            expect(updatedHierarchy.feature.areaPath).toBe(originalFeature.areaPath);

            // All previous stories are unchanged
            for (let i = 0; i < originalStoryCount; i++) {
              expect(updatedHierarchy.userStories[i].title).toBe(originalStories[i].title);
              expect(updatedHierarchy.userStories[i].description).toBe(originalStories[i].description);
              expect(updatedHierarchy.userStories[i].acceptanceCriteria).toBe(originalStories[i].acceptanceCriteria);
              expect(updatedHierarchy.userStories[i].areaPath).toBe(originalStories[i].areaPath);
            }

            // Count increased by exactly 1
            expect(updatedHierarchy.userStories.length).toBe(originalStoryCount + 1);

            // The new story is the last one
            const lastStory = updatedHierarchy.userStories[updatedHierarchy.userStories.length - 1];
            expect(lastStory.title).toBe(newStory.title);
            expect(lastStory.description).toBe(newStory.description);
            expect(lastStory.acceptanceCriteria).toBe(newStory.acceptanceCriteria);
            expect(lastStory.areaPath).toBe(newStory.areaPath);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

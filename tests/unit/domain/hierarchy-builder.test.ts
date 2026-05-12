import { describe, it, expect } from 'vitest';
import { HierarchyBuilder } from '../../../src/domain/hierarchy-builder';
import { EpicData, FeatureData, UserStoryData, WorkItemHierarchy } from '../../../src/domain/models';

describe('HierarchyBuilder', () => {
  const builder = new HierarchyBuilder();

  const validEpic: EpicData = {
    title: 'Epic Title',
    description: '<p>Epic description</p>',
    areaPath: 'Project\\Area',
  };

  const validFeature: FeatureData = {
    title: 'Feature Title',
    description: '<p>Feature description</p>',
    areaPath: 'Project\\Area',
  };

  const validStory: UserStoryData = {
    title: 'User Story 1',
    description: '<p>Story description</p>',
    acceptanceCriteria: '<ul><li>Criteria 1</li></ul>',
    areaPath: 'Project\\Area',
  };

  describe('build()', () => {
    it('should assemble a WorkItemHierarchy from Epic, Feature, and User Stories', () => {
      const hierarchy = builder.build(validEpic, validFeature, [validStory]);

      expect(hierarchy.epic).toEqual(validEpic);
      expect(hierarchy.feature).toEqual(validFeature);
      expect(hierarchy.userStories).toEqual([validStory]);
    });

    it('should create a copy of the stories array', () => {
      const stories = [validStory];
      const hierarchy = builder.build(validEpic, validFeature, stories);

      stories.push({ ...validStory, title: 'Another Story' });
      expect(hierarchy.userStories).toHaveLength(1);
    });

    it('should handle multiple user stories', () => {
      const story2: UserStoryData = {
        title: 'User Story 2',
        description: '<p>Second story</p>',
        acceptanceCriteria: '<ul><li>Criteria 2</li></ul>',
        areaPath: 'Project\\Area',
      };

      const hierarchy = builder.build(validEpic, validFeature, [validStory, story2]);
      expect(hierarchy.userStories).toHaveLength(2);
    });
  });

  describe('validate()', () => {
    it('should return valid=true for a valid hierarchy', () => {
      const hierarchy = builder.build(validEpic, validFeature, [validStory]);
      const result = builder.validate(hierarchy);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return error when Epic title is empty', () => {
      const hierarchy = builder.build(
        { ...validEpic, title: '' },
        validFeature,
        [validStory],
      );
      const result = builder.validate(hierarchy);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Epic title must not be empty');
    });

    it('should return error when Epic title is whitespace-only', () => {
      const hierarchy = builder.build(
        { ...validEpic, title: '   ' },
        validFeature,
        [validStory],
      );
      const result = builder.validate(hierarchy);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Epic title must not be empty');
    });

    it('should return error when Epic description is empty', () => {
      const hierarchy = builder.build(
        { ...validEpic, description: '' },
        validFeature,
        [validStory],
      );
      const result = builder.validate(hierarchy);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Epic description must not be empty');
    });

    it('should return error when Feature title is empty', () => {
      const hierarchy = builder.build(
        validEpic,
        { ...validFeature, title: '' },
        [validStory],
      );
      const result = builder.validate(hierarchy);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Feature title must not be empty');
    });

    it('should return error when Feature description is empty', () => {
      const hierarchy = builder.build(
        validEpic,
        { ...validFeature, description: '' },
        [validStory],
      );
      const result = builder.validate(hierarchy);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Feature description must not be empty');
    });

    it('should return error when no User Stories exist', () => {
      const hierarchy = builder.build(validEpic, validFeature, []);
      const result = builder.validate(hierarchy);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Hierarchy must contain at least 1 User Story');
    });

    it('should return error when User Story title is empty', () => {
      const hierarchy = builder.build(
        validEpic,
        validFeature,
        [{ ...validStory, title: '' }],
      );
      const result = builder.validate(hierarchy);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('User Story 1 title must not be empty');
    });

    it('should return error when User Story description is empty', () => {
      const hierarchy = builder.build(
        validEpic,
        validFeature,
        [{ ...validStory, description: '' }],
      );
      const result = builder.validate(hierarchy);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('User Story 1 description must not be empty');
    });

    it('should return error when User Story acceptanceCriteria is empty', () => {
      const hierarchy = builder.build(
        validEpic,
        validFeature,
        [{ ...validStory, acceptanceCriteria: '' }],
      );
      const result = builder.validate(hierarchy);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('User Story 1 acceptance criteria must not be empty');
    });

    it('should report multiple errors at once', () => {
      const hierarchy: WorkItemHierarchy = {
        epic: { title: '', description: '', areaPath: '' },
        feature: { title: '', description: '', areaPath: '' },
        userStories: [],
      };
      const result = builder.validate(hierarchy);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(5);
    });

    it('should validate each User Story independently', () => {
      const invalidStory: UserStoryData = {
        title: '',
        description: '',
        acceptanceCriteria: '',
        areaPath: 'Project\\Area',
      };
      const hierarchy = builder.build(validEpic, validFeature, [validStory, invalidStory]);
      const result = builder.validate(hierarchy);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('User Story 2 title must not be empty');
      expect(result.errors).toContain('User Story 2 description must not be empty');
      expect(result.errors).toContain('User Story 2 acceptance criteria must not be empty');
    });
  });

  describe('addUserStory()', () => {
    it('should return a new hierarchy with the story appended', () => {
      const hierarchy = builder.build(validEpic, validFeature, [validStory]);
      const newStory: UserStoryData = {
        title: 'New Story',
        description: '<p>New story desc</p>',
        acceptanceCriteria: '<ul><li>New criteria</li></ul>',
        areaPath: 'Project\\Area',
      };

      const updated = builder.addUserStory(hierarchy, newStory);

      expect(updated.userStories).toHaveLength(2);
      expect(updated.userStories[1]).toEqual(newStory);
    });

    it('should preserve existing items unchanged', () => {
      const hierarchy = builder.build(validEpic, validFeature, [validStory]);
      const newStory: UserStoryData = {
        title: 'New Story',
        description: '<p>New story desc</p>',
        acceptanceCriteria: '<ul><li>New criteria</li></ul>',
        areaPath: 'Project\\Area',
      };

      const updated = builder.addUserStory(hierarchy, newStory);

      // Original hierarchy is unchanged
      expect(hierarchy.userStories).toHaveLength(1);
      // Epic and Feature are preserved
      expect(updated.epic).toEqual(validEpic);
      expect(updated.feature).toEqual(validFeature);
      expect(updated.userStories[0]).toEqual(validStory);
    });

    it('should return a new object (immutable operation)', () => {
      const hierarchy = builder.build(validEpic, validFeature, [validStory]);
      const newStory: UserStoryData = {
        title: 'New Story',
        description: '<p>New story desc</p>',
        acceptanceCriteria: '<ul><li>New criteria</li></ul>',
        areaPath: 'Project\\Area',
      };

      const updated = builder.addUserStory(hierarchy, newStory);

      expect(updated).not.toBe(hierarchy);
      expect(updated.userStories).not.toBe(hierarchy.userStories);
    });
  });
});

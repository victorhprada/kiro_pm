import { describe, it, expect } from 'vitest';
import { QUESTION_FLOWS } from '../../../src/domain/question-templates';
import { PRDSection } from '../../../src/domain/types';

describe('QuestionTemplates - QUESTION_FLOWS', () => {
  it('should contain exactly 8 question flows', () => {
    expect(QUESTION_FLOWS).toHaveLength(8);
  });

  it('should cover all 8 PRD sections', () => {
    const expectedSections: PRDSection[] = [
      'background',
      'objective',
      'market_segments',
      'value_propositions',
      'solution',
      'release',
      'user_scenarios',
      'acceptance_criteria',
    ];

    const actualSections = QUESTION_FLOWS.map((flow) => flow.section);
    expect(actualSections).toEqual(expectedSections);
  });

  it('should have correct mapsTo values for each section', () => {
    const mapping: Record<PRDSection, string> = {
      background: 'epic',
      objective: 'epic',
      market_segments: 'epic',
      value_propositions: 'feature',
      solution: 'feature',
      release: 'metadata',
      user_scenarios: 'user_stories',
      acceptance_criteria: 'user_stories',
    };

    for (const flow of QUESTION_FLOWS) {
      expect(flow.mapsTo).toBe(mapping[flow.section]);
    }
  });

  it('should have non-empty sectionTitle and purpose for each flow', () => {
    for (const flow of QUESTION_FLOWS) {
      expect(flow.sectionTitle.length).toBeGreaterThan(0);
      expect(flow.purpose.length).toBeGreaterThan(0);
    }
  });

  it('should have at least one question per flow', () => {
    for (const flow of QUESTION_FLOWS) {
      expect(flow.questions.length).toBeGreaterThan(0);
    }
  });

  it('should have unique question IDs across all flows', () => {
    const allIds = QUESTION_FLOWS.flatMap((flow) =>
      flow.questions.map((q) => q.id)
    );
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it('should have followUpCondition and followUpText for all required questions', () => {
    for (const flow of QUESTION_FLOWS) {
      for (const question of flow.questions) {
        if (question.required) {
          expect(question.followUpCondition).toBeDefined();
          expect(question.followUpText).toBeDefined();
          expect(question.followUpText!.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('should NOT have followUpCondition for optional questions', () => {
    for (const flow of QUESTION_FLOWS) {
      for (const question of flow.questions) {
        if (!question.required) {
          expect(question.followUpCondition).toBeUndefined();
        }
      }
    }
  });

  describe('followUpCondition behavior', () => {
    it('should return true for empty string answers', () => {
      for (const flow of QUESTION_FLOWS) {
        for (const question of flow.questions) {
          if (question.followUpCondition) {
            expect(question.followUpCondition('')).toBe(true);
          }
        }
      }
    });

    it('should return true for whitespace-only answers', () => {
      for (const flow of QUESTION_FLOWS) {
        for (const question of flow.questions) {
          if (question.followUpCondition) {
            expect(question.followUpCondition('   ')).toBe(true);
            expect(question.followUpCondition('\t\n')).toBe(true);
          }
        }
      }
    });

    it('should return false for non-empty answers', () => {
      for (const flow of QUESTION_FLOWS) {
        for (const question of flow.questions) {
          if (question.followUpCondition) {
            expect(question.followUpCondition('valid answer')).toBe(false);
          }
        }
      }
    });
  });

  describe('minAnswersRequired constraints', () => {
    it('should have correct minAnswersRequired per section', () => {
      const expectedMin: Record<PRDSection, number> = {
        background: 2,
        objective: 2,
        market_segments: 1,
        value_propositions: 2,
        solution: 2,
        release: 0,
        user_scenarios: 1,
        acceptance_criteria: 1,
      };

      for (const flow of QUESTION_FLOWS) {
        expect(flow.minAnswersRequired).toBe(expectedMin[flow.section]);
      }
    });

    it('should have minAnswersRequired <= total questions in each flow', () => {
      for (const flow of QUESTION_FLOWS) {
        expect(flow.minAnswersRequired).toBeLessThanOrEqual(
          flow.questions.length
        );
      }
    });
  });
});

/**
 * Property-Based Tests for PMSkill Session Management
 *
 * Tests universal properties of the PM Skill module using fast-check
 * to verify correctness across all valid inputs.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { PMSkillImpl } from '../../src/application/pm-skill';

describe('PMSkill Property Tests', () => {
  const pmSkill = new PMSkillImpl();

  /**
   * Property 2: Session Initialization from Any Input
   *
   * For ANY non-empty string `s`, `startRefinement(s)` creates a session with:
   * - status === 'in_progress'
   * - id is non-empty
   * - userNeed === s
   * - getNextQuestion(session) returns a non-null Question
   *
   * **Validates: Requirements 3.1**
   */
  describe('Property 2: Session Initialization from Any Input', () => {
    it('should create a valid session with in_progress status and first question available for any non-empty string', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          (userNeed: string) => {
            const session = pmSkill.startRefinement(userNeed);

            // Session status must be 'in_progress'
            expect(session.status).toBe('in_progress');

            // Session id must be non-empty
            expect(session.id).toBeDefined();
            expect(session.id.length).toBeGreaterThan(0);

            // Session userNeed must match the input
            expect(session.userNeed).toBe(userNeed);

            // getNextQuestion must return a non-null Question
            const question = pmSkill.getNextQuestion(session);
            expect(question).not.toBeNull();
            expect(question!.id).toBeDefined();
            expect(question!.text).toBeDefined();
            expect(question!.section).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: Insufficient Answer Triggers Follow-up
   *
   * For ANY required question where the answer is empty/whitespace-only:
   * - processAnswer does NOT advance the question index (follow-up is triggered)
   * - The question returned by getNextQuestion still has a followUp text
   *
   * **Validates: Requirements 3.7**
   */
  describe('Property 4: Insufficient Answer Triggers Follow-up', () => {
    it('should not advance question index and provide follow-up for any whitespace-only answer on a required question', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r')).filter((s) => s.length > 0),
          (whitespaceAnswer: string) => {
            // Start a session — the first question (bg_1) is required with followUpCondition
            const session = pmSkill.startRefinement('Test user need');

            const questionBefore = pmSkill.getNextQuestion(session);
            expect(questionBefore).not.toBeNull();
            expect(questionBefore!.required).toBe(true);

            // Record indices before processing
            const sectionIndexBefore = session.currentSectionIndex;
            const questionIndexBefore = session.currentQuestionIndex;

            // Process the whitespace-only answer
            const updatedSession = pmSkill.processAnswer(session, whitespaceAnswer);

            // The question index should NOT advance (follow-up triggered)
            expect(updatedSession.currentSectionIndex).toBe(sectionIndexBefore);
            expect(updatedSession.currentQuestionIndex).toBe(questionIndexBefore);

            // The question returned should still have a followUp text
            const questionAfter = pmSkill.getNextQuestion(updatedSession);
            expect(questionAfter).not.toBeNull();
            expect(questionAfter!.followUp).toBeDefined();
            expect(questionAfter!.followUp!.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

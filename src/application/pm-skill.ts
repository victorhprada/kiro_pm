/**
 * PM Skill Module — Rule-Based Refinement Session Logic
 *
 * Conducts refinement sessions using the PRD 8-Section structure
 * (from .kiro/skills/create-prd/) as a guided conversation flow.
 * No LLM dependency — frameworks define structure, code implements
 * as predefined question flows and generation templates.
 */

import {
  RefinementSession,
  Question,
  CollectedInfo,
  QuestionFlow,
} from '../domain/types';
import { WorkItemHierarchy } from '../domain/models';
import { QUESTION_FLOWS } from '../domain/question-templates';
import { WorkItemGeneratorImpl } from './work-item-generator';
import { DefaultHierarchyTemplateEngine } from '../domain/hierarchy-template-engine';

/**
 * Generates a unique session ID using crypto.randomUUID().
 */
function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Creates an empty CollectedInfo object with all required fields initialized.
 */
function createEmptyCollectedInfo(): CollectedInfo {
  return {
    context: '',
    objective: '',
    customerBenefit: '',
    targetAudience: '',
    customerJobs: '',
    customerGains: '',
    keyFeatures: '',
    scopeLimits: '',
    userScenarios: '',
    acceptanceCriteria: '',
  };
}

/**
 * Maps a question ID to the corresponding CollectedInfo field.
 */
function mapAnswerToCollectedInfo(
  collectedInfo: CollectedInfo,
  questionId: string,
  answer: string
): CollectedInfo {
  const mapping: Record<string, keyof CollectedInfo> = {
    bg_1: 'context',
    bg_2: 'whyNow',
    bg_3: 'recentlyPossible',
    obj_1: 'objective',
    obj_2: 'customerBenefit',
    obj_3: 'successMetrics',
    obj_4: 'strategicAlignment',
    mkt_1: 'targetAudience',
    mkt_2: 'constraints',
    vp_1: 'customerJobs',
    vp_2: 'customerGains',
    vp_3: 'competitiveAdvantage',
    sol_1: 'keyFeatures',
    sol_2: 'scopeLimits',
    sol_3: 'assumptions',
    sol_4: 'integrations',
    rel_1: 'v1Scope',
    rel_2: 'dependencies',
    rel_3: 'risks',
    us_1: 'userScenarios',
    us_2: 'alternativeScenarios',
    us_3: 'estimatedStories',
    ac_1: 'acceptanceCriteria',
    ac_2: 'businessRules',
    ac_3: 'definitionOfDone',
  };

  const field = mapping[questionId];
  if (field) {
    const updated = { ...collectedInfo };
    if (field === 'estimatedStories') {
      const num = parseInt(answer, 10);
      (updated as any)[field] = isNaN(num) ? undefined : num;
    } else {
      (updated as any)[field] = answer;
    }
    return updated;
  }
  return collectedInfo;
}

/**
 * PMSkill implementation — rule-based refinement session management.
 */
export class PMSkillImpl {
  private readonly questionFlows: QuestionFlow[];

  constructor(questionFlows?: QuestionFlow[]) {
    this.questionFlows = questionFlows ?? QUESTION_FLOWS;
  }

  /**
   * Creates a new refinement session with status 'in_progress'
   * and positions at the first question of the first section.
   *
   * Requirements: 3.1
   */
  startRefinement(userNeed: string): RefinementSession {
    if (!userNeed || userNeed.trim().length === 0) {
      throw new Error('User need cannot be empty');
    }

    return {
      id: generateSessionId(),
      userNeed,
      currentSectionIndex: 0,
      currentQuestionIndex: 0,
      answers: new Map<string, string>(),
      status: 'in_progress',
      collectedInfo: createEmptyCollectedInfo(),
    };
  }

  /**
   * Returns the current question based on section/question indices,
   * or null if the session is complete (all sections traversed).
   *
   * Requirements: 3.2, 3.3, 3.4, 3.5
   */
  getNextQuestion(session: RefinementSession): Question | null {
    const { currentSectionIndex, currentQuestionIndex } = session;

    // If we've gone past all sections, no more questions
    if (currentSectionIndex >= this.questionFlows.length) {
      return null;
    }

    const currentFlow = this.questionFlows[currentSectionIndex];

    // If we've gone past all questions in the current section, no more questions
    // (this shouldn't happen normally as processAnswer advances the section)
    if (currentQuestionIndex >= currentFlow.questions.length) {
      return null;
    }

    const template = currentFlow.questions[currentQuestionIndex];

    return {
      id: template.id,
      text: template.text,
      section: currentFlow.section,
      required: template.required,
      followUp: template.followUpText,
    };
  }

  /**
   * Processes an answer for the current question:
   * 1. If the answer is insufficient for a required question with followUpCondition,
   *    returns a session with a follow-up question (does not advance).
   * 2. Otherwise, stores the answer and advances to the next question/section.
   *
   * Requirements: 3.7
   */
  processAnswer(session: RefinementSession, answer: string): RefinementSession {
    const { currentSectionIndex, currentQuestionIndex } = session;

    // Safety check: if session is already complete, return as-is
    if (currentSectionIndex >= this.questionFlows.length) {
      return { ...session, status: 'completed' };
    }

    const currentFlow = this.questionFlows[currentSectionIndex];
    const template = currentFlow.questions[currentQuestionIndex];

    // Check follow-up condition: if answer is insufficient for a required question
    if (
      template.required &&
      template.followUpCondition &&
      template.followUpCondition(answer) &&
      template.followUpText
    ) {
      // Check if this is already a follow-up attempt (answer already stored as empty)
      // We allow one follow-up per question. If the user already got a follow-up
      // (indicated by having the question ID in answers with empty value), advance anyway.
      const previousAnswer = session.answers.get(template.id);
      if (previousAnswer === undefined) {
        // First insufficient answer — store it and trigger follow-up
        // We store a marker so next time we know follow-up was already shown
        const newAnswers = new Map(session.answers);
        newAnswers.set(template.id, answer);

        const newCollectedInfo = mapAnswerToCollectedInfo(
          session.collectedInfo,
          template.id,
          answer
        );

        return {
          ...session,
          answers: newAnswers,
          collectedInfo: newCollectedInfo,
          // Keep same indices — the follow-up question will be returned by getNextQuestion
          // but with the followUp text. We use a special flag approach:
          // Actually, we need to signal that a follow-up should be shown.
          // The design says: "return a follow-up question instead of advancing"
          // So we keep the indices the same, but the caller will see the followUp text.
        };
      }
    }

    // Store the answer and advance
    const newAnswers = new Map(session.answers);
    newAnswers.set(template.id, answer);

    const newCollectedInfo = mapAnswerToCollectedInfo(
      session.collectedInfo,
      template.id,
      answer
    );

    // Advance to next question or next section
    let nextSectionIndex = currentSectionIndex;
    let nextQuestionIndex = currentQuestionIndex + 1;

    // If we've exhausted questions in the current section, move to next section
    if (nextQuestionIndex >= currentFlow.questions.length) {
      nextSectionIndex += 1;
      nextQuestionIndex = 0;
    }

    // Determine if session is complete
    const isComplete = nextSectionIndex >= this.questionFlows.length;

    return {
      ...session,
      currentSectionIndex: nextSectionIndex,
      currentQuestionIndex: nextQuestionIndex,
      answers: newAnswers,
      collectedInfo: newCollectedInfo,
      status: isComplete ? 'completed' : 'in_progress',
    };
  }

  /**
   * Checks if the refinement session is complete:
   * - All sections have been traversed
   * - Minimum answer thresholds are met for each section
   *
   * Requirements: 3.6
   */
  isSessionComplete(session: RefinementSession): boolean {
    // Check if we've traversed all sections
    if (session.currentSectionIndex < this.questionFlows.length) {
      return false;
    }

    // Check minimum answer thresholds for each section
    for (const flow of this.questionFlows) {
      const answeredInSection = flow.questions.filter((q) => {
        const answer = session.answers.get(q.id);
        return answer !== undefined && answer.trim().length > 0;
      }).length;

      if (answeredInSection < flow.minAnswersRequired) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generates a WorkItemHierarchy from the session's collected info.
   * Delegates to WorkItemGenerator which uses HierarchyTemplateEngine
   * and HierarchyBuilder internally.
   *
   * Requirements: 3.6, 4.1, 4.2, 4.3
   */
  generateHierarchy(session: RefinementSession): WorkItemHierarchy {
    const generator = new WorkItemGeneratorImpl();
    return generator.generateHierarchy(session);
  }

  /**
   * Adjusts the hierarchy based on user feedback.
   * Delegates to HierarchyTemplateEngine.applyFeedback().
   *
   * Requirements: 5.3, 5.4
   */
  adjustHierarchy(
    hierarchy: WorkItemHierarchy,
    feedback: string
  ): WorkItemHierarchy {
    const engine = new DefaultHierarchyTemplateEngine();
    return engine.applyFeedback(hierarchy, feedback);
  }
}

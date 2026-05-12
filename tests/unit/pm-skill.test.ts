import { describe, it, expect } from 'vitest';
import { PMSkillImpl } from '../../src/application/pm-skill';
import { QUESTION_FLOWS } from '../../src/domain/question-templates';

describe('PMSkillImpl', () => {
  describe('startRefinement', () => {
    it('should create a session with status in_progress', () => {
      const skill = new PMSkillImpl();
      const session = skill.startRefinement('I need a login feature');

      expect(session.status).toBe('in_progress');
      expect(session.userNeed).toBe('I need a login feature');
      expect(session.currentSectionIndex).toBe(0);
      expect(session.currentQuestionIndex).toBe(0);
      expect(session.answers.size).toBe(0);
      expect(session.id).toBeTruthy();
    });

    it('should generate unique session IDs', () => {
      const skill = new PMSkillImpl();
      const session1 = skill.startRefinement('Need A');
      const session2 = skill.startRefinement('Need B');

      expect(session1.id).not.toBe(session2.id);
    });

    it('should throw for empty user need', () => {
      const skill = new PMSkillImpl();

      expect(() => skill.startRefinement('')).toThrow('User need cannot be empty');
      expect(() => skill.startRefinement('   ')).toThrow('User need cannot be empty');
    });
  });

  describe('getNextQuestion', () => {
    it('should return the first question from the first section', () => {
      const skill = new PMSkillImpl();
      const session = skill.startRefinement('Build a dashboard');

      const question = skill.getNextQuestion(session);

      expect(question).not.toBeNull();
      expect(question!.id).toBe('bg_1');
      expect(question!.section).toBe('background');
      expect(question!.required).toBe(true);
    });

    it('should return null when all sections are traversed', () => {
      const skill = new PMSkillImpl();
      const session = skill.startRefinement('Build a dashboard');

      // Set section index past all flows
      const completedSession = {
        ...session,
        currentSectionIndex: QUESTION_FLOWS.length,
      };

      const question = skill.getNextQuestion(completedSession);
      expect(question).toBeNull();
    });

    it('should return question with followUp text when available', () => {
      const skill = new PMSkillImpl();
      const session = skill.startRefinement('Build a dashboard');

      const question = skill.getNextQuestion(session);

      expect(question!.followUp).toBeTruthy();
      expect(question!.followUp).toContain('contexto');
    });
  });

  describe('processAnswer', () => {
    it('should store the answer and advance to next question', () => {
      const skill = new PMSkillImpl();
      const session = skill.startRefinement('Build a dashboard');

      const updated = skill.processAnswer(session, 'This is about building a dashboard for analytics');

      expect(updated.answers.get('bg_1')).toBe('This is about building a dashboard for analytics');
      expect(updated.currentQuestionIndex).toBe(1);
      expect(updated.currentSectionIndex).toBe(0);
      expect(updated.status).toBe('in_progress');
    });

    it('should advance to next section when current section questions are exhausted', () => {
      const skill = new PMSkillImpl();
      let session = skill.startRefinement('Build a dashboard');

      // Answer all 3 background questions
      session = skill.processAnswer(session, 'Context about the initiative');
      session = skill.processAnswer(session, 'Because market demands it now');
      session = skill.processAnswer(session, 'New tech made it possible');

      // Should now be in the objective section
      expect(session.currentSectionIndex).toBe(1);
      expect(session.currentQuestionIndex).toBe(0);

      const question = skill.getNextQuestion(session);
      expect(question!.section).toBe('objective');
    });

    it('should trigger follow-up for empty answer on required question', () => {
      const skill = new PMSkillImpl();
      const session = skill.startRefinement('Build a dashboard');

      // Provide empty answer to required question bg_1
      const updated = skill.processAnswer(session, '');

      // Should NOT advance — follow-up triggered
      expect(updated.currentSectionIndex).toBe(0);
      expect(updated.currentQuestionIndex).toBe(0);
      // Answer is stored (as marker for follow-up)
      expect(updated.answers.has('bg_1')).toBe(true);
    });

    it('should advance after second attempt even with empty answer (follow-up already shown)', () => {
      const skill = new PMSkillImpl();
      const session = skill.startRefinement('Build a dashboard');

      // First empty answer — triggers follow-up
      const afterFirstEmpty = skill.processAnswer(session, '');
      expect(afterFirstEmpty.currentQuestionIndex).toBe(0);

      // Second empty answer — should advance (follow-up was already shown)
      const afterSecondEmpty = skill.processAnswer(afterFirstEmpty, '');
      expect(afterSecondEmpty.currentQuestionIndex).toBe(1);
    });

    it('should advance after follow-up when user provides a real answer', () => {
      const skill = new PMSkillImpl();
      const session = skill.startRefinement('Build a dashboard');

      // First empty answer — triggers follow-up
      const afterEmpty = skill.processAnswer(session, '');
      expect(afterEmpty.currentQuestionIndex).toBe(0);

      // Now provide a real answer
      const afterReal = skill.processAnswer(afterEmpty, 'Here is the real context');
      expect(afterReal.currentQuestionIndex).toBe(1);
      expect(afterReal.answers.get('bg_1')).toBe('Here is the real context');
    });

    it('should update collectedInfo when storing answers', () => {
      const skill = new PMSkillImpl();
      const session = skill.startRefinement('Build a dashboard');

      const updated = skill.processAnswer(session, 'Analytics dashboard for sales team');

      expect(updated.collectedInfo.context).toBe('Analytics dashboard for sales team');
    });

    it('should mark session as completed when all sections are traversed', () => {
      const skill = new PMSkillImpl();
      let session = skill.startRefinement('Build a dashboard');

      // Answer all questions across all sections
      for (const flow of QUESTION_FLOWS) {
        for (let i = 0; i < flow.questions.length; i++) {
          session = skill.processAnswer(session, `Answer for ${flow.questions[i].id}`);
        }
      }

      expect(session.status).toBe('completed');
      expect(session.currentSectionIndex).toBe(QUESTION_FLOWS.length);
    });
  });

  describe('isSessionComplete', () => {
    it('should return false for a fresh session', () => {
      const skill = new PMSkillImpl();
      const session = skill.startRefinement('Build a dashboard');

      expect(skill.isSessionComplete(session)).toBe(false);
    });

    it('should return true when all sections traversed and thresholds met', () => {
      const skill = new PMSkillImpl();
      let session = skill.startRefinement('Build a dashboard');

      // Answer all questions with non-empty answers
      for (const flow of QUESTION_FLOWS) {
        for (let i = 0; i < flow.questions.length; i++) {
          session = skill.processAnswer(session, `Answer for ${flow.questions[i].id}`);
        }
      }

      expect(skill.isSessionComplete(session)).toBe(true);
    });

    it('should return false when minimum thresholds are not met', () => {
      const skill = new PMSkillImpl();
      let session = skill.startRefinement('Build a dashboard');

      // Answer all questions but with empty answers for required ones
      // This simulates going through all sections but not meeting thresholds
      for (const flow of QUESTION_FLOWS) {
        for (let i = 0; i < flow.questions.length; i++) {
          // First attempt empty (triggers follow-up for required)
          session = skill.processAnswer(session, '');
          // If still on same question (follow-up triggered), answer empty again to advance
          const currentFlow = QUESTION_FLOWS[session.currentSectionIndex < QUESTION_FLOWS.length ? session.currentSectionIndex : QUESTION_FLOWS.length - 1];
          if (
            session.currentSectionIndex < QUESTION_FLOWS.length &&
            session.currentQuestionIndex === i &&
            currentFlow.section === flow.section
          ) {
            session = skill.processAnswer(session, '');
          }
        }
      }

      // Session traversed all sections but answers are empty
      // Sections with minAnswersRequired > 0 won't be satisfied
      expect(skill.isSessionComplete(session)).toBe(false);
    });
  });

  describe('generateHierarchy', () => {
    it('should generate a hierarchy with epic, feature, and user stories', () => {
      const skill = new PMSkillImpl();
      let session = skill.startRefinement('Build a dashboard');

      // Provide meaningful answers
      session = skill.processAnswer(session, 'Analytics dashboard for sales'); // bg_1 -> context
      session = skill.processAnswer(session, 'Market demands real-time data'); // bg_2 -> whyNow
      session = skill.processAnswer(session, 'Cloud tech now available'); // bg_3
      session = skill.processAnswer(session, 'Increase sales visibility'); // obj_1 -> objective
      session = skill.processAnswer(session, 'Better decisions for team'); // obj_2 -> customerBenefit
      session = skill.processAnswer(session, 'Revenue +20%'); // obj_3
      session = skill.processAnswer(session, 'Aligns with data strategy'); // obj_4
      session = skill.processAnswer(session, 'Sales managers'); // mkt_1 -> targetAudience
      session = skill.processAnswer(session, 'Must work on mobile'); // mkt_2
      session = skill.processAnswer(session, 'Track pipeline metrics'); // vp_1 -> customerJobs
      session = skill.processAnswer(session, 'Save 2h/day on reports'); // vp_2 -> customerGains
      session = skill.processAnswer(session, 'Real-time vs competitors'); // vp_3
      session = skill.processAnswer(session, 'Dashboard with charts and filters'); // sol_1 -> keyFeatures
      session = skill.processAnswer(session, 'No CRM integration in v1'); // sol_2 -> scopeLimits
      session = skill.processAnswer(session, 'Users want real-time'); // sol_3
      session = skill.processAnswer(session, 'Salesforce API'); // sol_4
      session = skill.processAnswer(session, 'v1: basic charts'); // rel_1
      session = skill.processAnswer(session, 'Depends on data team'); // rel_2
      session = skill.processAnswer(session, 'Data quality risk'); // rel_3
      session = skill.processAnswer(session, 'When viewing pipeline, I want charts, so I can decide'); // us_1
      session = skill.processAnswer(session, 'Error when no data'); // us_2
      session = skill.processAnswer(session, '5'); // us_3
      session = skill.processAnswer(session, 'Charts load in <2s'); // ac_1
      session = skill.processAnswer(session, 'Only show own team data'); // ac_2
      session = skill.processAnswer(session, 'All tests pass'); // ac_3

      const hierarchy = skill.generateHierarchy(session);

      expect(hierarchy.epic).toBeDefined();
      expect(hierarchy.epic.title).toBeTruthy();
      expect(hierarchy.epic.description).toBeTruthy();
      expect(hierarchy.feature).toBeDefined();
      expect(hierarchy.feature.title).toBeTruthy();
      expect(hierarchy.feature.description).toBeTruthy();
      expect(hierarchy.userStories.length).toBeGreaterThanOrEqual(1);
      expect(hierarchy.userStories[0].title).toBeTruthy();
      expect(hierarchy.userStories[0].acceptanceCriteria).toBeTruthy();
    });
  });

  describe('adjustHierarchy', () => {
    it('should return the hierarchy (stub implementation)', () => {
      const skill = new PMSkillImpl();
      const hierarchy = {
        epic: { title: 'Epic', description: '<p>Desc</p>', areaPath: '' },
        feature: { title: 'Feature', description: '<p>Desc</p>', areaPath: '' },
        userStories: [
          { title: 'US1', description: '<p>Desc</p>', acceptanceCriteria: '<ul><li>AC</li></ul>', areaPath: '' },
        ],
      };

      const adjusted = skill.adjustHierarchy(hierarchy, 'Change the title');

      expect(adjusted.epic.title).toBe('Epic');
      expect(adjusted.feature.title).toBe('Feature');
      expect(adjusted.userStories.length).toBe(1);
    });
  });
});

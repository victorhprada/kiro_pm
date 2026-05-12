import { describe, it, expect } from 'vitest';
import { WorkItemGeneratorImpl } from '../../src/application/work-item-generator';
import { RefinementSession, CollectedInfo } from '../../src/domain/types';

function createTestSession(overrides: Partial<CollectedInfo> = {}): RefinementSession {
  const collectedInfo: CollectedInfo = {
    context: 'Implementar sistema de notificações push',
    objective: 'Aumentar engajamento dos usuários com notificações em tempo real',
    customerBenefit: 'Usuários ficam informados sobre atualizações importantes',
    targetAudience: 'Usuários mobile da plataforma',
    customerJobs: 'Receber alertas sobre eventos relevantes',
    customerGains: 'Não perder informações importantes, economia de tempo',
    keyFeatures: 'Push notifications\nPreferências de notificação\nAgrupamento de notificações',
    scopeLimits: 'Não inclui notificações por email ou SMS',
    userScenarios: 'Quando um pedido é atualizado, eu quero receber uma notificação push, para que eu saiba o status sem abrir o app',
    acceptanceCriteria: 'Notificação é recebida em até 5 segundos\nNotificação mostra título e resumo\nUsuário pode desativar notificações',
    ...overrides,
  };

  return {
    id: 'test-session-id',
    userNeed: 'Sistema de notificações push para engajamento',
    currentSectionIndex: 8,
    currentQuestionIndex: 0,
    answers: new Map(),
    status: 'completed',
    collectedInfo,
  };
}

describe('WorkItemGeneratorImpl', () => {
  const generator = new WorkItemGeneratorImpl();

  describe('generateHierarchy()', () => {
    it('should generate a hierarchy with exactly 1 Epic, 1 Feature, and ≥1 User Story', () => {
      const session = createTestSession();
      const hierarchy = generator.generateHierarchy(session);

      expect(hierarchy.epic).toBeDefined();
      expect(hierarchy.feature).toBeDefined();
      expect(hierarchy.userStories).toBeDefined();
      expect(hierarchy.userStories.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate Epic with non-empty title and description', () => {
      const session = createTestSession();
      const hierarchy = generator.generateHierarchy(session);

      expect(hierarchy.epic.title.trim().length).toBeGreaterThan(0);
      expect(hierarchy.epic.description.trim().length).toBeGreaterThan(0);
    });

    it('should generate Feature with non-empty title and description', () => {
      const session = createTestSession();
      const hierarchy = generator.generateHierarchy(session);

      expect(hierarchy.feature.title.trim().length).toBeGreaterThan(0);
      expect(hierarchy.feature.description.trim().length).toBeGreaterThan(0);
    });

    it('should generate User Stories with non-empty title, description, and acceptance criteria', () => {
      const session = createTestSession();
      const hierarchy = generator.generateHierarchy(session);

      for (const story of hierarchy.userStories) {
        expect(story.title.trim().length).toBeGreaterThan(0);
        expect(story.description.trim().length).toBeGreaterThan(0);
        expect(story.acceptanceCriteria.trim().length).toBeGreaterThan(0);
      }
    });

    it('should generate multiple User Stories when multiple scenarios are provided', () => {
      const session = createTestSession({
        userScenarios: 'Quando um pedido é atualizado, eu quero receber uma notificação\nQuando há uma promoção, eu quero ser alertado\nQuando meu pagamento é confirmado, eu quero ver a confirmação',
      });
      const hierarchy = generator.generateHierarchy(session);

      expect(hierarchy.userStories.length).toBeGreaterThanOrEqual(2);
    });

    it('should use HierarchyTemplateEngine to build Epic from context/objective', () => {
      const session = createTestSession({
        context: 'Contexto do projeto de notificações',
        objective: 'Melhorar retenção de usuários',
      });
      const hierarchy = generator.generateHierarchy(session);

      // Epic title should be derived from objective
      expect(hierarchy.epic.title).toContain('Melhorar retenção');
      // Epic description should contain context
      expect(hierarchy.epic.description).toContain('Contexto do projeto');
    });
  });

  describe('formatDescription()', () => {
    it('should format single-line content as HTML paragraph', () => {
      const result = generator.formatDescription('Simple description');
      expect(result).toBe('<p>Simple description</p>');
    });

    it('should format multi-line content as multiple HTML paragraphs', () => {
      const result = generator.formatDescription('Line 1\nLine 2\nLine 3');
      expect(result).toBe('<p>Line 1</p><p>Line 2</p><p>Line 3</p>');
    });

    it('should escape HTML special characters', () => {
      const result = generator.formatDescription('Use <div> & "quotes"');
      expect(result).toContain('&lt;div&gt;');
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;quotes&quot;');
    });

    it('should return empty string for empty input', () => {
      expect(generator.formatDescription('')).toBe('');
    });

    it('should skip empty lines', () => {
      const result = generator.formatDescription('Line 1\n\nLine 2');
      expect(result).toBe('<p>Line 1</p><p>Line 2</p>');
    });
  });

  describe('formatAcceptanceCriteria()', () => {
    it('should format criteria as HTML unordered list', () => {
      const criteria = ['Criterion 1', 'Criterion 2', 'Criterion 3'];
      const result = generator.formatAcceptanceCriteria(criteria);

      expect(result).toContain('<ul>');
      expect(result).toContain('</ul>');
      expect(result).toContain('<li>Criterion 1</li>');
      expect(result).toContain('<li>Criterion 2</li>');
      expect(result).toContain('<li>Criterion 3</li>');
    });

    it('should escape HTML in criteria items', () => {
      const criteria = ['Check <input> field', 'Validate & submit'];
      const result = generator.formatAcceptanceCriteria(criteria);

      expect(result).toContain('&lt;input&gt;');
      expect(result).toContain('&amp;');
    });

    it('should return empty string for empty array', () => {
      expect(generator.formatAcceptanceCriteria([])).toBe('');
    });

    it('should handle single criterion', () => {
      const result = generator.formatAcceptanceCriteria(['Only one']);
      expect(result).toBe('<ul><li>Only one</li></ul>');
    });
  });
});

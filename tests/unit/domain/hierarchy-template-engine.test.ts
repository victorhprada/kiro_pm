import { describe, it, expect } from 'vitest';
import { DefaultHierarchyTemplateEngine } from '../../../src/domain/hierarchy-template-engine';
import { CollectedInfo } from '../../../src/domain/types';
import { UserStoryData, WorkItemHierarchy } from '../../../src/domain/models';

function makeCollectedInfo(overrides: Partial<CollectedInfo> = {}): CollectedInfo {
  return {
    context: 'Iniciativa para automatizar criação de work items no Azure DevOps',
    objective: 'Reduzir tempo de criação de work items em 80%',
    customerBenefit: 'Equipes de desenvolvimento ganham produtividade e padronização',
    targetAudience: 'Product Managers e Tech Leads',
    customerJobs: 'Criar work items estruturados rapidamente',
    customerGains: 'Menos tempo gasto em tarefas repetitivas, mais consistência',
    keyFeatures: 'Criação automática de hierarquia Epic/Feature/User Stories\nRefinamento guiado por perguntas\nIntegração direta com Azure DevOps',
    scopeLimits: 'Não inclui edição de work items existentes',
    userScenarios: 'Quando o PM precisa criar uma nova feature, eu quero gerar a hierarquia automaticamente, para que não precise criar manualmente\nQuando o time inicia um sprint, eu quero ter as user stories prontas, para que o planejamento seja mais rápido',
    acceptanceCriteria: 'O sistema gera exatamente 1 Epic\nO sistema gera exatamente 1 Feature vinculada ao Epic\nO sistema gera pelo menos 1 User Story vinculada à Feature\nCada User Story tem título, descrição e critérios de aceitação',
    ...overrides,
  };
}

describe('DefaultHierarchyTemplateEngine', () => {
  const engine = new DefaultHierarchyTemplateEngine();

  describe('buildEpic()', () => {
    it('should generate an Epic with title from objective', () => {
      const info = makeCollectedInfo();
      const epic = engine.buildEpic(info);

      expect(epic.title).toBe('Reduzir tempo de criação de work items em 80%');
      expect(epic.description).toContain('<h3>Contexto</h3>');
      expect(epic.description).toContain('<h3>Objetivo</h3>');
      expect(epic.description).toContain('<h3>Benefício</h3>');
      expect(epic.description).toContain('<h3>Público-alvo</h3>');
      expect(epic.areaPath).toBe('');
    });

    it('should include whyNow in description when provided', () => {
      const info = makeCollectedInfo({ whyNow: 'Crescimento do time exige padronização' });
      const epic = engine.buildEpic(info);

      expect(epic.description).toContain('<h3>Por que agora?</h3>');
      expect(epic.description).toContain('Crescimento do time exige padronização');
    });

    it('should fallback to context for title when objective is empty', () => {
      const info = makeCollectedInfo({ objective: '' });
      const epic = engine.buildEpic(info);

      expect(epic.title).toContain('Iniciativa para automatizar');
    });

    it('should truncate long titles to 80 characters', () => {
      const longObjective = 'A'.repeat(100);
      const info = makeCollectedInfo({ objective: longObjective });
      const epic = engine.buildEpic(info);

      expect(epic.title.length).toBeLessThanOrEqual(80);
    });

    it('should escape HTML characters in description', () => {
      const info = makeCollectedInfo({ context: 'Use <script> & "quotes"' });
      const epic = engine.buildEpic(info);

      expect(epic.description).toContain('&lt;script&gt;');
      expect(epic.description).toContain('&amp;');
      expect(epic.description).toContain('&quot;quotes&quot;');
    });
  });

  describe('buildFeature()', () => {
    it('should generate a Feature with title from first line of keyFeatures', () => {
      const info = makeCollectedInfo();
      const feature = engine.buildFeature(info);

      expect(feature.title).toBe('Criação automática de hierarquia Epic/Feature/User Stories');
      expect(feature.description).toContain('<h3>Necessidades dos Clientes</h3>');
      expect(feature.description).toContain('<h3>Funcionalidades-chave</h3>');
      expect(feature.description).toContain('<h3>Limites do Escopo</h3>');
      expect(feature.areaPath).toBe('');
    });

    it('should render keyFeatures as HTML list when multiple lines', () => {
      const info = makeCollectedInfo();
      const feature = engine.buildFeature(info);

      expect(feature.description).toContain('<ul>');
      expect(feature.description).toContain('<li>');
    });

    it('should strip bullet prefixes from feature title', () => {
      const info = makeCollectedInfo({ keyFeatures: '- Minha feature principal\n- Outra feature' });
      const feature = engine.buildFeature(info);

      expect(feature.title).toBe('Minha feature principal');
    });

    it('should include integrations when provided', () => {
      const info = makeCollectedInfo({ integrations: 'Azure DevOps REST API v7.1' });
      const feature = engine.buildFeature(info);

      expect(feature.description).toContain('<h3>Integrações</h3>');
      expect(feature.description).toContain('Azure DevOps REST API v7.1');
    });
  });

  describe('buildUserStories()', () => {
    it('should generate multiple user stories from scenarios', () => {
      const info = makeCollectedInfo();
      const stories = engine.buildUserStories(info);

      expect(stories.length).toBeGreaterThanOrEqual(2);
    });

    it('should generate stories with non-empty title, description, and criteria', () => {
      const info = makeCollectedInfo();
      const stories = engine.buildUserStories(info);

      stories.forEach(story => {
        expect(story.title.length).toBeGreaterThan(0);
        expect(story.description.length).toBeGreaterThan(0);
        expect(story.acceptanceCriteria.length).toBeGreaterThan(0);
      });
    });

    it('should format description using "Como [role], eu quero [action], para que [benefit]"', () => {
      const info = makeCollectedInfo();
      const stories = engine.buildUserStories(info);

      stories.forEach(story => {
        expect(story.description).toContain('Como');
        expect(story.description).toContain('eu quero');
        expect(story.description).toContain('para que');
      });
    });

    it('should format acceptance criteria as HTML list', () => {
      const info = makeCollectedInfo();
      const stories = engine.buildUserStories(info);

      stories.forEach(story => {
        expect(story.acceptanceCriteria).toContain('<ul>');
        expect(story.acceptanceCriteria).toContain('<li>');
        expect(story.acceptanceCriteria).toContain('</ul>');
      });
    });

    it('should handle single scenario input', () => {
      const info = makeCollectedInfo({
        userScenarios: 'Quando o usuário clica em criar, eu quero gerar os work items, para que o processo seja automatizado',
      });
      const stories = engine.buildUserStories(info);

      expect(stories.length).toBe(1);
      expect(stories[0].title.length).toBeGreaterThan(0);
    });

    it('should generate at least one story even with empty scenarios', () => {
      const info = makeCollectedInfo({ userScenarios: '' });
      const stories = engine.buildUserStories(info);

      expect(stories.length).toBe(1);
    });

    it('should use targetAudience as role in description', () => {
      const info = makeCollectedInfo({ targetAudience: 'Desenvolvedores' });
      const stories = engine.buildUserStories(info);

      expect(stories[0].description.toLowerCase()).toContain('desenvolvedores');
    });
  });

  describe('validateINVEST()', () => {
    const validStory: UserStoryData = {
      title: 'Configurar conexão com Azure DevOps',
      description: '<p>Como usuário, eu quero configurar minha conexão, para que possa criar work items.</p>',
      acceptanceCriteria: '<ul>\n  <li>Valida PAT</li>\n  <li>Mostra erro se inválido</li>\n  <li>Confirma conexão</li>\n</ul>',
      areaPath: '',
    };

    it('should pass all INVEST criteria for a well-formed story', () => {
      const result = engine.validateINVEST(validStory);

      expect(result.passed).toBe(true);
      expect(result.independent).toBe(true);
      expect(result.negotiable).toBe(true);
      expect(result.valuable).toBe(true);
      expect(result.estimable).toBe(true);
      expect(result.small).toBe(true);
      expect(result.testable).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should fail Independent when story has dependency keywords', () => {
      const story: UserStoryData = {
        ...validStory,
        description: '<p>Como usuário, eu quero X, para que Y. Depende de a feature de autenticação estar pronta.</p>',
      };
      const result = engine.validateINVEST(story);

      expect(result.independent).toBe(false);
      expect(result.passed).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should fail Negotiable when description is too long', () => {
      const story: UserStoryData = {
        ...validStory,
        description: '<p>' + 'A'.repeat(501) + '</p>',
      };
      const result = engine.validateINVEST(story);

      expect(result.negotiable).toBe(false);
    });

    it('should fail Valuable when no benefit statement', () => {
      const story: UserStoryData = {
        ...validStory,
        title: 'Implementar módulo X',
        description: '<p>Implementar o módulo X com as configurações necessárias.</p>',
      };
      const result = engine.validateINVEST(story);

      expect(result.valuable).toBe(false);
    });

    it('should fail Small when more than 6 acceptance criteria', () => {
      const criteria = Array.from({ length: 7 }, (_, i) => `  <li>Critério ${i + 1}</li>`).join('\n');
      const story: UserStoryData = {
        ...validStory,
        acceptanceCriteria: `<ul>\n${criteria}\n</ul>`,
      };
      const result = engine.validateINVEST(story);

      expect(result.small).toBe(false);
    });

    it('should fail Testable when acceptance criteria is empty', () => {
      const story: UserStoryData = {
        ...validStory,
        acceptanceCriteria: '<ul><li>Critérios de aceitação a serem definidos</li></ul>',
      };
      const result = engine.validateINVEST(story);

      expect(result.testable).toBe(false);
    });
  });

  describe('applyFeedback()', () => {
    it('should return the hierarchy unchanged (simple implementation)', () => {
      const hierarchy: WorkItemHierarchy = {
        epic: { title: 'Epic', description: '<p>Desc</p>', areaPath: '' },
        feature: { title: 'Feature', description: '<p>Desc</p>', areaPath: '' },
        userStories: [
          { title: 'Story 1', description: '<p>Desc</p>', acceptanceCriteria: '<ul><li>AC</li></ul>', areaPath: '' },
        ],
      };

      const result = engine.applyFeedback(hierarchy, 'Adicionar mais detalhes');

      expect(result.epic.title).toBe(hierarchy.epic.title);
      expect(result.feature.title).toBe(hierarchy.feature.title);
      expect(result.userStories).toEqual(hierarchy.userStories);
    });
  });
});

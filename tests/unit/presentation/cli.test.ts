/**
 * Unit tests for CLI presentation layer.
 *
 * Tests the CLI class methods by mocking inquirer prompts
 * and verifying correct behavior for each interaction.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  Project,
  Team,
  Sprint,
  WorkItemHierarchy,
  CreationResult,
} from '../../../src/domain/models';
import type { Question } from '../../../src/domain/types';

// Mock inquirer's dynamic import
const mockPrompt = vi.fn();
vi.mock('inquirer', () => ({
  default: {
    prompt: (...args: unknown[]) => mockPrompt(...args),
  },
}));

import { CLI } from '../../../src/presentation/cli';

describe('CLI', () => {
  let cli: CLI;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    cli = new CLI();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockPrompt.mockReset();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('promptCredentials', () => {
    it('should return organization URL and PAT from user input', async () => {
      mockPrompt.mockResolvedValue({
        organizationUrl: 'https://dev.azure.com/myorg',
        pat: 'my-secret-pat',
      });

      const result = await cli.promptCredentials();

      expect(result.organizationUrl).toBe('https://dev.azure.com/myorg');
      expect(result.pat).toBe('my-secret-pat');
    });

    it('should trim whitespace from inputs', async () => {
      mockPrompt.mockResolvedValue({
        organizationUrl: '  https://dev.azure.com/myorg  ',
        pat: '  my-pat  ',
      });

      const result = await cli.promptCredentials();

      expect(result.organizationUrl).toBe('https://dev.azure.com/myorg');
      expect(result.pat).toBe('my-pat');
    });

    it('should configure PAT as password type with mask', async () => {
      mockPrompt.mockResolvedValue({
        organizationUrl: 'https://dev.azure.com/org',
        pat: 'token',
      });

      await cli.promptCredentials();

      const promptConfig = mockPrompt.mock.calls[0][0];
      const patQuestion = promptConfig.find((q: { name: string }) => q.name === 'pat');
      expect(patQuestion.type).toBe('password');
      expect(patQuestion.mask).toBe('*');
    });

    it('should validate that URL starts with https://', async () => {
      mockPrompt.mockResolvedValue({
        organizationUrl: 'https://dev.azure.com/org',
        pat: 'token',
      });

      await cli.promptCredentials();

      const promptConfig = mockPrompt.mock.calls[0][0];
      const urlQuestion = promptConfig.find((q: { name: string }) => q.name === 'organizationUrl');
      expect(urlQuestion.validate('http://invalid.com')).toBe('A URL deve começar com https://');
      expect(urlQuestion.validate('')).toBe('A URL da organização é obrigatória.');
      expect(urlQuestion.validate('https://dev.azure.com/org')).toBe(true);
    });

    it('should validate that PAT is not empty', async () => {
      mockPrompt.mockResolvedValue({
        organizationUrl: 'https://dev.azure.com/org',
        pat: 'token',
      });

      await cli.promptCredentials();

      const promptConfig = mockPrompt.mock.calls[0][0];
      const patQuestion = promptConfig.find((q: { name: string }) => q.name === 'pat');
      expect(patQuestion.validate('')).toBe('O PAT é obrigatório.');
      expect(patQuestion.validate('  ')).toBe('O PAT é obrigatório.');
      expect(patQuestion.validate('valid-pat')).toBe(true);
    });
  });

  describe('selectProject', () => {
    const projects: Project[] = [
      { id: 'p1', name: 'Project Alpha', description: 'First project' },
      { id: 'p2', name: 'Project Beta' },
    ];

    it('should return the selected project', async () => {
      mockPrompt.mockResolvedValue({ projectId: 'p1' });

      const result = await cli.selectProject(projects);

      expect(result).toEqual(projects[0]);
    });

    it('should throw when projects list is empty', async () => {
      await expect(cli.selectProject([])).rejects.toThrow(
        'Nenhum projeto disponível na organização.'
      );
    });

    it('should display project description when available', async () => {
      mockPrompt.mockResolvedValue({ projectId: 'p1' });

      await cli.selectProject(projects);

      const promptConfig = mockPrompt.mock.calls[0][0];
      const choices = promptConfig[0].choices;
      expect(choices[0].name).toBe('Project Alpha — First project');
      expect(choices[1].name).toBe('Project Beta');
    });
  });

  describe('selectTeam', () => {
    const teams: Team[] = [
      { id: 't1', name: 'Team Frontend', projectId: 'p1' },
      { id: 't2', name: 'Team Backend', projectId: 'p1' },
    ];

    it('should return the selected team', async () => {
      mockPrompt.mockResolvedValue({ teamId: 't2' });

      const result = await cli.selectTeam(teams);

      expect(result).toEqual(teams[1]);
    });

    it('should throw when teams list is empty', async () => {
      await expect(cli.selectTeam([])).rejects.toThrow(
        'Não há times disponíveis no projeto selecionado.'
      );
    });
  });

  describe('selectSprint', () => {
    const sprints: Sprint[] = [
      {
        id: 's1',
        name: 'Sprint 1',
        path: 'Project\\Sprint 1',
        status: 'past',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-14'),
      },
      {
        id: 's2',
        name: 'Sprint 2',
        path: 'Project\\Sprint 2',
        status: 'current',
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-01-28'),
      },
      {
        id: 's3',
        name: 'Sprint 3',
        path: 'Project\\Sprint 3',
        status: 'future',
      },
    ];

    it('should return the selected sprint', async () => {
      mockPrompt.mockResolvedValue({ sprintId: 's2' });

      const result = await cli.selectSprint(sprints);

      expect(result).toEqual(sprints[1]);
    });

    it('should throw when sprints list is empty', async () => {
      await expect(cli.selectSprint([])).rejects.toThrow(
        'Não há sprints disponíveis para o time selecionado.'
      );
    });

    it('should display status indicators for sprints', async () => {
      mockPrompt.mockResolvedValue({ sprintId: 's1' });

      await cli.selectSprint(sprints);

      const promptConfig = mockPrompt.mock.calls[0][0];
      const choices = promptConfig[0].choices;
      expect(choices[0].name).toContain('◌ '); // past
      expect(choices[1].name).toContain('● '); // current
      expect(choices[2].name).toContain('○ '); // future
    });

    it('should display date range when available', async () => {
      mockPrompt.mockResolvedValue({ sprintId: 's1' });

      await cli.selectSprint(sprints);

      const promptConfig = mockPrompt.mock.calls[0][0];
      const choices = promptConfig[0].choices;
      // Sprint with dates should show date range
      expect(choices[0].name).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      // Sprint without dates should not show parentheses
      expect(choices[2].name).not.toContain('(');
    });
  });

  describe('promptUserNeed', () => {
    it('should return the user need text', async () => {
      mockPrompt.mockResolvedValue({ userNeed: 'I need a login page' });

      const result = await cli.promptUserNeed();

      expect(result).toBe('I need a login page');
    });

    it('should trim whitespace', async () => {
      mockPrompt.mockResolvedValue({ userNeed: '  login feature  ' });

      const result = await cli.promptUserNeed();

      expect(result).toBe('login feature');
    });

    it('should validate non-empty input', async () => {
      mockPrompt.mockResolvedValue({ userNeed: 'something' });

      await cli.promptUserNeed();

      const promptConfig = mockPrompt.mock.calls[0][0];
      const question = promptConfig[0];
      expect(question.validate('')).toBe('A descrição da necessidade é obrigatória.');
      expect(question.validate('  ')).toBe('A descrição da necessidade é obrigatória.');
      expect(question.validate('valid')).toBe(true);
    });
  });

  describe('displayQuestion', () => {
    it('should display the question text with section', () => {
      const question: Question = {
        id: 'bg_1',
        text: 'What is the context?',
        section: 'background',
        required: true,
      };

      cli.displayQuestion(question);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[BACKGROUND]')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('What is the context?')
      );
    });

    it('should show optional indicator for non-required questions', () => {
      const question: Question = {
        id: 'bg_3',
        text: 'Optional question?',
        section: 'background',
        required: false,
      };

      cli.displayQuestion(question);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('opcional')
      );
    });

    it('should not show optional indicator for required questions', () => {
      const question: Question = {
        id: 'bg_1',
        text: 'Required question?',
        section: 'background',
        required: true,
      };

      cli.displayQuestion(question);

      const calls = consoleSpy.mock.calls.map((c) => c[0]);
      const hasOptional = calls.some(
        (c) => typeof c === 'string' && c.includes('opcional')
      );
      expect(hasOptional).toBe(false);
    });
  });

  describe('promptAnswer', () => {
    it('should return the user answer', async () => {
      mockPrompt.mockResolvedValue({ answer: 'My answer' });

      const result = await cli.promptAnswer();

      expect(result).toBe('My answer');
    });

    it('should trim whitespace', async () => {
      mockPrompt.mockResolvedValue({ answer: '  trimmed  ' });

      const result = await cli.promptAnswer();

      expect(result).toBe('trimmed');
    });

    it('should allow empty answers (for optional questions)', async () => {
      mockPrompt.mockResolvedValue({ answer: '' });

      const result = await cli.promptAnswer();

      expect(result).toBe('');
    });
  });

  describe('displayHierarchy', () => {
    const hierarchy: WorkItemHierarchy = {
      epic: {
        title: 'Login System',
        description: '<p>Implement a login system</p>',
        areaPath: 'Project\\Area',
      },
      feature: {
        title: 'User Authentication',
        description: '<p>OAuth2 authentication flow</p>',
        areaPath: 'Project\\Area',
      },
      userStories: [
        {
          title: 'Login form',
          description: '<p>As a user, I want a login form</p>',
          acceptanceCriteria: '<ul><li>Email field</li><li>Password field</li></ul>',
          areaPath: 'Project\\Area',
        },
        {
          title: 'Password reset',
          description: '<p>As a user, I want to reset my password</p>',
          acceptanceCriteria: '<ul><li>Reset link sent</li></ul>',
          areaPath: 'Project\\Area',
        },
      ],
    };

    it('should display the epic title', () => {
      cli.displayHierarchy(hierarchy);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('EPIC: Login System');
    });

    it('should display the feature title', () => {
      cli.displayHierarchy(hierarchy);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('FEATURE: User Authentication');
    });

    it('should display all user stories', () => {
      cli.displayHierarchy(hierarchy);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('US1: Login form');
      expect(output).toContain('US2: Password reset');
    });

    it('should strip HTML from descriptions', () => {
      cli.displayHierarchy(hierarchy);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).not.toContain('<p>');
      expect(output).not.toContain('</p>');
      expect(output).toContain('Implement a login system');
    });
  });

  describe('promptApproval', () => {
    it('should return approved when user approves', async () => {
      mockPrompt.mockResolvedValue({ action: 'approve' });

      const result = await cli.promptApproval();

      expect(result).toEqual({ approved: true });
    });

    it('should return not approved when user rejects', async () => {
      mockPrompt.mockResolvedValue({ action: 'reject' });

      const result = await cli.promptApproval();

      expect(result).toEqual({ approved: false });
    });

    it('should return addMoreStories when user wants more stories', async () => {
      mockPrompt.mockResolvedValue({ action: 'add_more' });

      const result = await cli.promptApproval();

      expect(result).toEqual({ approved: false, addMoreStories: true });
    });
  });

  describe('promptFeedback', () => {
    it('should return the feedback text', async () => {
      mockPrompt.mockResolvedValue({ feedback: 'Change the title' });

      const result = await cli.promptFeedback();

      expect(result).toBe('Change the title');
    });

    it('should validate non-empty feedback', async () => {
      mockPrompt.mockResolvedValue({ feedback: 'something' });

      await cli.promptFeedback();

      const promptConfig = mockPrompt.mock.calls[0][0];
      const question = promptConfig[0];
      expect(question.validate('')).toBe(
        'O feedback é obrigatório para ajustar as demandas.'
      );
      expect(question.validate('valid')).toBe(true);
    });
  });

  describe('displayCreationResult', () => {
    it('should display success message with work item details', () => {
      const result: CreationResult = {
        success: true,
        workItems: [
          { id: 101, url: 'https://dev.azure.com/org/project/_workitems/edit/101', type: 'Epic', title: 'My Epic' },
          { id: 102, url: 'https://dev.azure.com/org/project/_workitems/edit/102', type: 'Feature', title: 'My Feature' },
          { id: 103, url: 'https://dev.azure.com/org/project/_workitems/edit/103', type: 'User Story', title: 'My Story' },
        ],
        errors: [],
      };

      cli.displayCreationResult(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('CRIADOS COM SUCESSO');
      expect(output).toContain('ID: 101');
      expect(output).toContain('ID: 102');
      expect(output).toContain('ID: 103');
      expect(output).toContain('https://dev.azure.com/org/project/_workitems/edit/101');
    });

    it('should display partial failure with errors', () => {
      const result: CreationResult = {
        success: false,
        workItems: [
          { id: 101, url: 'https://dev.azure.com/org/project/_workitems/edit/101', type: 'Epic', title: 'My Epic' },
        ],
        errors: [
          { workItemType: 'Feature', title: 'My Feature', error: 'Permission denied' },
        ],
      };

      cli.displayCreationResult(result);

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('ERROS ENCONTRADOS');
      expect(output).toContain('ID: 101');
      expect(output).toContain('Permission denied');
      expect(output).toContain('[Feature]');
    });
  });

  describe('displayError', () => {
    it('should display error message', () => {
      cli.displayError('Something went wrong');

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('❌');
      expect(output).toContain('Something went wrong');
    });
  });

  describe('displaySuccess', () => {
    it('should display success message', () => {
      cli.displaySuccess('Operation completed');

      const output = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('✅');
      expect(output).toContain('Operation completed');
    });
  });
});

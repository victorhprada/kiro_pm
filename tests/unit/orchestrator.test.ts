/**
 * Unit tests for the Orchestrator module.
 * Tests the coordination logic between CLI, PMSkill, AzureDevOpsClient,
 * ConfigManager, and security sanitizer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Orchestrator } from '../../src/application/orchestrator';
import { CLI } from '../../src/presentation/cli';
import { PMSkillImpl } from '../../src/application/pm-skill';
import { ConfigManager } from '../../src/infrastructure/config-manager';
import { IAzureDevOpsClient } from '../../src/infrastructure/azure-devops-client';
import {
  ConnectionContext,
  TargetContext,
  WorkItemHierarchy,
  Project,
  Team,
  Sprint,
  WorkItemResult,
} from '../../src/domain/models';

// ─── Mock Factories ─────────────────────────────────────────────────────────

function createMockCli(): CLI {
  return {
    promptCredentials: vi.fn().mockResolvedValue({
      organizationUrl: 'https://dev.azure.com/test-org',
      pat: 'test-pat-token',
    }),
    selectProject: vi.fn().mockResolvedValue({ id: 'proj-1', name: 'TestProject' }),
    selectTeam: vi.fn().mockResolvedValue({ id: 'team-1', name: 'TestTeam', projectId: 'proj-1' }),
    selectSprint: vi.fn().mockResolvedValue({
      id: 'sprint-1',
      name: 'Sprint 1',
      path: 'TestProject\\Sprint 1',
      status: 'current',
    }),
    promptUserNeed: vi.fn().mockResolvedValue('I need a login feature'),
    displayQuestion: vi.fn(),
    promptAnswer: vi.fn().mockResolvedValue('Some answer'),
    displayHierarchy: vi.fn(),
    promptApproval: vi.fn().mockResolvedValue({ approved: true }),
    promptFeedback: vi.fn().mockResolvedValue('Fix the titles'),
    displayCreationResult: vi.fn(),
    displayError: vi.fn(),
    displaySuccess: vi.fn(),
  } as unknown as CLI;
}

function createMockAdoClient(): IAzureDevOpsClient {
  let callCount = 0;
  return {
    validateConnection: vi.fn().mockResolvedValue(true),
    listProjects: vi.fn().mockResolvedValue([
      { id: 'proj-1', name: 'TestProject', description: 'A test project' },
    ]),
    listTeams: vi.fn().mockResolvedValue([
      { id: 'team-1', name: 'TestTeam', projectId: 'proj-1' },
    ]),
    listSprints: vi.fn().mockResolvedValue([
      { id: 'sprint-1', name: 'Sprint 1', path: 'TestProject\\Sprint 1', status: 'current' },
    ]),
    createWorkItem: vi.fn().mockImplementation(async (params) => {
      callCount++;
      return {
        id: callCount,
        url: `https://dev.azure.com/test-org/TestProject/_workitems/edit/${callCount}`,
        type: params.workItemType,
        title: params.title,
      };
    }),
  };
}

function createMockConfigManager(shouldFail = false): ConfigManager {
  const mock = {
    loadConfig: shouldFail
      ? vi.fn().mockRejectedValue(new Error('No .env file'))
      : vi.fn().mockResolvedValue({
          organizationUrl: 'https://dev.azure.com/test-org',
          pat: 'test-pat-token',
        }),
    validateConfig: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  } as unknown as ConfigManager;
  return mock;
}

function createSampleHierarchy(): WorkItemHierarchy {
  return {
    epic: {
      title: 'Login Feature Epic',
      description: '<p>Epic description</p>',
      areaPath: '',
    },
    feature: {
      title: 'User Authentication Feature',
      description: '<p>Feature description</p>',
      areaPath: '',
    },
    userStories: [
      {
        title: 'User can login with email',
        description: '<p>Story description</p>',
        acceptanceCriteria: '<ul><li>Criteria 1</li></ul>',
        areaPath: '',
      },
    ],
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Orchestrator', () => {
  describe('setupConnection', () => {
    it('loads config from .env when available', async () => {
      const cli = createMockCli();
      const configManager = createMockConfigManager(false);
      const adoClient = createMockAdoClient();

      const orchestrator = new Orchestrator(cli, undefined, configManager, adoClient);
      const result = await orchestrator.setupConnection();

      expect(configManager.loadConfig).toHaveBeenCalled();
      expect((cli.promptCredentials as any)).not.toHaveBeenCalled();
      expect(result.isConnected).toBe(true);
      expect(result.projects).toHaveLength(1);
    });

    it('falls back to CLI credentials when .env fails', async () => {
      const cli = createMockCli();
      const configManager = createMockConfigManager(true);
      const adoClient = createMockAdoClient();

      const orchestrator = new Orchestrator(cli, undefined, configManager, adoClient);
      const result = await orchestrator.setupConnection();

      expect(configManager.loadConfig).toHaveBeenCalled();
      expect(cli.promptCredentials).toHaveBeenCalled();
      expect(result.isConnected).toBe(true);
    });

    it('throws error when connection validation fails', async () => {
      const cli = createMockCli();
      const configManager = createMockConfigManager(false);
      const adoClient = createMockAdoClient();
      (adoClient.validateConnection as any).mockRejectedValue(
        new Error('Connection failed')
      );

      const orchestrator = new Orchestrator(cli, undefined, configManager, adoClient);

      await expect(orchestrator.setupConnection()).rejects.toThrow('Connection failed');
    });
  });

  describe('selectTarget', () => {
    it('selects project, team, and sprint and builds target context', async () => {
      const cli = createMockCli();
      const adoClient = createMockAdoClient();

      const orchestrator = new Orchestrator(cli, undefined, undefined, adoClient);
      // Need to setup connection first to initialize adoClient
      (orchestrator as any).adoClient = adoClient;

      const context: ConnectionContext = {
        organizationUrl: 'https://dev.azure.com/test-org',
        isConnected: true,
        projects: [{ id: 'proj-1', name: 'TestProject' }],
      };

      const result = await orchestrator.selectTarget(context);

      expect(cli.selectProject).toHaveBeenCalledWith(context.projects);
      expect(adoClient.listTeams).toHaveBeenCalledWith('proj-1');
      expect(cli.selectTeam).toHaveBeenCalled();
      expect(adoClient.listSprints).toHaveBeenCalledWith('proj-1', 'team-1');
      expect(cli.selectSprint).toHaveBeenCalled();
      expect(result.areaPath).toBe('TestProject\\TestTeam');
      expect(result.iterationPath).toBe('TestProject\\Sprint 1');
    });
  });

  describe('conductRefinement', () => {
    it('conducts Q&A loop and generates hierarchy', async () => {
      const cli = createMockCli();
      const pmSkill = new PMSkillImpl();

      // Mock promptAnswer to return answers for all questions
      let answerCount = 0;
      (cli.promptAnswer as any).mockImplementation(async () => {
        answerCount++;
        return `Answer ${answerCount}`;
      });

      const orchestrator = new Orchestrator(cli, pmSkill);
      const hierarchy = await orchestrator.conductRefinement('I need a login feature');

      expect(cli.displayQuestion).toHaveBeenCalled();
      expect(cli.promptAnswer).toHaveBeenCalled();
      expect(hierarchy).toBeDefined();
      expect(hierarchy.epic).toBeDefined();
      expect(hierarchy.feature).toBeDefined();
      expect(hierarchy.userStories.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('reviewAndApprove', () => {
    it('displays hierarchy and returns approval result', async () => {
      const cli = createMockCli();
      (cli.promptApproval as any).mockResolvedValue({ approved: true });

      const orchestrator = new Orchestrator(cli);
      const hierarchy = createSampleHierarchy();

      const result = await orchestrator.reviewAndApprove(hierarchy);

      expect(cli.displayHierarchy).toHaveBeenCalledWith(hierarchy);
      expect(cli.promptApproval).toHaveBeenCalled();
      expect(result.approved).toBe(true);
    });
  });

  describe('createWorkItems', () => {
    it('creates Epic, Feature, and User Stories with correct parent links', async () => {
      const cli = createMockCli();
      const adoClient = createMockAdoClient();

      const orchestrator = new Orchestrator(cli, undefined, undefined, adoClient);
      (orchestrator as any).adoClient = adoClient;

      const hierarchy = createSampleHierarchy();
      const target: TargetContext = {
        project: { id: 'proj-1', name: 'TestProject' },
        team: { id: 'team-1', name: 'TestTeam', projectId: 'proj-1' },
        sprint: { id: 'sprint-1', name: 'Sprint 1', path: 'TestProject\\Sprint 1', status: 'current' },
        areaPath: 'TestProject\\TestTeam',
        iterationPath: 'TestProject\\Sprint 1',
      };

      const result = await orchestrator.createWorkItems(hierarchy, target);

      expect(result.success).toBe(true);
      expect(result.workItems).toHaveLength(3);
      expect(result.errors).toHaveLength(0);

      // Verify Epic was created first (no parent)
      const epicCall = (adoClient.createWorkItem as any).mock.calls[0][0];
      expect(epicCall.workItemType).toBe('Epic');
      expect(epicCall.parentId).toBeUndefined();

      // Verify Feature was created with Epic as parent
      const featureCall = (adoClient.createWorkItem as any).mock.calls[1][0];
      expect(featureCall.workItemType).toBe('Feature');
      expect(featureCall.parentId).toBe(1); // Epic ID

      // Verify User Story was created with Feature as parent
      const storyCall = (adoClient.createWorkItem as any).mock.calls[2][0];
      expect(storyCall.workItemType).toBe('User Story');
      expect(storyCall.parentId).toBe(2); // Feature ID
    });

    it('handles partial failure when Epic creation fails', async () => {
      const cli = createMockCli();
      const adoClient = createMockAdoClient();
      (adoClient.createWorkItem as any).mockRejectedValue(new Error('API Error'));

      const orchestrator = new Orchestrator(cli, undefined, undefined, adoClient);
      (orchestrator as any).adoClient = adoClient;

      const hierarchy = createSampleHierarchy();
      const target: TargetContext = {
        project: { id: 'proj-1', name: 'TestProject' },
        team: { id: 'team-1', name: 'TestTeam', projectId: 'proj-1' },
        sprint: { id: 'sprint-1', name: 'Sprint 1', path: 'TestProject\\Sprint 1', status: 'current' },
        areaPath: 'TestProject\\TestTeam',
        iterationPath: 'TestProject\\Sprint 1',
      };

      const result = await orchestrator.createWorkItems(hierarchy, target);

      expect(result.success).toBe(false);
      expect(result.workItems).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].workItemType).toBe('Epic');
    });

    it('handles partial failure when User Story creation fails', async () => {
      const cli = createMockCli();
      let callCount = 0;
      const adoClient: IAzureDevOpsClient = {
        validateConnection: vi.fn().mockResolvedValue(true),
        listProjects: vi.fn().mockResolvedValue([]),
        listTeams: vi.fn().mockResolvedValue([]),
        listSprints: vi.fn().mockResolvedValue([]),
        createWorkItem: vi.fn().mockImplementation(async (params) => {
          callCount++;
          if (callCount === 3) {
            throw new Error('Story creation failed');
          }
          return {
            id: callCount,
            url: `https://dev.azure.com/test-org/_workitems/edit/${callCount}`,
            type: params.workItemType,
            title: params.title,
          };
        }),
      };

      const orchestrator = new Orchestrator(cli, undefined, undefined, adoClient);
      (orchestrator as any).adoClient = adoClient;

      const hierarchy: WorkItemHierarchy = {
        ...createSampleHierarchy(),
        userStories: [
          {
            title: 'Story 1',
            description: '<p>desc</p>',
            acceptanceCriteria: '<ul><li>AC</li></ul>',
            areaPath: '',
          },
          {
            title: 'Story 2',
            description: '<p>desc</p>',
            acceptanceCriteria: '<ul><li>AC</li></ul>',
            areaPath: '',
          },
        ],
      };

      const target: TargetContext = {
        project: { id: 'proj-1', name: 'TestProject' },
        team: { id: 'team-1', name: 'TestTeam', projectId: 'proj-1' },
        sprint: { id: 'sprint-1', name: 'Sprint 1', path: 'TestProject\\Sprint 1', status: 'current' },
        areaPath: 'TestProject\\TestTeam',
        iterationPath: 'TestProject\\Sprint 1',
      };

      const result = await orchestrator.createWorkItems(hierarchy, target);

      // Epic and Feature created, first story fails, second story succeeds
      expect(result.success).toBe(false);
      expect(result.workItems).toHaveLength(3); // Epic + Feature + Story 2
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].title).toBe('Story 1');
    });

    it('sanitizes PAT from error messages', async () => {
      const cli = createMockCli();
      const adoClient = createMockAdoClient();
      (adoClient.createWorkItem as any).mockRejectedValue(
        new Error('Failed with token test-pat-token exposed')
      );

      const configManager = createMockConfigManager(false);
      const orchestrator = new Orchestrator(cli, undefined, configManager, adoClient);

      // Setup connection to initialize sanitizer
      await orchestrator.setupConnection();

      const hierarchy = createSampleHierarchy();
      const target: TargetContext = {
        project: { id: 'proj-1', name: 'TestProject' },
        team: { id: 'team-1', name: 'TestTeam', projectId: 'proj-1' },
        sprint: { id: 'sprint-1', name: 'Sprint 1', path: 'TestProject\\Sprint 1', status: 'current' },
        areaPath: 'TestProject\\TestTeam',
        iterationPath: 'TestProject\\Sprint 1',
      };

      const result = await orchestrator.createWorkItems(hierarchy, target);

      expect(result.success).toBe(false);
      expect(result.errors[0].error).not.toContain('test-pat-token');
      expect(result.errors[0].error).toContain('[REDACTED]');
    });
  });

  describe('run (full flow)', () => {
    it('executes the full flow successfully', async () => {
      const cli = createMockCli();
      const configManager = createMockConfigManager(false);
      const adoClient = createMockAdoClient();
      const pmSkill = new PMSkillImpl();

      // Mock promptAnswer to return answers for all questions
      let answerCount = 0;
      (cli.promptAnswer as any).mockImplementation(async () => {
        answerCount++;
        return `Answer ${answerCount}`;
      });

      const orchestrator = new Orchestrator(cli, pmSkill, configManager, adoClient);
      await orchestrator.run();

      expect(cli.displaySuccess).toHaveBeenCalled();
      expect(cli.displayCreationResult).toHaveBeenCalled();
      expect(cli.displayError).not.toHaveBeenCalled();
    });

    it('handles errors gracefully and displays error message', async () => {
      const cli = createMockCli();
      const configManager = createMockConfigManager(true);
      // CLI promptCredentials will work, but validateConnection will fail
      const adoClient = createMockAdoClient();
      (adoClient.validateConnection as any).mockRejectedValue(
        new Error('Network error')
      );

      const orchestrator = new Orchestrator(cli, undefined, configManager, adoClient);
      await orchestrator.run();

      expect(cli.displayError).toHaveBeenCalled();
    });
  });
});

/**
 * Unit tests for AzureDevOpsClient
 * Tests connection validation, error handling, retry logic, and data mapping.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AzureDevOpsClient } from '../../src/infrastructure/azure-devops-client';
import { AzureDevOpsAuthError, WorkItemCreationError } from '../../src/domain/errors';

// Mock the azure-devops-node-api module
vi.mock('azure-devops-node-api', () => {
  const mockConnect = vi.fn();
  const mockGetCoreApi = vi.fn();
  const mockGetWorkApi = vi.fn();
  const mockGetWorkItemTrackingApi = vi.fn();

  return {
    getPersonalAccessTokenHandler: vi.fn(() => ({})),
    WebApi: vi.fn().mockImplementation(() => ({
      connect: mockConnect,
      getCoreApi: mockGetCoreApi,
      getWorkApi: mockGetWorkApi,
      getWorkItemTrackingApi: mockGetWorkItemTrackingApi,
    })),
    __mockConnect: mockConnect,
    __mockGetCoreApi: mockGetCoreApi,
    __mockGetWorkApi: mockGetWorkApi,
    __mockGetWorkItemTrackingApi: mockGetWorkItemTrackingApi,
  };
});

// Access mocks
import * as azdev from 'azure-devops-node-api';
const mockConnect = (azdev as any).__mockConnect;
const mockGetCoreApi = (azdev as any).__mockGetCoreApi;
const mockGetWorkApi = (azdev as any).__mockGetWorkApi;
const mockGetWorkItemTrackingApi = (azdev as any).__mockGetWorkItemTrackingApi;

describe('AzureDevOpsClient', () => {
  let client: AzureDevOpsClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AzureDevOpsClient('https://dev.azure.com/test-org', 'test-pat');
  });

  describe('validateConnection', () => {
    it('should return true when connection is successful', async () => {
      mockConnect.mockResolvedValue({
        authenticatedUser: { id: 'user-123', providerDisplayName: 'Test User' },
      });

      const result = await client.validateConnection();
      expect(result).toBe(true);
    });

    it('should throw AzureDevOpsAuthError when authenticatedUser is null', async () => {
      mockConnect.mockResolvedValue({ authenticatedUser: null });

      await expect(client.validateConnection()).rejects.toThrow(AzureDevOpsAuthError);
    });

    it('should throw AzureDevOpsAuthError when connection returns null', async () => {
      mockConnect.mockResolvedValue(null);

      await expect(client.validateConnection()).rejects.toThrow(AzureDevOpsAuthError);
    });

    it('should throw AzureDevOpsAuthError for 401 status code', async () => {
      const error = new Error('Unauthorized') as any;
      error.statusCode = 401;
      mockConnect.mockRejectedValue(error);

      await expect(client.validateConnection()).rejects.toThrow(AzureDevOpsAuthError);
      await expect(client.validateConnection()).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('should throw AzureDevOpsAuthError for 403 status code', async () => {
      const error = new Error('Forbidden') as any;
      error.statusCode = 403;
      mockConnect.mockRejectedValue(error);

      await expect(client.validateConnection()).rejects.toThrow(AzureDevOpsAuthError);
      await expect(client.validateConnection()).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should throw descriptive error for 404 (organization not found)', async () => {
      const error = new Error('Not Found') as any;
      error.statusCode = 404;
      mockConnect.mockRejectedValue(error);

      await expect(client.validateConnection()).rejects.toThrow(
        /Organização não encontrada/
      );
    });

    it('should include organization URL in 404 error message', async () => {
      const error = new Error('Not Found') as any;
      error.statusCode = 404;
      mockConnect.mockRejectedValue(error);

      await expect(client.validateConnection()).rejects.toThrow(
        /https:\/\/dev\.azure\.com\/test-org/
      );
    });
  });

  describe('listProjects', () => {
    it('should return mapped projects', async () => {
      const mockCoreApi = {
        getProjects: vi.fn().mockResolvedValue([
          { id: 'proj-1', name: 'Project One', description: 'First project' },
          { id: 'proj-2', name: 'Project Two', description: undefined },
        ]),
      };
      mockGetCoreApi.mockResolvedValue(mockCoreApi);

      const projects = await client.listProjects();

      expect(projects).toHaveLength(2);
      expect(projects[0]).toEqual({
        id: 'proj-1',
        name: 'Project One',
        description: 'First project',
      });
      expect(projects[1]).toEqual({
        id: 'proj-2',
        name: 'Project Two',
        description: undefined,
      });
    });

    it('should return empty array when no projects exist', async () => {
      const mockCoreApi = {
        getProjects: vi.fn().mockResolvedValue([]),
      };
      mockGetCoreApi.mockResolvedValue(mockCoreApi);

      const projects = await client.listProjects();
      expect(projects).toEqual([]);
    });

    it('should handle null response gracefully', async () => {
      const mockCoreApi = {
        getProjects: vi.fn().mockResolvedValue(null),
      };
      mockGetCoreApi.mockResolvedValue(mockCoreApi);

      const projects = await client.listProjects();
      expect(projects).toEqual([]);
    });

    it('should throw AzureDevOpsAuthError for 401 on listProjects', async () => {
      const error = new Error('Unauthorized') as any;
      error.statusCode = 401;
      mockGetCoreApi.mockRejectedValue(error);

      await expect(client.listProjects()).rejects.toThrow(AzureDevOpsAuthError);
    });
  });

  describe('listTeams', () => {
    it('should return mapped teams for a project', async () => {
      const mockCoreApi = {
        getTeams: vi.fn().mockResolvedValue([
          { id: 'team-1', name: 'Team Alpha' },
          { id: 'team-2', name: 'Team Beta' },
        ]),
      };
      mockGetCoreApi.mockResolvedValue(mockCoreApi);

      const teams = await client.listTeams('proj-1');

      expect(teams).toHaveLength(2);
      expect(teams[0]).toEqual({
        id: 'team-1',
        name: 'Team Alpha',
        projectId: 'proj-1',
      });
      expect(teams[1]).toEqual({
        id: 'team-2',
        name: 'Team Beta',
        projectId: 'proj-1',
      });
    });

    it('should return empty array when no teams exist', async () => {
      const mockCoreApi = {
        getTeams: vi.fn().mockResolvedValue([]),
      };
      mockGetCoreApi.mockResolvedValue(mockCoreApi);

      const teams = await client.listTeams('proj-1');
      expect(teams).toEqual([]);
    });

    it('should pass projectId to the SDK', async () => {
      const mockCoreApi = {
        getTeams: vi.fn().mockResolvedValue([]),
      };
      mockGetCoreApi.mockResolvedValue(mockCoreApi);

      await client.listTeams('my-project');
      expect(mockCoreApi.getTeams).toHaveBeenCalledWith('my-project');
    });
  });

  describe('listSprints', () => {
    it('should return mapped sprints with correct status', async () => {
      const mockWorkApi = {
        getTeamIterations: vi.fn().mockResolvedValue([
          {
            id: 'sprint-1',
            name: 'Sprint 1',
            path: 'Project\\Sprint 1',
            attributes: {
              startDate: new Date('2024-01-01'),
              finishDate: new Date('2024-01-14'),
              timeFrame: 0, // Past
            },
          },
          {
            id: 'sprint-2',
            name: 'Sprint 2',
            path: 'Project\\Sprint 2',
            attributes: {
              startDate: new Date('2024-01-15'),
              finishDate: new Date('2024-01-28'),
              timeFrame: 1, // Current
            },
          },
          {
            id: 'sprint-3',
            name: 'Sprint 3',
            path: 'Project\\Sprint 3',
            attributes: {
              startDate: new Date('2024-01-29'),
              finishDate: new Date('2024-02-11'),
              timeFrame: 2, // Future
            },
          },
        ]),
      };
      mockGetWorkApi.mockResolvedValue(mockWorkApi);

      const sprints = await client.listSprints('proj-1', 'team-1');

      expect(sprints).toHaveLength(3);
      expect(sprints[0].status).toBe('past');
      expect(sprints[1].status).toBe('current');
      expect(sprints[2].status).toBe('future');
      expect(sprints[0].name).toBe('Sprint 1');
      expect(sprints[0].path).toBe('Project\\Sprint 1');
    });

    it('should handle sprints without attributes', async () => {
      const mockWorkApi = {
        getTeamIterations: vi.fn().mockResolvedValue([
          {
            id: 'sprint-1',
            name: 'Sprint 1',
            path: 'Project\\Sprint 1',
            attributes: undefined,
          },
        ]),
      };
      mockGetWorkApi.mockResolvedValue(mockWorkApi);

      const sprints = await client.listSprints('proj-1', 'team-1');

      expect(sprints[0].startDate).toBeUndefined();
      expect(sprints[0].endDate).toBeUndefined();
      expect(sprints[0].status).toBe('future'); // default
    });

    it('should pass correct team context to SDK', async () => {
      const mockWorkApi = {
        getTeamIterations: vi.fn().mockResolvedValue([]),
      };
      mockGetWorkApi.mockResolvedValue(mockWorkApi);

      await client.listSprints('proj-1', 'team-1');

      expect(mockWorkApi.getTeamIterations).toHaveBeenCalledWith({
        projectId: 'proj-1',
        teamId: 'team-1',
      });
    });
  });

  describe('retry logic', () => {
    it('should retry on transient network errors (ECONNRESET)', async () => {
      const networkError = new Error('Connection reset') as any;
      networkError.code = 'ECONNRESET';

      mockConnect
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          authenticatedUser: { id: 'user-1' },
        });

      const result = await client.validateConnection();
      expect(result).toBe(true);
      expect(mockConnect).toHaveBeenCalledTimes(3);
    });

    it('should retry on 500 server errors', async () => {
      const serverError = new Error('Internal Server Error') as any;
      serverError.statusCode = 500;

      mockConnect
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce({
          authenticatedUser: { id: 'user-1' },
        });

      const result = await client.validateConnection();
      expect(result).toBe(true);
      expect(mockConnect).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on 401 auth errors', async () => {
      const authError = new Error('Unauthorized') as any;
      authError.statusCode = 401;

      mockConnect.mockRejectedValue(authError);

      await expect(client.validateConnection()).rejects.toThrow(AzureDevOpsAuthError);
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry on 404 errors', async () => {
      const notFoundError = new Error('Not Found') as any;
      notFoundError.statusCode = 404;

      mockConnect.mockRejectedValue(notFoundError);

      await expect(client.validateConnection()).rejects.toThrow(/Organização não encontrada/);
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries exhausted', async () => {
      const networkError = new Error('Connection timeout') as any;
      networkError.code = 'ETIMEDOUT';

      mockConnect.mockRejectedValue(networkError);

      await expect(client.validateConnection()).rejects.toThrow();
      expect(mockConnect).toHaveBeenCalledTimes(3);
    });

    it('should retry on ECONNREFUSED errors', async () => {
      const connRefused = new Error('Connection refused') as any;
      connRefused.code = 'ECONNREFUSED';

      mockConnect
        .mockRejectedValueOnce(connRefused)
        .mockResolvedValueOnce({
          authenticatedUser: { id: 'user-1' },
        });

      const result = await client.validateConnection();
      expect(result).toBe(true);
    });
  });

  describe('error messages', () => {
    it('should provide descriptive message for invalid PAT (401)', async () => {
      const error = new Error('Unauthorized') as any;
      error.statusCode = 401;
      mockConnect.mockRejectedValue(error);

      try {
        await client.validateConnection();
      } catch (e: any) {
        expect(e.message).toContain('Personal Access Token');
        expect(e.message).toContain('inválido ou expirou');
      }
    });

    it('should provide descriptive message for organization not found (404)', async () => {
      const error = new Error('Not Found') as any;
      error.statusCode = 404;
      mockConnect.mockRejectedValue(error);

      try {
        await client.validateConnection();
      } catch (e: any) {
        expect(e.message).toContain('Organização não encontrada');
        expect(e.message).toContain('https://dev.azure.com/test-org');
      }
    });
  });

  describe('createWorkItem', () => {
    const baseParams = {
      projectName: 'MyProject',
      workItemType: 'Epic' as const,
      title: 'Test Epic',
      description: '<p>Epic description</p>',
      areaPath: 'MyProject\\Team A',
      iterationPath: 'MyProject\\Sprint 1',
    };

    it('should create a work item with required fields (Title, Description, AreaPath, IterationPath)', async () => {
      const mockCreateWorkItem = vi.fn().mockResolvedValue({
        id: 101,
        url: 'https://dev.azure.com/test-org/MyProject/_apis/wit/workItems/101',
        _links: { html: { href: 'https://dev.azure.com/test-org/MyProject/_workitems/edit/101' } },
      });
      mockGetWorkItemTrackingApi.mockResolvedValue({ createWorkItem: mockCreateWorkItem });

      const result = await client.createWorkItem(baseParams);

      expect(result).toEqual({
        id: 101,
        url: 'https://dev.azure.com/test-org/MyProject/_workitems/edit/101',
        type: 'Epic',
        title: 'Test Epic',
      });

      // Verify the patch document contains required fields
      const patchDoc = mockCreateWorkItem.mock.calls[0][1];
      expect(patchDoc).toContainEqual({ op: 'add', path: '/fields/System.Title', value: 'Test Epic' });
      expect(patchDoc).toContainEqual({ op: 'add', path: '/fields/System.Description', value: '<p>Epic description</p>' });
      expect(patchDoc).toContainEqual({ op: 'add', path: '/fields/System.AreaPath', value: 'MyProject\\Team A' });
      expect(patchDoc).toContainEqual({ op: 'add', path: '/fields/System.IterationPath', value: 'MyProject\\Sprint 1' });
    });

    it('should include AcceptanceCriteria for User Story type', async () => {
      const mockCreateWorkItem = vi.fn().mockResolvedValue({
        id: 201,
        url: 'https://dev.azure.com/test-org/MyProject/_apis/wit/workItems/201',
        _links: { html: { href: 'https://dev.azure.com/test-org/MyProject/_workitems/edit/201' } },
      });
      mockGetWorkItemTrackingApi.mockResolvedValue({ createWorkItem: mockCreateWorkItem });

      const params = {
        ...baseParams,
        workItemType: 'User Story' as const,
        title: 'Test User Story',
        acceptanceCriteria: '<ul><li>Criterion 1</li></ul>',
      };

      await client.createWorkItem(params);

      const patchDoc = mockCreateWorkItem.mock.calls[0][1];
      expect(patchDoc).toContainEqual({
        op: 'add',
        path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
        value: '<ul><li>Criterion 1</li></ul>',
      });
    });

    it('should NOT include AcceptanceCriteria for Epic type even if provided', async () => {
      const mockCreateWorkItem = vi.fn().mockResolvedValue({
        id: 102,
        url: 'https://dev.azure.com/test-org/MyProject/_apis/wit/workItems/102',
        _links: { html: { href: 'https://dev.azure.com/test-org/MyProject/_workitems/edit/102' } },
      });
      mockGetWorkItemTrackingApi.mockResolvedValue({ createWorkItem: mockCreateWorkItem });

      const params = {
        ...baseParams,
        acceptanceCriteria: '<ul><li>Should not appear</li></ul>',
      };

      await client.createWorkItem(params);

      const patchDoc = mockCreateWorkItem.mock.calls[0][1];
      const acField = patchDoc.find((op: any) => op.path === '/fields/Microsoft.VSTS.Common.AcceptanceCriteria');
      expect(acField).toBeUndefined();
    });

    it('should add parent link with System.LinkTypes.Hierarchy-Reverse when parentId is provided', async () => {
      const mockCreateWorkItem = vi.fn().mockResolvedValue({
        id: 301,
        url: 'https://dev.azure.com/test-org/MyProject/_apis/wit/workItems/301',
        _links: { html: { href: 'https://dev.azure.com/test-org/MyProject/_workitems/edit/301' } },
      });
      mockGetWorkItemTrackingApi.mockResolvedValue({ createWorkItem: mockCreateWorkItem });

      const params = {
        ...baseParams,
        workItemType: 'Feature' as const,
        title: 'Test Feature',
        parentId: 100,
      };

      await client.createWorkItem(params);

      const patchDoc = mockCreateWorkItem.mock.calls[0][1];
      const parentLink = patchDoc.find((op: any) => op.path === '/relations/-');
      expect(parentLink).toBeDefined();
      expect(parentLink.value.rel).toBe('System.LinkTypes.Hierarchy-Reverse');
      expect(parentLink.value.url).toBe('https://dev.azure.com/test-org/_apis/wit/workItems/100');
    });

    it('should NOT include parent link when parentId is not provided', async () => {
      const mockCreateWorkItem = vi.fn().mockResolvedValue({
        id: 103,
        url: 'https://dev.azure.com/test-org/MyProject/_apis/wit/workItems/103',
        _links: { html: { href: 'https://dev.azure.com/test-org/MyProject/_workitems/edit/103' } },
      });
      mockGetWorkItemTrackingApi.mockResolvedValue({ createWorkItem: mockCreateWorkItem });

      await client.createWorkItem(baseParams);

      const patchDoc = mockCreateWorkItem.mock.calls[0][1];
      const parentLink = patchDoc.find((op: any) => op.path === '/relations/-');
      expect(parentLink).toBeUndefined();
    });

    it('should throw WorkItemCreationError on API failure with createdItems preserved', async () => {
      const mockCreateWorkItem = vi.fn().mockRejectedValue(new Error('API Error: field validation failed'));
      mockGetWorkItemTrackingApi.mockResolvedValue({ createWorkItem: mockCreateWorkItem });

      const previouslyCreated = [
        { id: 100, url: 'https://dev.azure.com/test-org/_workitems/edit/100', type: 'Epic', title: 'My Epic' },
      ];

      const params = {
        ...baseParams,
        workItemType: 'Feature' as const,
        title: 'Failing Feature',
        parentId: 100,
        createdItems: previouslyCreated,
      };

      await expect(client.createWorkItem(params)).rejects.toThrow(WorkItemCreationError);

      try {
        await client.createWorkItem(params);
      } catch (e: any) {
        expect(e).toBeInstanceOf(WorkItemCreationError);
        expect(e.workItemType).toBe('Feature');
        expect(e.workItemTitle).toBe('Failing Feature');
        expect(e.createdItems).toEqual(previouslyCreated);
      }
    });

    it('should throw WorkItemCreationError with empty createdItems when no previous items exist', async () => {
      const mockCreateWorkItem = vi.fn().mockRejectedValue(new Error('Server error'));
      mockGetWorkItemTrackingApi.mockResolvedValue({ createWorkItem: mockCreateWorkItem });

      await expect(client.createWorkItem(baseParams)).rejects.toThrow(WorkItemCreationError);

      try {
        await client.createWorkItem(baseParams);
      } catch (e: any) {
        expect(e).toBeInstanceOf(WorkItemCreationError);
        expect(e.createdItems).toEqual([]);
      }
    });

    it('should throw WorkItemCreationError when API returns null response', async () => {
      const mockCreateWorkItem = vi.fn().mockResolvedValue(null);
      mockGetWorkItemTrackingApi.mockResolvedValue({ createWorkItem: mockCreateWorkItem });

      await expect(client.createWorkItem(baseParams)).rejects.toThrow(WorkItemCreationError);
    });

    it('should throw WorkItemCreationError when API returns work item without id', async () => {
      const mockCreateWorkItem = vi.fn().mockResolvedValue({ id: undefined });
      mockGetWorkItemTrackingApi.mockResolvedValue({ createWorkItem: mockCreateWorkItem });

      await expect(client.createWorkItem(baseParams)).rejects.toThrow(WorkItemCreationError);
    });

    it('should use work item url field as fallback when _links.html.href is not available', async () => {
      const mockCreateWorkItem = vi.fn().mockResolvedValue({
        id: 104,
        url: 'https://dev.azure.com/test-org/MyProject/_apis/wit/workItems/104',
        _links: {},
      });
      mockGetWorkItemTrackingApi.mockResolvedValue({ createWorkItem: mockCreateWorkItem });

      const result = await client.createWorkItem(baseParams);
      expect(result.url).toBe('https://dev.azure.com/test-org/MyProject/_apis/wit/workItems/104');
    });

    it('should pass correct project name and work item type to SDK', async () => {
      const mockCreateWorkItem = vi.fn().mockResolvedValue({
        id: 105,
        url: 'https://dev.azure.com/test-org/MyProject/_apis/wit/workItems/105',
        _links: { html: { href: 'https://dev.azure.com/test-org/MyProject/_workitems/edit/105' } },
      });
      mockGetWorkItemTrackingApi.mockResolvedValue({ createWorkItem: mockCreateWorkItem });

      await client.createWorkItem(baseParams);

      expect(mockCreateWorkItem).toHaveBeenCalledWith(
        null,
        expect.any(Array),
        'MyProject',
        'Epic'
      );
    });
  });

  describe('listWorkItemsByBoardColumn', () => {
    it('queries WIQL filtering by area path and board column and hydrates fields', async () => {
      const mockQueryByWiql = vi.fn().mockResolvedValue({
        workItems: [{ id: 11 }, { id: 12 }],
      });
      const mockGetWorkItems = vi.fn().mockResolvedValue([
        {
          id: 11,
          url: 'https://dev.azure.com/test-org/_apis/wit/workItems/11',
          _links: { html: { href: 'https://dev.azure.com/test-org/_workitems/edit/11' } },
          fields: {
            'System.Id': 11,
            'System.Title': 'Card A',
            'System.WorkItemType': 'User Story',
            'System.State': 'Active',
            'System.BoardColumn': 'Deploy',
            'System.AreaPath': 'Wiipo\\Holerite',
          },
        },
        {
          id: 12,
          url: 'https://dev.azure.com/test-org/_apis/wit/workItems/12',
          _links: { html: { href: 'https://dev.azure.com/test-org/_workitems/edit/12' } },
          fields: {
            'System.Id': 12,
            'System.Title': 'Card B',
            'System.WorkItemType': 'Feature',
            'System.State': 'Resolved',
            'System.BoardColumn': 'Deploy',
            'System.AreaPath': 'Wiipo\\Holerite',
          },
        },
      ]);
      mockGetWorkItemTrackingApi.mockResolvedValue({
        queryByWiql: mockQueryByWiql,
        getWorkItems: mockGetWorkItems,
      });

      const result = await client.listWorkItemsByBoardColumn({
        projectName: 'Wiipo',
        areaPath: 'Wiipo\\Holerite',
        boardColumn: 'Deploy',
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 11,
        title: 'Card A',
        workItemType: 'User Story',
        state: 'Active',
        boardColumn: 'Deploy',
        areaPath: 'Wiipo\\Holerite',
        url: 'https://dev.azure.com/test-org/_workitems/edit/11',
      });

      // WIQL gets the team context project
      const [wiql, teamContext] = mockQueryByWiql.mock.calls[0];
      expect(wiql.query).toContain("[System.AreaPath] UNDER 'Wiipo\\Holerite'");
      expect(wiql.query).toContain("[System.BoardColumn] = 'Deploy'");
      expect(wiql.query).toContain("[System.State] NOT IN");
      expect(teamContext).toEqual({ project: 'Wiipo' });

      // getWorkItems is called with the IDs and the project scope
      expect(mockGetWorkItems).toHaveBeenCalledWith(
        [11, 12],
        expect.arrayContaining(['System.Title', 'System.BoardColumn']),
        undefined,
        undefined,
        undefined,
        'Wiipo'
      );
    });

    it('returns empty array and skips getWorkItems when WIQL returns no IDs', async () => {
      const mockQueryByWiql = vi.fn().mockResolvedValue({ workItems: [] });
      const mockGetWorkItems = vi.fn();
      mockGetWorkItemTrackingApi.mockResolvedValue({
        queryByWiql: mockQueryByWiql,
        getWorkItems: mockGetWorkItems,
      });

      const result = await client.listWorkItemsByBoardColumn({
        projectName: 'Wiipo',
        areaPath: 'Wiipo\\Holerite',
        boardColumn: 'Deploy',
      });

      expect(result).toEqual([]);
      expect(mockGetWorkItems).not.toHaveBeenCalled();
    });

    it('honours custom excludeStates list in the WIQL', async () => {
      const mockQueryByWiql = vi.fn().mockResolvedValue({ workItems: [] });
      mockGetWorkItemTrackingApi.mockResolvedValue({
        queryByWiql: mockQueryByWiql,
        getWorkItems: vi.fn(),
      });

      await client.listWorkItemsByBoardColumn({
        projectName: 'Wiipo',
        areaPath: 'Wiipo\\Holerite',
        boardColumn: 'Deploy',
        excludeStates: ['Cancelled'],
      });

      const [wiql] = mockQueryByWiql.mock.calls[0];
      expect(wiql.query).toContain("[System.State] NOT IN ('Cancelled')");
    });

    it('omits the state filter when excludeStates is an empty array', async () => {
      const mockQueryByWiql = vi.fn().mockResolvedValue({ workItems: [] });
      mockGetWorkItemTrackingApi.mockResolvedValue({
        queryByWiql: mockQueryByWiql,
        getWorkItems: vi.fn(),
      });

      await client.listWorkItemsByBoardColumn({
        projectName: 'Wiipo',
        areaPath: 'Wiipo\\Holerite',
        boardColumn: 'Deploy',
        excludeStates: [],
      });

      const [wiql] = mockQueryByWiql.mock.calls[0];
      expect(wiql.query).not.toContain('[System.State]');
    });

    it("escapes single quotes in area path and board column to avoid WIQL injection", async () => {
      const mockQueryByWiql = vi.fn().mockResolvedValue({ workItems: [] });
      mockGetWorkItemTrackingApi.mockResolvedValue({
        queryByWiql: mockQueryByWiql,
        getWorkItems: vi.fn(),
      });

      await client.listWorkItemsByBoardColumn({
        projectName: 'Wiipo',
        areaPath: "Wiipo\\O'Brien",
        boardColumn: "Pronto p'ra Deploy",
      });

      const [wiql] = mockQueryByWiql.mock.calls[0];
      expect(wiql.query).toContain("[System.AreaPath] UNDER 'Wiipo\\O''Brien'");
      expect(wiql.query).toContain("[System.BoardColumn] = 'Pronto p''ra Deploy'");
    });
  });

  describe('getWorkItemComments', () => {
    it('returns mapped comments with text, renderedText, author and date', async () => {
      const mockGetComments = vi.fn().mockResolvedValue({
        comments: [
          {
            id: 1,
            workItemId: 100,
            text: 'PR https://github.com/wiipobr/wiipo-platform/pull/1',
            renderedText:
              '<a href="https://github.com/wiipobr/wiipo-platform/pull/1">PR</a>',
            createdBy: { displayName: 'Alice', uniqueName: 'alice@wiipo' },
            createdDate: '2026-05-19T12:00:00Z',
          },
          {
            id: 2,
            workItemId: 100,
            text: 'Pronto pra subir',
            renderedText: '<p>Pronto pra subir</p>',
            createdBy: { displayName: 'Bob' },
            createdDate: '2026-05-19T13:00:00Z',
          },
        ],
        continuationToken: undefined,
      });
      mockGetWorkItemTrackingApi.mockResolvedValue({
        getComments: mockGetComments,
      });

      const result = await client.getWorkItemComments('Wiipo', 100);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        workItemId: 100,
        text: 'PR https://github.com/wiipobr/wiipo-platform/pull/1',
        renderedText:
          '<a href="https://github.com/wiipobr/wiipo-platform/pull/1">PR</a>',
        createdBy: 'Alice',
        createdDate: new Date('2026-05-19T12:00:00Z'),
      });
      expect(result[1].createdBy).toBe('Bob');
    });

    it('paginates via continuationToken until exhausted', async () => {
      const mockGetComments = vi
        .fn()
        .mockResolvedValueOnce({
          comments: [{ id: 1, workItemId: 7, text: 'A' }],
          continuationToken: 'page-2',
        })
        .mockResolvedValueOnce({
          comments: [{ id: 2, workItemId: 7, text: 'B' }],
          continuationToken: undefined,
        });
      mockGetWorkItemTrackingApi.mockResolvedValue({
        getComments: mockGetComments,
      });

      const result = await client.getWorkItemComments('Wiipo', 7);
      expect(result.map((c) => c.text)).toEqual(['A', 'B']);
      expect(mockGetComments).toHaveBeenCalledTimes(2);

      const secondCallArgs = mockGetComments.mock.calls[1];
      expect(secondCallArgs[3]).toBe('page-2'); // continuationToken position
    });

    it('returns empty array when the API returns no comments', async () => {
      const mockGetComments = vi.fn().mockResolvedValue({ comments: [] });
      mockGetWorkItemTrackingApi.mockResolvedValue({
        getComments: mockGetComments,
      });

      const result = await client.getWorkItemComments('Wiipo', 7);
      expect(result).toEqual([]);
    });
  });
});

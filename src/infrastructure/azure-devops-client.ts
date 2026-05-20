/**
 * AzureDevOpsClient - Encapsulates all interactions with the Azure DevOps API.
 * Uses azure-devops-node-api SDK for connection and data retrieval.
 * Implements retry with exponential backoff for transient network failures.
 */

import * as azdev from 'azure-devops-node-api';
import { ICoreApi } from 'azure-devops-node-api/CoreApi';
import { IWorkApi } from 'azure-devops-node-api/WorkApi';
import { IWorkItemTrackingApi } from 'azure-devops-node-api/WorkItemTrackingApi';
import { TimeFrame } from 'azure-devops-node-api/interfaces/WorkInterfaces';
import { TeamContext } from 'azure-devops-node-api/interfaces/CoreInterfaces';

import { Project, Team, Sprint, WorkItemResult } from '../domain/models';
import { AzureDevOpsAuthError, WorkItemCreationError } from '../domain/errors';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface CreateWorkItemParams {
  projectName: string;
  workItemType: 'Epic' | 'Feature' | 'User Story';
  title: string;
  description: string;
  areaPath: string;
  iterationPath: string;
  acceptanceCriteria?: string;
  parentId?: number;
  /** Previously created items in this hierarchy batch — used for partial failure reporting */
  createdItems?: WorkItemResult[];
}

/**
 * Filtros para localizar cards em uma coluna específica do board de um time.
 *
 * Observação: `System.BoardColumn` é o nome da raia/coluna no board do time
 * — pode variar entre times (ex.: "Deploy", "Em Deploy", "Pronto para Deploy").
 */
export interface ListByBoardColumnParams {
  /** Nome do projeto (ex.: "Wiipo"). */
  projectName: string;
  /** AreaPath sob o qual filtrar (ex.: "Wiipo\\Holerite"). */
  areaPath: string;
  /** Nome exato da coluna do board (ex.: "Deploy"). */
  boardColumn: string;
  /**
   * Lista opcional de estados a excluir. Por padrão, exclui "Closed" e "Removed"
   * para evitar trazer cards já encerrados.
   */
  excludeStates?: string[];
}

/** Resumo de um card retornado por uma busca em coluna do board. */
export interface BoardWorkItem {
  id: number;
  title: string;
  workItemType: string;
  state: string;
  boardColumn: string;
  areaPath: string;
  url: string;
}

/** Comentário de um work item, com texto plano e HTML renderizado quando disponível. */
export interface WorkItemComment {
  id: number;
  workItemId: number;
  text: string;
  renderedText?: string;
  createdBy?: string;
  createdDate?: Date;
}

export interface IAzureDevOpsClient {
  validateConnection(): Promise<boolean>;
  listProjects(): Promise<Project[]>;
  listTeams(projectId: string): Promise<Team[]>;
  listSprints(projectId: string, teamId: string): Promise<Sprint[]>;
  createWorkItem(params: CreateWorkItemParams): Promise<WorkItemResult>;
  listWorkItemsByBoardColumn(
    params: ListByBoardColumnParams
  ): Promise<BoardWorkItem[]>;
  getWorkItemComments(
    projectName: string,
    workItemId: number
  ): Promise<WorkItemComment[]>;
}

// ─── Retry Configuration ────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

// ─── Payload Builder (exported for testability) ─────────────────────────────

export interface JsonPatchOperation {
  op: 'add' | 'replace' | 'remove';
  path: string;
  value: any;
}

/**
 * Builds the JSON Patch document for creating a work item.
 * Extracted for testability — this is the pure payload construction logic.
 */
export function buildWorkItemPayload(
  params: CreateWorkItemParams,
  organizationUrl: string
): JsonPatchOperation[] {
  const patchDocument: JsonPatchOperation[] = [
    {
      op: 'add',
      path: '/fields/System.Title',
      value: params.title,
    },
    {
      op: 'add',
      path: '/fields/System.Description',
      value: params.description,
    },
    {
      op: 'add',
      path: '/fields/System.AreaPath',
      value: params.areaPath,
    },
    {
      op: 'add',
      path: '/fields/System.IterationPath',
      value: params.iterationPath,
    },
  ];

  // Add AcceptanceCriteria for User Stories
  if (params.acceptanceCriteria && params.workItemType === 'User Story') {
    patchDocument.push({
      op: 'add',
      path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
      value: params.acceptanceCriteria,
    });
  }

  // Add parent link relation when parentId is provided
  if (params.parentId) {
    patchDocument.push({
      op: 'add',
      path: '/relations/-',
      value: {
        rel: 'System.LinkTypes.Hierarchy-Reverse',
        url: `${organizationUrl}/_apis/wit/workItems/${params.parentId}`,
      },
    });
  }

  return patchDocument;
}

// ─── Implementation ─────────────────────────────────────────────────────────

export class AzureDevOpsClient implements IAzureDevOpsClient {
  private connection: azdev.WebApi;
  private organizationUrl: string;

  constructor(organizationUrl: string, pat: string) {
    this.organizationUrl = organizationUrl;
    const authHandler = azdev.getPersonalAccessTokenHandler(pat);
    this.connection = new azdev.WebApi(organizationUrl, authHandler);
  }

  /**
   * Validates the connection to Azure DevOps by attempting to connect.
   * @returns true if connection is successful
   * @throws AzureDevOpsAuthError for authentication failures (401/403)
   * @throws Error for organization not found (404) or other failures
   */
  async validateConnection(): Promise<boolean> {
    return this.withRetry(async () => {
      const connectionData = await this.connection.connect();
      if (!connectionData || !connectionData.authenticatedUser) {
        throw new AzureDevOpsAuthError(
          'Falha na autenticação: não foi possível verificar o usuário autenticado.',
          401
        );
      }
      return true;
    });
  }

  /**
   * Lists all projects accessible to the authenticated user.
   * @returns Array of Project objects
   */
  async listProjects(): Promise<Project[]> {
    return this.withRetry(async () => {
      const coreApi: ICoreApi = await this.connection.getCoreApi();
      const projects = await coreApi.getProjects();

      return (projects || []).map((p) => ({
        id: p.id || '',
        name: p.name || '',
        description: p.description || undefined,
      }));
    });
  }

  /**
   * Lists all teams for a given project.
   * @param projectId - The project ID or name
   * @returns Array of Team objects
   */
  async listTeams(projectId: string): Promise<Team[]> {
    return this.withRetry(async () => {
      const coreApi: ICoreApi = await this.connection.getCoreApi();
      const teams = await coreApi.getTeams(projectId);

      return (teams || []).map((t) => ({
        id: t.id || '',
        name: t.name || '',
        projectId: projectId,
      }));
    });
  }

  /**
   * Lists all sprints (iterations) for a given project and team.
   * @param projectId - The project ID or name
   * @param teamId - The team ID or name
   * @returns Array of Sprint objects
   */
  async listSprints(projectId: string, teamId: string): Promise<Sprint[]> {
    return this.withRetry(async () => {
      const workApi: IWorkApi = await this.connection.getWorkApi();
      const teamContext: TeamContext = {
        projectId: projectId,
        teamId: teamId,
      };

      const iterations = await workApi.getTeamIterations(teamContext);

      return (iterations || []).map((iter) => ({
        id: iter.id || '',
        name: iter.name || '',
        path: iter.path || '',
        startDate: iter.attributes?.startDate
          ? new Date(iter.attributes.startDate)
          : undefined,
        endDate: iter.attributes?.finishDate
          ? new Date(iter.attributes.finishDate)
          : undefined,
        status: this.mapTimeFrame(iter.attributes?.timeFrame),
      }));
    });
  }

  /**
   * Creates a work item in Azure DevOps using JSON Patch format.
   * Builds payload with required fields per work item type:
   * - All types: Title, Description, AreaPath, IterationPath
   * - User Story: additionally includes AcceptanceCriteria
   * Adds parent link (System.LinkTypes.Hierarchy-Reverse) when parentId is provided.
   * On failure, throws WorkItemCreationError with the list of previously created items.
   */
  async createWorkItem(params: CreateWorkItemParams): Promise<WorkItemResult> {
    try {
      return await this.withRetry(async () => {
        const witApi: IWorkItemTrackingApi =
          await this.connection.getWorkItemTrackingApi();

        const patchDocument = buildWorkItemPayload(params, this.organizationUrl);

        const workItem = await witApi.createWorkItem(
          null as any, // customHeaders
          patchDocument,
          params.projectName,
          params.workItemType
        );

        if (!workItem || !workItem.id) {
          throw new Error(
            `Falha ao criar work item do tipo ${params.workItemType}: resposta inválida da API.`
          );
        }

        return {
          id: workItem.id,
          url: workItem._links?.html?.href || workItem.url || '',
          type: params.workItemType,
          title: params.title,
        };
      });
    } catch (error) {
      // Wrap non-WorkItemCreationError failures with partial failure context
      if (error instanceof WorkItemCreationError) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : String(error);

      throw new WorkItemCreationError(
        message,
        params.workItemType,
        params.title,
        params.createdItems || []
      );
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Lista cards de um time que estão em uma coluna específica do board.
   *
   * Usa WIQL filtrando por `System.AreaPath` e `System.BoardColumn`. Por padrão
   * exclui cards em estado "Closed" / "Removed" para focar no trabalho ativo.
   *
   * Após o WIQL (que retorna apenas IDs), faz um segundo round trip via
   * `getWorkItems` para hidratar título, tipo, estado e coluna de cada card.
   */
  async listWorkItemsByBoardColumn(
    params: ListByBoardColumnParams
  ): Promise<BoardWorkItem[]> {
    return this.withRetry(async () => {
      const witApi: IWorkItemTrackingApi =
        await this.connection.getWorkItemTrackingApi();

      const excludeStates = params.excludeStates ?? ['Closed', 'Removed'];

      // Escapa aspas simples para evitar quebra de WIQL
      const escapedAreaPath = params.areaPath.replace(/'/g, "''");
      const escapedColumn = params.boardColumn.replace(/'/g, "''");
      const stateClause = excludeStates.length
        ? ` AND [System.State] NOT IN (${excludeStates
            .map((s) => `'${s.replace(/'/g, "''")}'`)
            .join(', ')})`
        : '';

      const wiql = {
        query: `SELECT [System.Id] FROM WorkItems
                WHERE [System.AreaPath] UNDER '${escapedAreaPath}'
                  AND [System.BoardColumn] = '${escapedColumn}'${stateClause}`,
      };

      const queryResult = await witApi.queryByWiql(wiql, {
        project: params.projectName,
      });

      const ids = (queryResult?.workItems || [])
        .map((w) => w.id)
        .filter((id): id is number => typeof id === 'number');

      if (ids.length === 0) {
        return [];
      }

      // Hidrata os campos relevantes em uma única chamada batched
      const workItems = await witApi.getWorkItems(
        ids,
        [
          'System.Id',
          'System.Title',
          'System.WorkItemType',
          'System.State',
          'System.BoardColumn',
          'System.AreaPath',
        ],
        undefined,
        undefined,
        undefined,
        params.projectName
      );

      return (workItems || []).map((wi) => {
        const fields = wi.fields || {};
        return {
          id: wi.id ?? 0,
          title: fields['System.Title'] ?? '',
          workItemType: fields['System.WorkItemType'] ?? '',
          state: fields['System.State'] ?? '',
          boardColumn: fields['System.BoardColumn'] ?? '',
          areaPath: fields['System.AreaPath'] ?? '',
          url: (wi as any)._links?.html?.href || wi.url || '',
        };
      });
    });
  }

  /**
   * Busca os comentários de um work item.
   *
   * Solicita `RenderedText` no expand para obter tanto o texto cru (markdown)
   * quanto o HTML renderizado — útil para extrair URLs que possam vir só dentro
   * de tags `<a href="...">`.
   */
  async getWorkItemComments(
    projectName: string,
    workItemId: number
  ): Promise<WorkItemComment[]> {
    return this.withRetry(async () => {
      const witApi: IWorkItemTrackingApi =
        await this.connection.getWorkItemTrackingApi();

      // 1 = Reactions, 8 = RenderedText (CommentExpandOptions)
      const RENDERED_TEXT_EXPAND = 8;

      const allComments: WorkItemComment[] = [];
      let continuationToken: string | undefined;

      // Pagina via continuation token para cobrir cards com muitos comentários
      do {
        const result: any = await witApi.getComments(
          projectName,
          workItemId,
          undefined, // top
          continuationToken,
          false, // includeDeleted
          RENDERED_TEXT_EXPAND as any
        );

        const batch = (result?.comments || []) as Array<any>;
        for (const c of batch) {
          allComments.push({
            id: c.id ?? 0,
            workItemId: c.workItemId ?? workItemId,
            text: c.text ?? '',
            renderedText: c.renderedText ?? undefined,
            createdBy: c.createdBy?.displayName ?? c.createdBy?.uniqueName,
            createdDate: c.createdDate ? new Date(c.createdDate) : undefined,
          });
        }

        continuationToken = result?.continuationToken || undefined;
      } while (continuationToken);

      return allComments;
    });
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Maps Azure DevOps SDK TimeFrame enum to our domain sprint status.
   */
  private mapTimeFrame(
    timeFrame: TimeFrame | undefined
  ): 'past' | 'current' | 'future' {
    switch (timeFrame) {
      case TimeFrame.Past:
        return 'past';
      case TimeFrame.Current:
        return 'current';
      case TimeFrame.Future:
        return 'future';
      default:
        return 'future';
    }
  }

  /**
   * Maps SDK errors to domain-specific errors with descriptive messages.
   */
  private mapError(error: unknown): Error {
    if (error instanceof AzureDevOpsAuthError) {
      return error;
    }

    const statusCode = this.extractStatusCode(error);
    const message = this.extractMessage(error);

    if (statusCode === 401 || statusCode === 403) {
      return new AzureDevOpsAuthError(
        `Falha na autenticação: o Personal Access Token (PAT) é inválido ou expirou. Verifique suas credenciais. (HTTP ${statusCode})`,
        statusCode
      );
    }

    if (statusCode === 404) {
      return new Error(
        `Organização não encontrada: a URL "${this.organizationUrl}" não corresponde a uma organização válida do Azure DevOps. Verifique a URL e tente novamente.`
      );
    }

    if (this.isTransientError(error)) {
      return new Error(`Erro de rede transitório: ${message}`);
    }

    return error instanceof Error
      ? error
      : new Error(String(error));
  }

  /**
   * Extracts HTTP status code from SDK error objects.
   */
  private extractStatusCode(error: unknown): number | undefined {
    if (error && typeof error === 'object') {
      const err = error as any;
      return err.statusCode || err.status || err.response?.statusCode;
    }
    return undefined;
  }

  /**
   * Extracts error message from various error formats.
   */
  private extractMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Determines if an error is transient and eligible for retry.
   * Transient errors include network timeouts, connection resets, and 5xx server errors.
   */
  private isTransientError(error: unknown): boolean {
    const statusCode = this.extractStatusCode(error);

    // 5xx server errors are transient
    if (statusCode && statusCode >= 500) {
      return true;
    }

    // Network-level errors
    if (error instanceof Error) {
      const transientCodes = [
        'ECONNRESET',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'EAI_AGAIN',
        'EPIPE',
        'EHOSTUNREACH',
      ];
      const errorCode = (error as any).code;
      if (errorCode && transientCodes.includes(errorCode)) {
        return true;
      }

      // Check for timeout-related messages
      if (
        error.message.toLowerCase().includes('timeout') ||
        error.message.toLowerCase().includes('network')
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Executes an operation with retry and exponential backoff.
   * Only retries on transient errors (network failures, 5xx).
   * Non-retryable errors (401, 403, 404) are thrown immediately with mapped messages.
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry auth errors
        if (error instanceof AzureDevOpsAuthError) {
          throw error;
        }

        const statusCode = this.extractStatusCode(error);

        // Don't retry 401/403 — map and throw immediately
        if (statusCode === 401 || statusCode === 403) {
          throw this.mapError(error);
        }

        // Don't retry 404 — map and throw immediately
        if (statusCode === 404) {
          throw this.mapError(error);
        }

        // Only retry transient errors
        if (!this.isTransientError(error)) {
          throw this.mapError(error);
        }

        // Don't wait after the last attempt
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw this.mapError(lastError);
  }

  /**
   * Utility sleep function for retry delays.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

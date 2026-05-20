/**
 * DeployBoardCollector — Orquestra a varredura da raia "Deploy" (ou outra
 * coluna informada) no board de um time, lendo os comentários de cada card
 * e extraindo as URLs de PR do GitHub (organização wiipobr).
 *
 * Saída pensada para alimentar o template do `sre-demanda.md` sem precisar
 * perguntar PRs ao usuário quando eles já estão registrados nos cards.
 */

import {
  IAzureDevOpsClient,
  BoardWorkItem,
  WorkItemComment,
} from '../infrastructure/azure-devops-client';
import {
  GithubPullRequest,
  extractWiipoPullRequestsFromMany,
} from '../domain/github-pr-extractor';

/** Parâmetros para coleta de PRs por coluna do board. */
export interface CollectDeployPRsParams {
  /** Projeto no Azure DevOps (ex.: "Wiipo"). */
  projectName: string;
  /** AreaPath do time (ex.: "Wiipo\\Holerite"). */
  areaPath: string;
  /** Nome da coluna no board (default: "Deploy"). */
  boardColumn?: string;
  /**
   * Concorrência máxima ao buscar comentários — evita estourar rate limit
   * quando a coluna tem muitos cards.
   */
  concurrency?: number;
}

/** Resultado por card encontrado na coluna. */
export interface DeployCardSummary {
  workItem: BoardWorkItem;
  comments: WorkItemComment[];
  pullRequests: GithubPullRequest[];
}

/** Saída agregada da coleta. */
export interface CollectDeployPRsResult {
  cards: DeployCardSummary[];
  /** Cards que não tinham nenhum PR identificado nos comentários. */
  cardsWithoutPRs: BoardWorkItem[];
  /** União única de todos os PRs encontrados (preserva ordem de descoberta). */
  allPullRequests: GithubPullRequest[];
}

const DEFAULT_BOARD_COLUMN = 'Deploy';
const DEFAULT_CONCURRENCY = 5;

export class DeployBoardCollector {
  constructor(private readonly adoClient: IAzureDevOpsClient) {}

  /**
   * Lê a coluna do board, baixa comentários em paralelo (com limite de
   * concorrência) e extrai os PRs `wiipobr/*` referenciados.
   */
  async collect(
    params: CollectDeployPRsParams
  ): Promise<CollectDeployPRsResult> {
    const boardColumn = params.boardColumn ?? DEFAULT_BOARD_COLUMN;
    const concurrency = Math.max(1, params.concurrency ?? DEFAULT_CONCURRENCY);

    const cards = await this.adoClient.listWorkItemsByBoardColumn({
      projectName: params.projectName,
      areaPath: params.areaPath,
      boardColumn,
    });

    if (cards.length === 0) {
      return { cards: [], cardsWithoutPRs: [], allPullRequests: [] };
    }

    const summaries = await this.mapWithConcurrency(
      cards,
      concurrency,
      async (card) => this.summarizeCard(params.projectName, card)
    );

    const cardsWithoutPRs = summaries
      .filter((s) => s.pullRequests.length === 0)
      .map((s) => s.workItem);

    const allTexts = summaries.flatMap((s) =>
      s.comments.flatMap((c) => [c.text, c.renderedText])
    );
    const allPullRequests = extractWiipoPullRequestsFromMany(allTexts);

    return {
      cards: summaries,
      cardsWithoutPRs,
      allPullRequests,
    };
  }

  private async summarizeCard(
    projectName: string,
    workItem: BoardWorkItem
  ): Promise<DeployCardSummary> {
    const comments = await this.adoClient.getWorkItemComments(
      projectName,
      workItem.id
    );

    const texts = comments.flatMap((c) => [c.text, c.renderedText]);
    const pullRequests = extractWiipoPullRequestsFromMany(texts);

    return { workItem, comments, pullRequests };
  }

  /**
   * Pequeno mapper com limite de concorrência — preserva a ordem original.
   */
  private async mapWithConcurrency<T, R>(
    items: ReadonlyArray<T>,
    concurrency: number,
    fn: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) {
          return;
        }
        results[index] = await fn(items[index]);
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker()
    );
    await Promise.all(workers);

    return results;
  }
}

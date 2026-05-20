/**
 * Unit tests for DeployBoardCollector (application/deploy-board-collector)
 */

import { describe, it, expect, vi } from 'vitest';
import { DeployBoardCollector } from '../../../src/application/deploy-board-collector';
import {
  IAzureDevOpsClient,
  BoardWorkItem,
  WorkItemComment,
} from '../../../src/infrastructure/azure-devops-client';

function makeCard(overrides: Partial<BoardWorkItem> = {}): BoardWorkItem {
  return {
    id: 1,
    title: 'Card',
    workItemType: 'User Story',
    state: 'Active',
    boardColumn: 'Deploy',
    areaPath: 'Wiipo\\Holerite',
    url: 'https://dev.azure.com/wiipo/_workitems/edit/1',
    ...overrides,
  };
}

function makeComment(
  workItemId: number,
  text: string,
  rendered?: string
): WorkItemComment {
  return {
    id: Math.floor(Math.random() * 100000),
    workItemId,
    text,
    renderedText: rendered,
    createdBy: 'Tester',
    createdDate: new Date('2026-05-19T10:00:00Z'),
  };
}

function createMockClient(
  cards: BoardWorkItem[],
  commentsByCard: Record<number, WorkItemComment[]>
): IAzureDevOpsClient {
  return {
    validateConnection: vi.fn(),
    listProjects: vi.fn(),
    listTeams: vi.fn(),
    listSprints: vi.fn(),
    createWorkItem: vi.fn(),
    listWorkItemsByBoardColumn: vi.fn().mockResolvedValue(cards),
    getWorkItemComments: vi
      .fn()
      .mockImplementation(async (_project: string, id: number) => {
        return commentsByCard[id] ?? [];
      }),
  };
}

describe('DeployBoardCollector', () => {
  it('returns empty result when no cards exist in the column', async () => {
    const client = createMockClient([], {});
    const collector = new DeployBoardCollector(client);

    const result = await collector.collect({
      projectName: 'Wiipo',
      areaPath: 'Wiipo\\Holerite',
    });

    expect(result.cards).toEqual([]);
    expect(result.cardsWithoutPRs).toEqual([]);
    expect(result.allPullRequests).toEqual([]);
    expect(client.getWorkItemComments).not.toHaveBeenCalled();
  });

  it('uses "Deploy" as the default board column', async () => {
    const client = createMockClient([], {});
    const collector = new DeployBoardCollector(client);

    await collector.collect({
      projectName: 'Wiipo',
      areaPath: 'Wiipo\\Holerite',
    });

    expect(client.listWorkItemsByBoardColumn).toHaveBeenCalledWith({
      projectName: 'Wiipo',
      areaPath: 'Wiipo\\Holerite',
      boardColumn: 'Deploy',
    });
  });

  it('honours a custom board column when provided', async () => {
    const client = createMockClient([], {});
    const collector = new DeployBoardCollector(client);

    await collector.collect({
      projectName: 'Wiipo',
      areaPath: 'Wiipo\\Holerite',
      boardColumn: 'Pronto para Deploy',
    });

    expect(client.listWorkItemsByBoardColumn).toHaveBeenCalledWith({
      projectName: 'Wiipo',
      areaPath: 'Wiipo\\Holerite',
      boardColumn: 'Pronto para Deploy',
    });
  });

  it('extracts PRs found in card comments and aggregates them globally', async () => {
    const cards = [
      makeCard({ id: 10, title: 'Ajuste API holerite' }),
      makeCard({ id: 11, title: 'Bugfix dashboard' }),
    ];

    const commentsByCard: Record<number, WorkItemComment[]> = {
      10: [
        makeComment(
          10,
          'Subindo: https://github.com/wiipobr/wiipo-mobile-backend/pull/1441'
        ),
      ],
      11: [
        makeComment(
          11,
          '<a href="https://github.com/wiipobr/wiipo-platform/pull/57">PR</a>',
          '<p><a href="https://github.com/wiipobr/wiipo-platform/pull/57">link</a></p>'
        ),
        makeComment(
          11,
          'Outro: https://github.com/wiipobr/wiipo-platform/pull/58'
        ),
      ],
    };

    const client = createMockClient(cards, commentsByCard);
    const collector = new DeployBoardCollector(client);

    const result = await collector.collect({
      projectName: 'Wiipo',
      areaPath: 'Wiipo\\Holerite',
    });

    expect(result.cards).toHaveLength(2);

    const card10 = result.cards.find((c) => c.workItem.id === 10)!;
    expect(card10.pullRequests.map((p) => p.number)).toEqual([1441]);

    const card11 = result.cards.find((c) => c.workItem.id === 11)!;
    // PR 57 aparece em text e renderedText do mesmo comentário — deve dedup
    expect(card11.pullRequests.map((p) => p.number)).toEqual([57, 58]);

    // Conjunto agregado: 1441, 57, 58
    expect(result.allPullRequests.map((p) => p.number).sort()).toEqual(
      [57, 58, 1441].sort()
    );
    expect(result.cardsWithoutPRs).toEqual([]);
  });

  it('reports cards without any PR reference in cardsWithoutPRs', async () => {
    const cards = [
      makeCard({ id: 20, title: 'Sem PR ainda' }),
      makeCard({ id: 21, title: 'Com PR' }),
    ];

    const commentsByCard: Record<number, WorkItemComment[]> = {
      20: [makeComment(20, 'Comentário sem nenhuma URL relevante')],
      21: [
        makeComment(
          21,
          'PR https://github.com/wiipobr/wiipo-platform/pull/99'
        ),
      ],
    };

    const client = createMockClient(cards, commentsByCard);
    const collector = new DeployBoardCollector(client);

    const result = await collector.collect({
      projectName: 'Wiipo',
      areaPath: 'Wiipo\\Holerite',
    });

    expect(result.cardsWithoutPRs.map((c) => c.id)).toEqual([20]);
    expect(result.allPullRequests).toHaveLength(1);
    expect(result.allPullRequests[0].number).toBe(99);
  });

  it('limits parallel comment fetches by the configured concurrency', async () => {
    const cards = Array.from({ length: 6 }, (_, i) =>
      makeCard({ id: i + 1, title: `Card ${i + 1}` })
    );
    const commentsByCard: Record<number, WorkItemComment[]> = {};
    for (const card of cards) {
      commentsByCard[card.id] = [];
    }

    let inFlight = 0;
    let maxInFlight = 0;
    const client: IAzureDevOpsClient = {
      validateConnection: vi.fn(),
      listProjects: vi.fn(),
      listTeams: vi.fn(),
      listSprints: vi.fn(),
      createWorkItem: vi.fn(),
      listWorkItemsByBoardColumn: vi.fn().mockResolvedValue(cards),
      getWorkItemComments: vi.fn().mockImplementation(async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 10));
        inFlight--;
        return [];
      }),
    };

    const collector = new DeployBoardCollector(client);
    await collector.collect({
      projectName: 'Wiipo',
      areaPath: 'Wiipo\\Holerite',
      concurrency: 2,
    });

    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(client.getWorkItemComments).toHaveBeenCalledTimes(6);
  });

  it('preserves the original card order in the summaries', async () => {
    const cards = [
      makeCard({ id: 30 }),
      makeCard({ id: 31 }),
      makeCard({ id: 32 }),
    ];
    const commentsByCard: Record<number, WorkItemComment[]> = {
      30: [],
      31: [],
      32: [],
    };

    const client = createMockClient(cards, commentsByCard);
    const collector = new DeployBoardCollector(client);

    const result = await collector.collect({
      projectName: 'Wiipo',
      areaPath: 'Wiipo\\Holerite',
    });

    expect(result.cards.map((c) => c.workItem.id)).toEqual([30, 31, 32]);
  });
});

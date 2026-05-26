/**
 * Lista os work items do time Plataforma na Sprint - Maio que ainda não estão
 * em Done/Closed/Removed — ou seja, todos que estão em andamento (até a coluna Review).
 */

import 'dotenv/config';
import * as azdev from 'azure-devops-node-api';

const ORG_URL = process.env.AZURE_DEVOPS_ORG_URL!;
const PAT = process.env.AZURE_DEVOPS_PAT!;
const PROJECT = 'Wiipo';
const AREA_PATH = 'Wiipo\\Plataforma';
const ITERATION_PATH = 'Wiipo\\Plataforma\\Sprint - Maio';

async function main() {
  const authHandler = azdev.getPersonalAccessTokenHandler(PAT);
  const connection = new azdev.WebApi(ORG_URL, authHandler);
  const witApi = await connection.getWorkItemTrackingApi();

  const wiql = {
    query: `
      SELECT [System.Id]
      FROM WorkItems
      WHERE [System.TeamProject] = '${PROJECT}'
        AND [System.AreaPath] UNDER '${AREA_PATH}'
        AND [System.IterationPath] = '${ITERATION_PATH}'
        AND [System.State] NOT IN ('Done', 'Closed', 'Removed', 'Resolved')
      ORDER BY [System.WorkItemType], [System.State], [System.Id]
    `,
  };

  const result = await witApi.queryByWiql(wiql, { project: PROJECT });
  const ids = (result.workItems || []).map((w) => w.id!).filter(Boolean);

  if (ids.length === 0) {
    console.log('Nenhum work item em andamento na Sprint - Maio (Plataforma).');
    return;
  }

  // hidrata os work items em chunks de 200 (limite da API)
  const items: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const r = await witApi.getWorkItems(
      chunk,
      [
        'System.Id',
        'System.WorkItemType',
        'System.Title',
        'System.State',
        'System.BoardColumn',
        'System.AssignedTo',
        'System.Tags',
        'System.Parent',
      ],
      undefined,
      undefined as any
    );
    items.push(...r);
  }

  // imprime tabela e dados crus
  const rows = items.map((wi) => {
    const f = wi.fields || {};
    return {
      id: wi.id,
      type: f['System.WorkItemType'],
      state: f['System.State'],
      column: f['System.BoardColumn'] || '',
      assignedTo:
        (f['System.AssignedTo'] && (f['System.AssignedTo'].displayName || f['System.AssignedTo'])) ||
        '',
      title: f['System.Title'],
      tags: f['System.Tags'] || '',
    };
  });

  console.log(`\nTotal em andamento na Sprint - Maio (Plataforma): ${rows.length}\n`);
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((err) => {
  console.error('Erro:', err?.message || err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});

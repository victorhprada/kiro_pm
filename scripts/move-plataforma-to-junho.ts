/**
 * Move work items do time Plataforma da Sprint - Maio para a Sprint - Junho.
 *
 * Estratégia:
 *  - Lê os itens em estado "New" (coluna Backlog) ou "Ready" (coluna To Do)
 *    na iteration Sprint - Maio do Plataforma.
 *  - Atualiza o IterationPath para Wiipo\Plataforma\Sprint - Junho.
 *
 * Itens em Test, Em Desenvolvimento e Epics ativas permanecem na Sprint - Maio.
 *
 * Antes de mover, valida que a iteration Sprint - Junho existe no time.
 *
 * Modo dry-run: passe --dry-run para apenas listar o que seria movido.
 */

import 'dotenv/config';
import * as azdev from 'azure-devops-node-api';

const ORG_URL = process.env.AZURE_DEVOPS_ORG_URL!;
const PAT = process.env.AZURE_DEVOPS_PAT!;
const PROJECT = 'Wiipo';
const TEAM = 'Plataforma';
const AREA_PATH = 'Wiipo\\Plataforma';
const FROM_ITERATION = 'Wiipo\\Plataforma\\Sprint - Maio';
const TO_ITERATION = 'Wiipo\\Plataforma\\Sprint - Junho';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const authHandler = azdev.getPersonalAccessTokenHandler(PAT);
  const connection = new azdev.WebApi(ORG_URL, authHandler);

  const witApi = await connection.getWorkItemTrackingApi();
  const workApi = await connection.getWorkApi();

  // 1) Validar que Sprint - Junho existe no time Plataforma
  console.log(`→ Validando que "${TO_ITERATION}" existe no time ${TEAM}...`);
  const teamContext = { projectId: PROJECT, teamId: TEAM };
  const iterations = await workApi.getTeamIterations(teamContext);
  const target = iterations.find((i) => i.path === TO_ITERATION);

  if (!target) {
    console.error(`\n❌ Iteration "${TO_ITERATION}" não está atribuída ao time ${TEAM}.`);
    console.error('Iterations disponíveis no time:');
    iterations.forEach((i) => console.error(`  - ${i.path} (id: ${i.id})`));
    console.error(
      '\nAdicione a Sprint - Junho ao time Plataforma em Project Settings → Team Configuration → Iterations e rode novamente.'
    );
    process.exit(1);
  }
  console.log(`  ✓ encontrada (id: ${target.id})`);

  // 2) Buscar itens em New ou Ready na Sprint - Maio
  const wiql = {
    query: `
      SELECT [System.Id]
      FROM WorkItems
      WHERE [System.TeamProject] = '${PROJECT}'
        AND [System.AreaPath] UNDER '${AREA_PATH}'
        AND [System.IterationPath] = '${FROM_ITERATION}'
        AND [System.State] IN ('New', 'Ready')
      ORDER BY [System.WorkItemType], [System.Id]
    `,
  };

  const result = await witApi.queryByWiql(wiql, { project: PROJECT });
  const ids = (result.workItems || []).map((w) => w.id!).filter(Boolean);

  if (ids.length === 0) {
    console.log('Nenhum item para mover.');
    return;
  }

  // 3) Hidrata para mostrar o que vai mover
  const items: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const r = await witApi.getWorkItems(
      chunk,
      ['System.Id', 'System.WorkItemType', 'System.Title', 'System.State', 'System.BoardColumn'],
      undefined,
      undefined as any
    );
    items.push(...r);
  }

  console.log(`\nItens a mover (${items.length}):`);
  items.forEach((wi) => {
    const f = wi.fields || {};
    console.log(
      `  #${wi.id} [${f['System.WorkItemType']}/${f['System.State']}/${f['System.BoardColumn'] || '-'}]  ${f['System.Title']}`
    );
  });

  if (DRY_RUN) {
    console.log('\n(DRY RUN — nada foi alterado.)');
    return;
  }

  // 4) Atualiza o IterationPath de cada item
  console.log(`\n→ Movendo para ${TO_ITERATION}...`);
  let ok = 0;
  let fail = 0;
  const failures: { id: number; error: string }[] = [];

  for (const wi of items) {
    try {
      const patch = [
        {
          op: 'add',
          path: '/fields/System.IterationPath',
          value: TO_ITERATION,
        },
      ];
      await witApi.updateWorkItem(null as any, patch, wi.id, PROJECT);
      ok++;
      process.stdout.write(`  ✓ #${wi.id}\n`);
    } catch (err: any) {
      fail++;
      const msg = err?.message || String(err);
      failures.push({ id: wi.id, error: msg });
      process.stdout.write(`  ✗ #${wi.id} — ${msg}\n`);
    }
  }

  console.log(`\nResultado: ${ok} movidos, ${fail} falhas.`);
  if (failures.length) {
    console.log('Falhas:');
    failures.forEach((f) => console.log(`  #${f.id}: ${f.error}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Erro:', err?.message || err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});

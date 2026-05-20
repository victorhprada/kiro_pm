/**
 * Ad-hoc runner: lista cards do board do time Holerite na coluna "Deploy",
 * busca comentários e extrai PRs do GitHub (org wiipobr) referenciados.
 *
 * Uso:
 *   npx tsx scripts/run-deploy-collector.ts
 *
 * Variáveis necessárias no .env:
 *   AZURE_DEVOPS_ORG_URL
 *   AZURE_DEVOPS_PAT
 */

import 'dotenv/config';
import { AzureDevOpsClient } from '../src/infrastructure/azure-devops-client';
import { DeployBoardCollector } from '../src/application/deploy-board-collector';

async function main() {
  const orgUrl = process.env.AZURE_DEVOPS_ORG_URL;
  const pat = process.env.AZURE_DEVOPS_PAT;

  if (!orgUrl || !pat) {
    console.error(
      'AZURE_DEVOPS_ORG_URL e AZURE_DEVOPS_PAT precisam estar definidos no .env'
    );
    process.exit(1);
  }

  const projectName = process.env.PROJECT_NAME || 'Wiipo';
  const areaPath = process.env.AREA_PATH || 'Wiipo\\Holerite';
  const boardColumn = process.env.BOARD_COLUMN || 'Deploy';

  const client = new AzureDevOpsClient(orgUrl, pat);
  await client.validateConnection();

  const collector = new DeployBoardCollector(client);
  const result = await collector.collect({
    projectName,
    areaPath,
    boardColumn,
  });

  console.log('━'.repeat(72));
  console.log(
    `Time/AreaPath: ${areaPath}    Coluna: "${boardColumn}"    Projeto: ${projectName}`
  );
  console.log('━'.repeat(72));
  console.log(`Cards encontrados: ${result.cards.length}`);
  console.log(`Cards sem PR identificado: ${result.cardsWithoutPRs.length}`);
  console.log(`PRs únicos (agregado): ${result.allPullRequests.length}`);
  console.log();

  for (const summary of result.cards) {
    const { workItem, comments, pullRequests } = summary;
    console.log(
      `#${workItem.id}  [${workItem.workItemType}]  ${workItem.title}`
    );
    console.log(`        estado: ${workItem.state}    coluna: ${workItem.boardColumn}`);
    console.log(`        comentários: ${comments.length}    prs: ${pullRequests.length}`);
    for (const pr of pullRequests) {
      console.log(`          • ${pr.url}`);
    }
    console.log();
  }

  if (result.cardsWithoutPRs.length > 0) {
    console.log('Cards SEM PR identificado nos comentários:');
    for (const c of result.cardsWithoutPRs) {
      console.log(`  - #${c.id}  ${c.title}`);
    }
    console.log();
  }

  if (result.allPullRequests.length > 0) {
    console.log('PRs únicos coletados (todos os cards):');
    for (const pr of result.allPullRequests) {
      console.log(`  • ${pr.url}`);
    }
  }
}

main().catch((err) => {
  console.error('Falha ao executar o collector:', err?.message || err);
  process.exit(1);
});

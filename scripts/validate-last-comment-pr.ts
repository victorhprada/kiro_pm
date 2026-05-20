/**
 * Valida a hipótese: "o último comentário de cada card na coluna Deploy
 * sempre contém o PR sandbox→master".
 *
 * Para cada card da coluna, mostra:
 *  - autor e data do último comentário
 *  - PRs extraídos APENAS do último comentário
 *  - PRs extraídos de TODOS os comentários
 *  - veredito: bate, não bate, ou comentário sem PR algum
 *
 * Uso: npx tsx scripts/validate-last-comment-pr.ts
 */

import 'dotenv/config';
import { AzureDevOpsClient } from '../src/infrastructure/azure-devops-client';
import {
  extractWiipoPullRequests,
  extractWiipoPullRequestsFromMany,
} from '../src/domain/github-pr-extractor';

async function main() {
  const orgUrl = process.env.AZURE_DEVOPS_ORG_URL;
  const pat = process.env.AZURE_DEVOPS_PAT;
  if (!orgUrl || !pat) {
    console.error('AZURE_DEVOPS_ORG_URL e AZURE_DEVOPS_PAT precisam estar definidos no .env');
    process.exit(1);
  }

  const projectName = process.env.PROJECT_NAME || 'Wiipo';
  const areaPath = process.env.AREA_PATH || 'Wiipo\\Holerite';
  const boardColumn = process.env.BOARD_COLUMN || 'Deploy';

  const client = new AzureDevOpsClient(orgUrl, pat);
  await client.validateConnection();

  const cards = await client.listWorkItemsByBoardColumn({
    projectName,
    areaPath,
    boardColumn,
  });

  console.log('━'.repeat(80));
  console.log(`Hipótese: o último comentário de cada card contém o PR sandbox→master`);
  console.log(`Time/AreaPath: ${areaPath}    Coluna: "${boardColumn}"`);
  console.log('━'.repeat(80));

  let confirmaHipotese = 0;
  let falhaHipotese = 0;
  let semPRNenhum = 0;

  for (const card of cards) {
    const comments = await client.getWorkItemComments(projectName, card.id);

    // Comentários vêm ordenados do mais recente para o mais antigo, segundo a doc do ADO.
    // Para garantir, vamos ordenar por createdDate desc — o "último" é o mais recente.
    const sortedDesc = [...comments].sort((a, b) => {
      const da = a.createdDate?.getTime() ?? 0;
      const db = b.createdDate?.getTime() ?? 0;
      return db - da;
    });

    const last = sortedDesc[0];
    const lastComentTexts = last ? [last.text, last.renderedText] : [];
    const lastPRs = extractWiipoPullRequestsFromMany(lastComentTexts);

    const allTexts = comments.flatMap((c) => [c.text, c.renderedText]);
    const allPRs = extractWiipoPullRequestsFromMany(allTexts);

    console.log();
    console.log(`#${card.id}  ${card.title}`);
    console.log(
      `  comentários: ${comments.length}    último por: ${last?.createdBy ?? '—'}    em: ${
        last?.createdDate?.toISOString() ?? '—'
      }`
    );

    if (last) {
      const preview = (last.text || last.renderedText || '')
        .replace(/\s+/g, ' ')
        .slice(0, 140);
      console.log(`  último (preview): ${preview}${preview.length >= 140 ? '…' : ''}`);
    }

    console.log(`  PRs no último comentário: ${lastPRs.length}`);
    for (const pr of lastPRs) console.log(`    • ${pr.url}`);

    console.log(`  PRs em qualquer comentário: ${allPRs.length}`);
    for (const pr of allPRs) console.log(`    • ${pr.url}`);

    if (allPRs.length === 0) {
      console.log(`  veredito: ⚠️  SEM PR em nenhum comentário`);
      semPRNenhum++;
    } else if (lastPRs.length > 0) {
      // Confere se todos os PRs encontrados no último comentário também aparecem no agregado
      // (sempre vão, é só dupla checagem) — e mostra se o último comentário cobre tudo
      const lastSet = new Set(lastPRs.map((p) => p.url));
      const allSet = new Set(allPRs.map((p) => p.url));
      const cobreTodos = [...allSet].every((u) => lastSet.has(u));
      if (cobreTodos) {
        console.log(`  veredito: ✅ último comentário tem PR(s) e cobre todos os encontrados`);
      } else {
        const faltam = [...allSet].filter((u) => !lastSet.has(u));
        console.log(
          `  veredito: ⚠️  último comentário tem PR(s) MAS não cobre todos os encontrados — faltam: ${faltam.join(', ')}`
        );
      }
      confirmaHipotese++;
    } else {
      console.log(
        `  veredito: ❌ último comentário SEM PR (mas existem PRs em comentários anteriores)`
      );
      falhaHipotese++;
    }
  }

  console.log();
  console.log('━'.repeat(80));
  console.log(`Resumo (${cards.length} cards):`);
  console.log(`  ✅ último comentário tem PR:                 ${confirmaHipotese}`);
  console.log(`  ❌ último comentário sem PR (mas há antes):  ${falhaHipotese}`);
  console.log(`  ⚠️  nenhum comentário tem PR:                ${semPRNenhum}`);
  console.log('━'.repeat(80));
}

main().catch((err) => {
  console.error('Falha:', err?.message || err);
  process.exit(1);
});

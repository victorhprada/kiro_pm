/**
 * Cria a hierarquia Epic → Feature → 5 User Stories no Azure DevOps
 * para a demanda "Atualização de runtimes Node.js das Lambdas em produção".
 *
 * Time: Plataforma | Sprint: Sprint - Maio | Release: 2026 R2
 */

import 'dotenv/config';
import * as azdev from 'azure-devops-node-api';

const ORG_URL = process.env.AZURE_DEVOPS_ORG_URL!;
const PAT = process.env.AZURE_DEVOPS_PAT!;
const PROJECT = 'Wiipo';
const AREA_PATH = 'Wiipo\\Plataforma';
const ITERATION_PATH = 'Wiipo\\Plataforma\\Sprint - Maio';
const RELEASE = '2026 R2';

// ─── Conteúdos ─────────────────────────────────────────────────────────────

const EPIC_TITLE =
  'Atualização de runtimes Node.js das Lambdas em produção para versões suportadas';

const EPIC_DESCRIPTION = `<p>Hoje convivemos em produção com Lambdas em runtimes Node.js fora de suporte (nodejs16.x e nodejs18.x — EOL na AWS) e em maintenance LTS (nodejs20.x), além de projetos com runtimes mistos no mesmo serviço. Esse cenário gera risco de segurança (sem patches de CVE), risco operacional (AWS bloqueia create/update de funções em runtimes EOL) e dificulta a padronização do time.</p>
<p>Esta demanda tem como objetivo elevar todas as Lambdas de produção para um runtime ativo (<b>nodejs22.x</b> como alvo padrão), priorizando primeiro o que está EOL, depois o maintenance LTS, e eliminar runtimes mistos dentro de um mesmo projeto.</p>
<p><b>Base de referência:</b> relatório <i>Lambdas por Projeto - Runtimes em Prod</i> gerado em 2026-05-20 (profile <code>prod</code>, região <code>us-east-1</code>).</p>`;

const FEATURE_TITLE =
  'Plano de migração de runtimes EOL e maintenance LTS para Node.js 22.x em produção';

const FEATURE_DESCRIPTION = `<p>Executar a migração das Lambdas de produção para nodejs22.x em três ondas, conforme criticidade do runtime atual:</p>
<ol>
  <li><b>Onda 1 — EOL crítico (nodejs16.x):</b> 5 lambdas em 5 serviços (blob-service, integrator-admin-backend, integrator-consent-key-admin-backend, partner-consent-admin-backend, signup-integrator-key-admin-backend).</li>
  <li><b>Onda 2 — EOL (nodejs18.x):</b> 2 lambdas (integrator-customer-admin-backend e a <code>custom-resource-existing-s3</code> de user-service).</li>
  <li><b>Onda 3 — Maintenance LTS (nodejs20.x):</b> 14 projetos, ~30 lambdas (authorization-service, billing-service, convert-to-pdf-service, integrator-consent-admin-backend, partner-service, partnership-service e suas variantes, product-admin-backend, service-banners, service-campaign-push, service-group-campaign-pendent, service-pendent-payslip-push, signup-integrator-admin-backend, tenant-admin-backend, notification-service).</li>
  <li><b>Cleanup — runtimes mistos:</b> padronizar wiipo-service-support-platform (hoje 22.x + 24.x) e wiipo-user-service (hoje 18.x + 22.x) para um único runtime alvo.</li>
</ol>
<p>Para cada lambda, a migração inclui: atualizar o runtime no IaC (serverless.yml / SAM / CDK conforme o projeto), atualizar a versão do Node.js no <code>package.json</code> / <code>engines</code>, validar build e testes, validar smoke test em homologação e produção pós-deploy. Não é escopo desta demanda reescrever código de negócio — apenas o necessário para compatibilidade com o novo runtime (deps com binários nativos, AWS SDK v2 → v3 quando o runtime exigir, etc.).</p>`;

interface UserStoryDef {
  title: string;
  description: string;
  acceptanceCriteria: string;
}

const USER_STORIES: UserStoryDef[] = [
  {
    title: 'Migrar Lambdas em nodejs16.x (EOL crítico) para nodejs22.x',
    description: `<p><b>Como</b> time de Plataforma, <b>eu quero</b> atualizar as Lambdas em nodejs16.x para nodejs22.x, <b>para que</b> paremos de operar em runtime EOL e voltemos a receber patches de segurança e suporte da AWS.</p>
<p><b>Contexto técnico:</b></p>
<ul>
  <li>Lambdas alvo (5):
    <ul>
      <li><code>blob-service-prod-app</code> (wiipo-blob-service)</li>
      <li><code>wiipo-integrator-admin-backend-prod-app</code> (wiipo-integrator-admin-backend)</li>
      <li><code>wiipo-integrator-consent-key-admin-backend-prod-app</code> (wiipo-integrator-consent-key-admin-backend)</li>
      <li><code>wiipo-partner-consent-admin-backend-prod-app</code> (wiipo-partner-consent-admin-backend)</li>
      <li><code>wiipo-signup-integrator-key-admin-backend-prod-app</code> (wiipo-signup-integrator-key-admin-backend)</li>
    </ul>
  </li>
  <li>Atenção a quebras conhecidas saindo do Node 16: AWS SDK v2 mantido (mas recomenda-se v3), libs com binários nativos (sharp, canvas, bcrypt) precisam ser recompiladas, sintaxe legada já removida (ex.: <code>Buffer()</code> deprecated), suporte ao SSL/TLS atualizado.</li>
  <li>Cada deploy deve ser feito em janela controlada, um serviço por vez, com rollback claro.</li>
</ul>`,
    acceptanceCriteria: `<ol>
  <li>Todas as 5 Lambdas listadas estão rodando em nodejs22.x em produção, comprovado por novo relatório de runtime.</li>
  <li>Para cada serviço, o IaC (serverless.yml / SAM / CDK) e o <code>package.json</code> (<code>engines.node</code>) refletem o runtime nodejs22.x.</li>
  <li>Build e testes automatizados de cada serviço passam no pipeline com Node 22.</li>
  <li>Smoke test pós-deploy validado em produção para cada serviço (chamada real ao endpoint principal ou execução real do consumer/cron, conforme aplicável).</li>
  <li>Para libs com binários nativos, foi feita reinstalação/rebuild compatível com Node 22 e o pacote foi publicado com sucesso na Lambda.</li>
  <li>Em caso de incompatibilidade do AWS SDK v2 com Node 22, a migração para AWS SDK v3 foi feita apenas onde necessário para o runtime funcionar.</li>
  <li>Plano de rollback documentado por serviço (versão anterior do alias / pinned package).</li>
  <li>Nenhum erro 5xx novo nem aumento relevante de latência (&gt;10%) nos serviços migrados nas 24h após o deploy.</li>
</ol>`,
  },
  {
    title: 'Migrar Lambdas em nodejs18.x (EOL) para nodejs22.x',
    description: `<p><b>Como</b> time de Plataforma, <b>eu quero</b> atualizar as Lambdas em nodejs18.x para nodejs22.x, <b>para</b> sair do estado EOL e padronizar com o runtime alvo do time.</p>
<p><b>Contexto técnico:</b></p>
<ul>
  <li>Lambdas alvo (2):
    <ul>
      <li><code>wiipo-integrator-customer-admin-backend-prod-app</code> (wiipo-integrator-customer-admin-backend)</li>
      <li><code>user-service-prod-custom-resource-existing-s3</code> (wiipo-user-service)</li>
    </ul>
  </li>
  <li>Para <code>user-service-prod-custom-resource-existing-s3</code>: trata-se de um custom resource do CloudFormation. Validar com cuidado — atualizar runtime de custom resource pode acionar replace de recursos no stack. Precisa de plano de mudança específico.</li>
  <li>Demais considerações iguais à US1 (deps nativas, AWS SDK).</li>
</ul>`,
    acceptanceCriteria: `<ol>
  <li>As 2 Lambdas listadas estão rodando em nodejs22.x em produção.</li>
  <li>IaC e <code>package.json</code> atualizados.</li>
  <li>Build e testes passando no pipeline com Node 22.</li>
  <li>Para <code>user-service-prod-custom-resource-existing-s3</code>: plano de mudança revisado e validado para garantir que a atualização do runtime do custom resource não acione replace indesejado de recursos S3 ou outros recursos referenciados.</li>
  <li>Smoke test pós-deploy validado em produção.</li>
  <li>Plano de rollback documentado.</li>
  <li>Nenhum erro 5xx novo nem aumento relevante de latência nos serviços migrados nas 24h após o deploy.</li>
</ol>`,
  },
  {
    title: 'Migrar Lambdas em nodejs20.x (maintenance LTS) para nodejs22.x',
    description: `<p><b>Como</b> time de Plataforma, <b>eu quero</b> atualizar as Lambdas em nodejs20.x para nodejs22.x, <b>para</b> sair de maintenance LTS antes do EOL e padronizar todas as Lambdas no mesmo runtime alvo.</p>
<p><b>Contexto técnico:</b></p>
<ul>
  <li>Projetos alvo (14) e número de lambdas:
    <ul>
      <li>wiipo-authorization-service (1)</li>
      <li>wiipo-billing-service (1)</li>
      <li>wiipo-convert-to-pdf-service (1)</li>
      <li>wiipo-integrator-consent-admin-backend (1)</li>
      <li>wiipo-partner-service (1)</li>
      <li>wiipo-partnership-service (7 — app, general-consents-record, general-record, migrations, quantitative-consents-record, quantitative-record, send-email-report)</li>
      <li>wiipo-product-admin-backend (1)</li>
      <li>wiipo-service-banners (1)</li>
      <li>wiipo-service-campaign-push (6 — catch_queue_errors, processor, processorAllTenantPush, processorPushToTenant, processorSummaryListCampaign, receiver)</li>
      <li>wiipo-service-group-campaign-pendent (2)</li>
      <li>wiipo-service-pendent-payslip-push (2)</li>
      <li>wiipo-signup-integrator-admin-backend (1)</li>
      <li>wiipo-tenant-admin-backend (1)</li>
      <li>wiipo-notification-service (4 — pushByCpfReceiver, receiver, sender, totalitems)</li>
    </ul>
  </li>
  <li>Total: ~30 lambdas. A migração pode ser feita em sub-ondas por serviço, sem necessidade de janela única.</li>
  <li>Risco menor que US1/US2 porque 20 → 22 é uma transição mais leve, mas ainda exige validação de build e smoke test por serviço.</li>
</ul>`,
    acceptanceCriteria: `<ol>
  <li>Todas as Lambdas listadas estão rodando em nodejs22.x em produção, confirmado por novo relatório.</li>
  <li>IaC e <code>package.json</code> atualizados em todos os 14 projetos.</li>
  <li>Build e testes passando no pipeline com Node 22 em todos os serviços.</li>
  <li>Smoke test pós-deploy validado por serviço.</li>
  <li>Plano de rollback documentado por serviço (mesmo que padronizado).</li>
  <li>Nenhum erro 5xx novo nem aumento relevante de latência (&gt;10%) nos serviços migrados nas 24h após o deploy.</li>
</ol>`,
  },
  {
    title: 'Eliminar runtimes mistos em projetos com mais de uma versão de Node',
    description: `<p><b>Como</b> time de Plataforma, <b>eu quero</b> padronizar para um único runtime alvo os projetos que hoje rodam com versões mistas de Node, <b>para</b> evitar inconsistência de comportamento e simplificar a manutenção.</p>
<p><b>Contexto técnico:</b></p>
<ul>
  <li>Projetos com runtime misto:
    <ul>
      <li><b>wiipo-service-support-platform</b>: 7 lambdas em nodejs24.x (current) + 1 em nodejs22.x (active LTS). Definir o alvo (manter 24.x ou voltar para 22.x). Recomendação inicial: padronizar em <b>nodejs22.x</b> (LTS ativo) para alinhar com o restante da plataforma.</li>
      <li><b>wiipo-user-service</b>: 5 lambdas em nodejs22.x (active LTS) + 1 em nodejs18.x (EOL — <code>user-service-prod-custom-resource-existing-s3</code>). A correção do 18.x é coberta na US2; aqui só validamos que o projeto fica com runtime único após a migração.</li>
    </ul>
  </li>
  <li>A escolha do alvo (22.x vs 24.x) deve ser registrada como decisão técnica antes da execução.</li>
</ul>`,
    acceptanceCriteria: `<ol>
  <li>Decisão de runtime alvo do projeto wiipo-service-support-platform documentada (22.x ou 24.x), com justificativa.</li>
  <li>Todas as 8 Lambdas de wiipo-service-support-platform rodando no mesmo runtime alvo em produção.</li>
  <li>Após a conclusão da US2, todas as Lambdas de wiipo-user-service estão no mesmo runtime (esperado: nodejs22.x).</li>
  <li>IaC dos dois projetos não permite mais runtimes diferentes entre lambdas do mesmo serviço (ex.: variável central de runtime no serverless.yml ou template SAM/CDK).</li>
  <li>Build, testes e smoke test pós-deploy validados.</li>
  <li>Nenhum erro 5xx novo nem aumento relevante de latência nos serviços nas 24h após o deploy.</li>
</ol>`,
  },
  {
    title: 'Garantir governança de runtimes para evitar regressão (lint/check no pipeline)',
    description: `<p><b>Como</b> time de Plataforma, <b>eu quero</b> um check automatizado que falhe o pipeline quando alguém configurar uma Lambda em runtime EOL ou em maintenance LTS sem aprovação, <b>para que</b> o trabalho desta demanda não se perca ao longo do tempo.</p>
<p><b>Contexto técnico:</b></p>
<ul>
  <li>Definir uma lista canônica de runtimes permitidos (ex.: alvo <code>nodejs22.x</code>, exceções pontuais aprovadas).</li>
  <li>Implementar verificação no pipeline de CI/CD ou pre-commit: ler arquivos <code>serverless.yml</code> / templates SAM/CDK e falhar build se encontrar runtime fora da lista.</li>
  <li>Reaproveitar (ou evoluir) o script que gera o relatório <i>Lambdas por Projeto - Runtimes em Prod</i> para rodar agendado e abrir alerta quando aparecer runtime EOL/maintenance.</li>
  <li>Não é escopo bloquear deploy retroativo — apenas novos PRs.</li>
</ul>`,
    acceptanceCriteria: `<ol>
  <li>Existe uma lista de runtimes permitidos versionada no repositório de Plataforma (ex.: <code>runtimes-allowlist.json</code> ou doc no Confluence/README), com runtime alvo e exceções aprovadas.</li>
  <li>PRs nos repositórios de serviços do escopo desta demanda falham automaticamente se introduzirem runtime fora da allowlist.</li>
  <li>O script de relatório de runtimes roda agendado (diário ou semanal) e gera alerta quando encontra runtime EOL ou maintenance LTS em produção.</li>
  <li>Documentação curta no README do time (ou steering equivalente) explicando: runtime alvo, processo para pedir exceção e como rodar o relatório local.</li>
  <li>Falha do check tem mensagem clara orientando o desenvolvedor sobre o runtime correto a usar.</li>
</ol>`,
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

interface CreatedItem {
  id: number;
  url: string;
  title: string;
  type: string;
}

async function createWorkItem(
  witApi: any,
  type: 'Epic' | 'Feature' | 'User Story',
  title: string,
  description: string,
  parentId: number | undefined,
  acceptanceCriteria: string | undefined
): Promise<CreatedItem> {
  const patch: any[] = [
    { op: 'add', path: '/fields/System.Title', value: title },
    { op: 'add', path: '/fields/System.Description', value: description },
    { op: 'add', path: '/fields/System.AreaPath', value: AREA_PATH },
    { op: 'add', path: '/fields/System.IterationPath', value: ITERATION_PATH },
    // Custom fields obrigatórios
    { op: 'add', path: '/fields/Custom.SR_ENTREGA', value: 'Não informada' },
    { op: 'add', path: '/fields/Custom.SR_TEM_IMPACTO_LGPD', value: 'Não' },
    { op: 'add', path: '/fields/Custom.SR_RELEASE', value: RELEASE },
  ];

  if (type === 'Epic') {
    patch.push({
      op: 'add',
      path: '/fields/Custom.SR_TIPO_DE_DEMANDA',
      value: 'Evolução tecnológica',
    });
  } else {
    // Feature e User Story exigem SR_PACOTES
    patch.push({
      op: 'add',
      path: '/fields/Custom.SR_PACOTES',
      value: 'Não se aplica',
    });
  }

  if (acceptanceCriteria && type === 'User Story') {
    patch.push({
      op: 'add',
      path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
      value: acceptanceCriteria,
    });
  }

  if (parentId) {
    patch.push({
      op: 'add',
      path: '/relations/-',
      value: {
        rel: 'System.LinkTypes.Hierarchy-Reverse',
        url: `${ORG_URL}/_apis/wit/workItems/${parentId}`,
      },
    });
  }

  const wi = await witApi.createWorkItem(null as any, patch, PROJECT, type);

  if (!wi?.id) {
    throw new Error(`Falha ao criar ${type} "${title}": resposta inválida.`);
  }

  const url =
    wi._links?.html?.href ||
    `${ORG_URL}/${PROJECT}/_workitems/edit/${wi.id}`;

  return { id: wi.id, url, title, type };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  if (!ORG_URL || !PAT) {
    console.error('AZURE_DEVOPS_ORG_URL e AZURE_DEVOPS_PAT precisam estar no .env');
    process.exit(1);
  }

  const authHandler = azdev.getPersonalAccessTokenHandler(PAT);
  const connection = new azdev.WebApi(ORG_URL, authHandler);

  await connection.connect();
  console.log('✓ Conectado ao Azure DevOps');

  const witApi = await connection.getWorkItemTrackingApi();
  const created: CreatedItem[] = [];

  // 1. Epic
  console.log('\n→ Criando Epic...');
  const epic = await createWorkItem(witApi, 'Epic', EPIC_TITLE, EPIC_DESCRIPTION, undefined, undefined);
  created.push(epic);
  console.log(`  ✓ Epic #${epic.id} — ${epic.url}`);

  // 2. Feature
  console.log('\n→ Criando Feature...');
  const feature = await createWorkItem(
    witApi,
    'Feature',
    FEATURE_TITLE,
    FEATURE_DESCRIPTION,
    epic.id,
    undefined
  );
  created.push(feature);
  console.log(`  ✓ Feature #${feature.id} — ${feature.url}`);

  // 3. User Stories
  for (let i = 0; i < USER_STORIES.length; i++) {
    const us = USER_STORIES[i];
    console.log(`\n→ Criando US${i + 1}...`);
    const story = await createWorkItem(
      witApi,
      'User Story',
      us.title,
      us.description,
      feature.id,
      us.acceptanceCriteria
    );
    created.push(story);
    console.log(`  ✓ US${i + 1} #${story.id} — ${story.url}`);
  }

  // Resumo final
  console.log('\n──────────────────────────────────────────────');
  console.log('RESUMO — work items criados:');
  console.log('──────────────────────────────────────────────');
  console.log(JSON.stringify(created, null, 2));

  return created;
}

main().catch((err) => {
  console.error('\n❌ Erro ao criar hierarquia:', err?.message || err);
  if (err?.stack) console.error(err.stack);
  process.exit(1);
});

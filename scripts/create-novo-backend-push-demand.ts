/**
 * Cria a hierarquia Epic → Feature → 8 User Stories no Azure DevOps
 * para a demanda "Novo backend de push notifications".
 *
 * Time: Plataforma | Sprint: Sprint - Junho | Release: 2026 R2
 */

import 'dotenv/config';
import * as azdev from 'azure-devops-node-api';

const ORG_URL = process.env.AZURE_DEVOPS_ORG_URL!;
const PAT = process.env.AZURE_DEVOPS_PAT!;
const PROJECT = 'Wiipo';
const AREA_PATH = 'Wiipo\\Plataforma';
const ITERATION_PATH = 'Wiipo\\Plataforma\\Sprint - Junho';
const RELEASE = '2026 R2';

// ─── Conteúdos ─────────────────────────────────────────────────────────────

const EPIC_TITLE =
  'Novo backend de push notifications (substituição do wiipo-service-campaign-push)';

const EPIC_DESCRIPTION = `<p>Criar um novo backend dedicado ao gerenciamento e envio de <b>push notifications</b> para as empresas, substituindo gradualmente o fluxo atual do <code>wiipo-service-campaign-push</code>.</p>
<p>A iniciativa busca:</p>
<ul>
  <li>reduzir a complexidade operacional;</li>
  <li>diminuir o acoplamento entre filas e lambdas;</li>
  <li>eliminar dependências de fluxos legados;</li>
  <li>padronizar a validação de tenants antes do disparo;</li>
  <li>fornecer observabilidade adequada (logs centralizados e métricas por campanha, tenant e action).</li>
</ul>
<p>O escopo desta Epic inclui as APIs de <b>logs</b>, <b>métricas</b>, <b>busca de tenant válido</b>, <b>push manual</b> (selecionado e global) e <b>push em lote</b> (upload + processamento), além das melhorias estruturais necessárias para operar com rastreabilidade e reduzir a dependência de listagens legadas que retornam tenants inválidos.</p>
<p><i>Esta proposta representa o escopo inicial e poderá evoluir durante o refinamento técnico.</i></p>`;

const FEATURE_TITLE =
  'APIs e infraestrutura do novo backend de push (logs, métricas, manual e lote)';

const FEATURE_DESCRIPTION = `<p>Implementar o conjunto de APIs e a base de infraestrutura do novo backend de push notifications, contemplando:</p>
<ul>
  <li>Listagem de logs de envio e métricas gerais com filtros por tenant e período.</li>
  <li>Busca de tenant válido por <code>codcli</code>, removendo a dependência da listagem atual.</li>
  <li>Envio manual para tenants específicos e envio global para todas as empresas.</li>
  <li>Fluxo de envio em lote via upload de arquivo: geração de URL temporária, recepção do arquivo e disparo controlado.</li>
  <li>Validação de tenants antes do processamento, evitando campanhas órfãs ou disparos para tenants inválidos.</li>
  <li>Observabilidade centralizada (logs estruturados, métricas por campanha/tenant/action) e fundação para retry/reprocessamento futuros.</li>
</ul>
<p>A Feature foca em entregar as rotas previstas com contratos claros e em estabelecer a arquitetura simplificada (menos lambdas, filas separadas por responsabilidade) que deve substituir gradualmente o fluxo atual do <code>wiipo-service-campaign-push</code>.</p>`;

interface UserStoryDef {
  title: string;
  description: string;
  acceptanceCriteria: string;
}

const USER_STORIES: UserStoryDef[] = [
  {
    title: 'Endpoint de listagem de logs de envio (GET /push/logs)',
    description: `<p><b>Como</b> time de operação de push, <b>eu quero</b> consultar logs de envio em uma rota dedicada do novo backend, <b>para que</b> eu consiga auditar disparos por tenant, campanha e período sem depender do fluxo legado.</p>`,
    acceptanceCriteria: `<ol>
  <li><code>GET /push/logs</code> retorna lista paginada de eventos de envio com, no mínimo: identificador da campanha, tenant, action, status, timestamp e tempo de processamento.</li>
  <li>Suporta filtros por <code>tenant</code>, <code>campanha</code>, <code>status</code> e intervalo de datas (<code>from</code>/<code>to</code>); chamadas sem filtros válidos retornam página padrão sem erro.</li>
  <li>Endpoint exige autenticação/autorização compatível com o restante do gerenciador de push e não expõe dados sensíveis (PII) em nível <code>info</code>.</li>
  <li>Contrato documentado em Swagger/OpenAPI com request, response e códigos de erro.</li>
</ol>`,
  },
  {
    title: 'Endpoint de métricas gerais de push (GET /push/metrics)',
    description: `<p><b>Como</b> time de operação de push, <b>eu quero</b> um endpoint de métricas agregadas, <b>para que</b> eu acompanhe volume e saúde dos disparos sem precisar montar consultas manuais.</p>`,
    acceptanceCriteria: `<ol>
  <li><code>GET /push/metrics</code> retorna, no mínimo: total enviados, total com erro, total pendentes, status agregado por campanha e tempo médio de processamento.</li>
  <li>Suporta filtros por <code>tenant</code> e por período (<code>from</code>/<code>to</code>); valores padrão são definidos quando os filtros não são informados.</li>
  <li>Resposta documentada em Swagger/OpenAPI, incluindo unidade/granularidade de cada métrica.</li>
  <li>Endpoint exige autenticação/autorização compatível com o restante do gerenciador de push.</li>
</ol>`,
  },
  {
    title: 'Busca de tenant válido por codcli (GET /tenant/by-codcli/:codcli)',
    description: `<p><b>Como</b> portal de gestão de push, <b>eu quero</b> consultar um tenant pelo <code>codcli</code> em uma rota dedicada do novo backend, <b>para que</b> eu evite utilizar tenants inválidos e remova a dependência da listagem atual que retorna registros incorretos.</p>`,
    acceptanceCriteria: `<ol>
  <li><code>GET /tenant/by-codcli/:codcli</code> retorna o tenant correspondente quando o <code>codcli</code> existe e está ativo, com os dados mínimos para uso no fluxo de push.</li>
  <li>Quando o <code>codcli</code> não existe ou está inválido, retorna <code>404</code> com payload de erro padrão (sem vazar detalhes internos).</li>
  <li>A busca rejeita tenants marcados como inválidos na origem; o critério de validade é documentado e coberto por testes.</li>
  <li>Endpoint autenticado, contrato documentado em Swagger/OpenAPI e testes cobrindo: encontrado, não encontrado e tenant inválido.</li>
</ol>`,
  },
  {
    title: 'Envio manual para tenants selecionados (POST /push/manual/selected-tenants)',
    description: `<p><b>Como</b> portal de gestão de push, <b>eu quero</b> disparar push manual para uma lista de tenants previamente selecionados, <b>para que</b> campanhas pontuais cheguem apenas às empresas escolhidas.</p>
<p><i>Observação: payload e regras de negócio detalhadas serão refinados durante o discovery técnico.</i></p>`,
    acceptanceCriteria: `<ol>
  <li><code>POST /push/manual/selected-tenants</code> aceita payload com lista de <code>codcli</code> e os metadados do push (mensagem, action, agendamento, etc.).</li>
  <li>Antes do disparo, cada <code>codcli</code> é validado via fluxo da US3; tenants inválidos são rejeitados sem interromper os demais e retornados no sumário de resposta.</li>
  <li>Resposta retorna sumário com: total recebido, total disparado, total ignorado/inválido e identificador da execução.</li>
  <li>Endpoint é idempotente para o mesmo identificador de execução (não dispara o mesmo push duplicado em uma janela definida).</li>
  <li>Contrato documentado em Swagger/OpenAPI; testes cobrem: payload válido, lista vazia, <code>codcli</code> inválido e payload mal formado.</li>
</ol>`,
  },
  {
    title: 'Envio manual para todas as empresas (POST /push/manual/all-tenants)',
    description: `<p><b>Como</b> portal de gestão de push, <b>eu quero</b> disparar push manual para todos os tenants válidos, <b>para que</b> campanhas globais sejam executadas com um único comando, sem listas manuais.</p>
<p><i>Observação: payload e regras de negócio detalhadas serão refinados durante o discovery técnico.</i></p>`,
    acceptanceCriteria: `<ol>
  <li><code>POST /push/manual/all-tenants</code> aceita payload com os metadados do push (mensagem, action, agendamento, etc.) e dispara para todos os tenants considerados válidos pelo fluxo da US3.</li>
  <li>Tenants inválidos são automaticamente excluídos do disparo e contabilizados no sumário de resposta, sem interromper o processamento.</li>
  <li>O processamento é feito de forma controlada (em lote/fila) para suportar o volume total de tenants sem indisponibilizar serviços upstream.</li>
  <li>Resposta retorna sumário com: total elegíveis, total disparado, total ignorado/inválido e identificador da execução.</li>
  <li>Endpoint exige autenticação/autorização com permissão específica para envio global e gera log estruturado da execução.</li>
  <li>Contrato documentado em Swagger/OpenAPI; testes cobrem: execução padrão, ausência de tenants elegíveis e falha parcial em tenants inválidos.</li>
</ol>`,
  },
  {
    title: 'Geração de URL temporária para upload de arquivo de lote (POST /push/batch/upload-url)',
    description: `<p><b>Como</b> portal de gestão de push, <b>eu quero</b> solicitar ao backend uma URL temporária para upload do arquivo de lote, <b>para que</b> o front consiga enviar o arquivo diretamente ao storage sem trafegá-lo pela API.</p>`,
    acceptanceCriteria: `<ol>
  <li><code>POST /push/batch/upload-url</code> retorna uma URL temporária assinada (com expiração definida) para upload do arquivo, junto com o identificador da execução.</li>
  <li>A URL é restrita a <code>PUT</code>/upload do arquivo esperado e expira após o tempo configurado, mesmo que não utilizada.</li>
  <li>Resposta inclui o identificador que deve ser usado posteriormente em <code>POST /push/batch/process</code>, garantindo correlação entre upload e processamento.</li>
  <li>Endpoint autenticado, contrato documentado em Swagger/OpenAPI e testes cobrindo: geração padrão, expiração e payload inválido.</li>
</ol>`,
  },
  {
    title: 'Processamento do arquivo de lote e disparo dos pushs (POST /push/batch/process)',
    description: `<p><b>Como</b> portal de gestão de push, <b>eu quero</b> acionar o processamento do arquivo previamente enviado, <b>para que</b> o backend leia os tenants alvo, valide-os e dispare os pushs aos usuários elegíveis.</p>
<p><i>Observação: formato do arquivo, payload e regras de processamento detalhadas serão refinados durante o discovery técnico.</i></p>`,
    acceptanceCriteria: `<ol>
  <li><code>POST /push/batch/process</code> aceita o identificador retornado pela US6 e os metadados do push (mensagem, action, agendamento, etc.).</li>
  <li>O backend baixa o arquivo, valida formato suportado e cabeçalho com a coluna <code>codcli</code>; falhas de download/expiração retornam <code>4xx</code> com mensagem clara, sem disparos parciais não rastreáveis.</li>
  <li>Para cada <code>codcli</code> válido, o tenant é resolvido via fluxo da US3 e o push é disparado aos usuários correspondentes; linhas inválidas são acumuladas e retornadas no sumário sem interromper o processamento.</li>
  <li>O processamento é robusto a arquivos grandes, operando de forma assíncrona/streaming quando aplicável, com filas separadas por responsabilidade.</li>
  <li>O endpoint é idempotente para o mesmo identificador de execução (não dispara push duplicado na mesma janela).</li>
  <li>Resposta retorna sumário com: total de linhas lidas, total disparado, total ignorado/inválido e identificador da execução.</li>
  <li>Contrato documentado em Swagger/OpenAPI; testes cobrem: arquivo válido, cabeçalho ausente/incorreto, <code>codcli</code> inexistente, link expirado e arquivo vazio.</li>
</ol>`,
  },
  {
    title: 'Observabilidade centralizada (logs estruturados e métricas por campanha/tenant/action)',
    description: `<p><b>Como</b> time de operação, <b>eu quero</b> logs centralizados e métricas estruturadas em todo o novo backend de push, <b>para que</b> eu audite disparos, identifique falhas rapidamente e acompanhe volume processado por campanha, tenant e action.</p>`,
    acceptanceCriteria: `<ol>
  <li>Cada execução (manual selecionado, manual global e lote) gera log estruturado com: identificador da execução, totais (recebidos/disparados/ignorados), tempo de processamento e usuário/serviço solicitante.</li>
  <li><code>codcli</code> inválidos ou inexistentes são logados individualmente com o <code>codcli</code> afetado e o motivo (ex.: tenant inativo, não encontrado, fora da política).</li>
  <li>Métricas básicas são expostas no stack de observabilidade existente: contador de execuções, contador de falhas, histograma de duração e contagem de disparos por campanha/tenant/action.</li>
  <li>Logs <b>não</b> vazam PII em nível <code>info</code>; níveis e campos sensíveis seguem a política da plataforma.</li>
  <li>Documento curto (README/wiki) descreve onde acompanhar logs e métricas do novo backend e como correlacionar execuções pelo identificador.</li>
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

  console.log('\n→ Criando Epic...');
  const epic = await createWorkItem(witApi, 'Epic', EPIC_TITLE, EPIC_DESCRIPTION, undefined, undefined);
  created.push(epic);
  console.log(`  ✓ Epic #${epic.id} — ${epic.url}`);

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

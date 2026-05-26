/**
 * Cria o work item Deploy no Azure DevOps para o hotfix do #3002
 * (correção de listagem de holerite para usuários com dois tenants ativos no HD 2.0).
 */

import 'dotenv/config';
import * as azdev from 'azure-devops-node-api';

const ORG_URL = process.env.AZURE_DEVOPS_ORG_URL!;
const PAT = process.env.AZURE_DEVOPS_PAT!;
const PROJECT = 'Wiipo';
const AREA_PATH = 'Wiipo\\SRE';
const ITERATION_PATH = 'Wiipo\\SRE';

const RELATED_CARD_IDS = [3002];

const TITLE =
  '[SRE] Deploy Holerite + 25/05/2026 + Correção de listagem de holerite para usuários com dois tenants ativos no HD 2.0';

const TAGS = 'Deploy Especial';

const DESCRIPTION = `<b>Descrição:</b> Hotfix do wiipo-mobile-backend (versão 4.5.4) corrigindo a falha de listagem do detalhamento do holerite (descontos e proventos) no app para colaboradores com dois tenants/bases ativos após a ativação do HD 2.0. A correção altera a forma como o serviço identifica o cliente (codcli), número da empresa (companyNumber) e código de filial (branchCode): em vez de depender do LSI2 e dos campos retornados pela query de empresa, esses valores passam a ser extraídos diretamente do sk do profile do colaborador (userData.sk), eliminando a ambiguidade quando há mais de um vínculo ativo.

<b>Motivo:</b> Bug reportado em produção (#3002) afetando colaboradores com múltiplos tenants ativos: o app apresentava inconsistências na exibição de descontos e proventos do holerite, principalmente quando um dos vínculos tinha situação 1 ou diferente de 7. A causa raiz é o uso do LSI2 para resolver dados da empresa, que retorna o tenant errado em cenários multi-vínculo. A correção isola a fonte da verdade no sk do profile (que já está corretamente associado ao tenant da requisição) e propaga codcli, companyNumber e branchCode para o getCompanyData no repositório, que passa a montar um sk mais preciso quando os três valores estão disponíveis.

<b>Demanda(s):</b>
<ul>
  <li><a href="https://dev.azure.com/wiipo/Wiipo/_workitems/edit/3002">#3002</a> — [Bug] Falha ao listar detalhamento do usuário com dois tenants ativos no HD 2.0</li>
</ul>

<b>PR(s):</b>
<ul>
  <li><a href="https://github.com/wiipobr/wiipo-mobile-backend/pull/1532">https://github.com/wiipobr/wiipo-mobile-backend/pull/1532</a> — hotfix/wipclb-3002 → master — "hotfix: correcting queries for users with two tenants active" (6 arquivos, +197/-64)</li>
</ul>

<b>Tipo da alteração:</b>
<ul>
  <li>(   ) Melhoria (performance, latência, etc.)</li>
  <li>(   ) Segurança</li>
  <li>✅ Bugfix</li>
  <li>(   ) Nova funcionalidade</li>
</ul>

<b>Funcionalidades que serão alteradas:</b>
<ul>
  <li>get-payslip-details.service.ts — codcli, companyNumber e branchCode passam a ser extraídos do sk do profile do colaborador (userData.sk), em vez de depender do LSI2 e dos campos company_number / branch_code retornados pela query de empresa</li>
  <li>payslip.repository.ts — getCompanyData passa a aceitar codcli, companyNumber e branchCode e, quando os três valores estão disponíveis, monta um sk mais preciso para a consulta da empresa</li>
  <li>get-payslip-details.service.spec.ts — cobertura de teste atualizada com novos cenários cobrindo a extração via userData.sk (+96/-8)</li>
</ul>

<b>Produtos da Wiipo impactados:</b>
<ul>
  <li>(   ) Plataforma</li>
  <li>(   ) Wiipoflex</li>
  <li>(   ) Helpii</li>
  <li>✅ Consignado / Holerite Digital</li>
</ul>

<b>Áreas impactadas:</b>
<ul>
  <li>✅ Operações</li>
  <li>(   ) Marketing</li>
  <li>✅ Produto</li>
</ul>

<b>Impacto negativo potencial:</b> Alteração isolada no fluxo de detalhamento do holerite (PDF de descontos e proventos) do app mobile — risco baixo de regressão fora desse fluxo. A nova lógica depende de o sk do profile estar populado corretamente para todos os colaboradores ativos; profiles legados sem sk podem cair no fallback antigo. O hotfix está alinhado com a arquitetura do HD 2.0 (uma fonte de verdade por tenant via sk) e não afeta clientes que ainda estão na arquitetura antiga. Bump de versão pontual (4.5.3 → 4.5.4) sem outras mudanças carregadas, facilitando rollback caso necessário.

<b>Há urgência para subir as alterações?</b>
<b>Justificativa:</b> Sim. Bug em produção impactando a visualização do detalhamento do holerite para colaboradores com múltiplos tenants ativos após a ativação do HD 2.0. Quanto mais rápido o hotfix subir, menor o impacto para clientes em rollout do HD 2.0.

<b>O código foi testado em staging (sandbox)?</b>
<b>Justificativa:</b> Sim. Cobertura adicionada nos testes unitários do serviço (get-payslip-details.service.spec.ts, +96/-8). Validação manual em sandbox com o time Holerite a ser confirmada antes da janela de deploy.

<b>Há documentação relacionada?</b>
Não se aplica.`;

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

  const patchDocument: any[] = [
    { op: 'add', path: '/fields/System.Title', value: TITLE },
    { op: 'add', path: '/fields/System.Description', value: DESCRIPTION },
    { op: 'add', path: '/fields/System.AreaPath', value: AREA_PATH },
    { op: 'add', path: '/fields/System.IterationPath', value: ITERATION_PATH },
    { op: 'add', path: '/fields/System.Tags', value: TAGS },
  ];

  for (const id of RELATED_CARD_IDS) {
    patchDocument.push({
      op: 'add',
      path: '/relations/-',
      value: {
        rel: 'System.LinkTypes.Related',
        url: `${ORG_URL}/_apis/wit/workItems/${id}`,
      },
    });
  }

  console.log(`Criando work item Deploy com ${RELATED_CARD_IDS.length} link(s) Related...`);

  const workItem = await witApi.createWorkItem(
    null as any,
    patchDocument,
    PROJECT,
    'Deploy'
  );

  if (!workItem?.id) {
    console.error('Falha: API retornou resposta inválida', workItem);
    process.exit(1);
  }

  const deployId = workItem.id;
  const deployUrl =
    workItem._links?.html?.href ||
    `${ORG_URL}/${PROJECT}/_workitems/edit/${deployId}`;

  console.log(`\n✅ Deploy criado com sucesso!`);
  console.log(`   ID:  ${deployId}`);
  console.log(`   URL: ${deployUrl}`);

  return { deployId, deployUrl };
}

main()
  .then(({ deployId, deployUrl }) => {
    console.log(`\nAtualize o .md com:\n  Deploy ID: ${deployId}\n  URL: ${deployUrl}`);
  })
  .catch((err) => {
    console.error('Erro ao criar Deploy:', err?.message || err);
    process.exit(1);
  });

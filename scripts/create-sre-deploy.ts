/**
 * Cria o work item Deploy no Azure DevOps para o chamado SRE do Holerite
 * e adiciona links Related para cada card de origem.
 */

import 'dotenv/config';
import * as azdev from 'azure-devops-node-api';

const ORG_URL = process.env.AZURE_DEVOPS_ORG_URL!;
const PAT = process.env.AZURE_DEVOPS_PAT!;
const PROJECT = 'Wiipo';
const AREA_PATH = 'Wiipo\\SRE';
const ITERATION_PATH = 'Wiipo\\SRE';

const RELATED_CARD_IDS = [38, 39, 41, 43, 58, 59, 65, 67, 1968, 2178];

const TITLE =
  '[SRE] Deploy Holerite + DD/MM/2026 + Múltiplas correções e funcionalidades (backend mobile + Convenix)';

const DESCRIPTION = `<b>Descrição:</b> Deploy de release acumulada do time Holerite cobrindo o backend mobile do SuperApp (versões 4.2.1 → 4.5.1) e o backend Convenix (staging → master). Inclui novas funcionalidades (Data Consent, Google Captcha, verificação de identidade via WAAPI), correções de bugs (visibilidade de cartão benefício, IRPF na nova arquitetura, tracking de eventos) e melhorias de infraestrutura (logs estruturados, regras de IP Senior, soft delete de políticas de consumo).

<b>Motivo:</b> Conjunto de melhorias, bugfixes e novas funcionalidades acumuladas na branch sandbox/staging do time Holerite, prontas para produção conforme validação do time. Todos os cards listados na coluna Deploy do board do time Holerite estão contemplados nestes PRs, conforme confirmado pelo desenvolvedor responsável.

<b>Demanda(s):</b>
<ul>
  <li><a href="https://dev.azure.com/wiipo/Wiipo/_workitems/edit/38">#38</a> — WIPCLB-1488 — PasswordRecovery/SelectTypeCheckAccount (select type)</li>
  <li><a href="https://dev.azure.com/wiipo/Wiipo/_workitems/edit/39">#39</a> — WIPCLB-1487 — RecoverPassword/PasswordConfirmation (confirmation)</li>
  <li><a href="https://dev.azure.com/wiipo/Wiipo/_workitems/edit/41">#41</a> — WIPCLB-1485 — RecoverPassword/FirstStep (start reset)</li>
  <li><a href="https://dev.azure.com/wiipo/Wiipo/_workitems/edit/43">#43</a> — WIPCLB-1483 — UnauthenticatedArea/SignUp (SignUp)</li>
  <li><a href="https://dev.azure.com/wiipo/Wiipo/_workitems/edit/58">#58</a> — WIPCLB-1468 — ContentPayslipResumeInf/index.tsx</li>
  <li><a href="https://dev.azure.com/wiipo/Wiipo/_workitems/edit/59">#59</a> — WIPCLB-1467 — Payslip/index.tsx</li>
  <li><a href="https://dev.azure.com/wiipo/Wiipo/_workitems/edit/65">#65</a> — WIPCLB-1461 — ReportIncomeTax/index.tsx</li>
  <li><a href="https://dev.azure.com/wiipo/Wiipo/_workitems/edit/67">#67</a> — WIPCLB-1326 — Atualização de texto: Push Helpii realizado com sucesso</li>
  <li><a href="https://dev.azure.com/wiipo/Wiipo/_workitems/edit/1968">#1968</a> — Chamadas para a rota /mobile/avatar-photo retornando o erro 403</li>
  <li><a href="https://dev.azure.com/wiipo/Wiipo/_workitems/edit/2178">#2178</a> — Painel ativo em mais de uma empresa (Bug)</li>
</ul>

<b>PR(s):</b>
<ul>
  <li><a href="https://github.com/wiipobr/wiipo-mobile-backend/pull/1517">https://github.com/wiipobr/wiipo-mobile-backend/pull/1517</a> — sandbox → master — "Sanbox -> Master" (66 arquivos, +4929/-707)</li>
  <li><a href="https://github.com/wiipobr/convenix/pull/2217">https://github.com/wiipobr/convenix/pull/2217</a> — staging → master — "Staging -> Master" (11 arquivos, +366/-72)</li>
</ul>

<b>Tipo da alteração:</b>
<ul>
  <li>✅ Melhoria (performance, latência, etc.)</li>
  <li>(   ) Segurança</li>
  <li>✅ Bugfix</li>
  <li>✅ Nova funcionalidade</li>
</ul>

<b>Funcionalidades que serão alteradas:</b>
<ul>
  <li>[4.5.1] Validação de visibilidade do botão de cartão benefício — ajuste na lógica de transferência para usuários com múltiplos contratos no mesmo tenant</li>
  <li>[4.5.0] ab-2777 — Listagem de holerites via DynamoDB retorna codcli por tenant (LSI2); rota GET /payslip/:id aceita query param codcli</li>
  <li>[4.4.1] Regra de seleção de contrato para exibição dos botões de Benefit Card (multi-tenant)</li>
  <li>[4.4.1] WIPCLB-2658 — Serviços de IRPF atualizados para a nova arquitetura Holerite 2.0</li>
  <li>[4.4.0] ab-2659 — Verificação de identidade via WAAPI Access Token no link-account; feature flag ALLOW_LINK_BY_EMAIL</li>
  <li>[4.3.1] Data Consent — POST /consent/data-consent, GET /consent/status, GET /consent/latest-contract + auto-registro no sign-up</li>
  <li>[4.2.2] WIIPO-2004 — Logs estruturados em GetUserContactDataService</li>
  <li>[4.2.1] WIIPO-2551 — Correção de tracking de eventos com dados de crédito/consignado</li>
  <li>[Convenix] Soft delete de Consumption Policy + filtro enabled + endpoints enable/disable</li>
  <li>[Convenix] Export de template de relatório de consumo por e-mail</li>
  <li>[Convenix] Google Captcha — novo serviço GoogleCaptchaService</li>
  <li>[Convenix] Sync de regras de IPs Senior (WiipoOriginAllowMiddleware)</li>
  <li>[Convenix] Inclusão de treasury accounts ativas em queries de usuário</li>
</ul>

<b>Produtos da Wiipo impactados:</b>
<ul>
  <li>✅ Plataforma</li>
  <li>(   ) Wiipoflex</li>
  <li>✅ Helpii</li>
  <li>✅ Consignado / Holerite Digital</li>
</ul>

<b>Áreas impactadas:</b>
<ul>
  <li>✅ Operações</li>
  <li>(   ) Marketing</li>
  <li>✅ Produto</li>
</ul>

<b>Impacto negativo potencial:</b> Deploy de release acumulada com escopo amplo (66 arquivos, +4929/-707 linhas). Risco de regressão em fluxos não cobertos por testes. Data Consent depende de serviço externo — falha pode impactar sign-up. WAAPI Access Token depende da API da plataforma Senior (mitigado pela feature flag ALLOW_LINK_BY_EMAIL). Alterações no WiipoOriginAllowMiddleware do Convenix afetam regras de origem — validar IPs de produção antes de subir.

<b>Há urgência para subir as alterações?</b>
<b>Justificativa:</b> Não. Release acumulada sem incidente ativo em produção.

<b>O código foi testado em staging (sandbox)?</b>
<b>Justificativa:</b> Sim. Cards validados pelo time Holerite antes de mover para a coluna Deploy. wiipo-mobile-backend testado em sandbox; convenix testado em staging.

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

  // Monta o patch document — sem links ainda (adicionamos depois)
  const patchDocument: any[] = [
    { op: 'add', path: '/fields/System.Title', value: TITLE },
    { op: 'add', path: '/fields/System.Description', value: DESCRIPTION },
    { op: 'add', path: '/fields/System.AreaPath', value: AREA_PATH },
    { op: 'add', path: '/fields/System.IterationPath', value: ITERATION_PATH },
  ];

  // Adiciona links Related para cada card de origem
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

  console.log(`Criando work item Deploy com ${RELATED_CARD_IDS.length} links Related...`);

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

  // Retorna os dados para o chamador atualizar o .md
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

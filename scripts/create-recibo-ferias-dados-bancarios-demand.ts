/**
 * Cria a hierarquia Epic → Feature → 1 User Story no Azure DevOps
 * para a demanda "Validação da geração do recibo de férias —
 * dados bancários, data de pagamento e dependentes".
 *
 * Time: Holerite | Sprint: Janela de Junho | Release: 2026 R2
 */

import 'dotenv/config';
import * as azdev from 'azure-devops-node-api';

const ORG_URL = process.env.AZURE_DEVOPS_ORG_URL!;
const PAT = process.env.AZURE_DEVOPS_PAT!;
const PROJECT = 'Wiipo';
const AREA_PATH = 'Wiipo\\Holerite';
const ITERATION_PATH = 'Wiipo\\Holerite\\Janela de Junho';
const RELEASE = '2026 R2';

// ─── Conteúdos ─────────────────────────────────────────────────────────────

const EPIC_TITLE =
  'Recibo de férias do Wiipo apresentando dados bancários, data de pagamento e dependentes zerados/ausentes';

const EPIC_DESCRIPTION = `<p>Foi aberto um chamado relatando que o <b>recibo de férias</b> gerado pelo Wiipo não está exibindo informações que deveriam estar presentes para o colaborador conferir o pagamento:</p>
<ul>
  <li><b>Data de pagamento</b> vazia</li>
  <li><b>Banco</b>, <b>Agência</b> e <b>Conta</b> retornando <code>0</code> (ex.: <code>Banco: 0 -</code>, <code>Agência: 0</code>, <code>Conta: 0-0</code>)</li>
  <li><b>Dados dos dependentes</b> ausentes</li>
</ul>
<p>O cabeçalho identifica corretamente empresa, CNPJ, colaborador, CPF, matrícula, cargo e CBO, e os proventos são apresentados normalmente (Horas Férias Noturnas, 1/3 Férias, Adic. Noturno s/ Férias, Média Variáveis Férias etc.). O problema está restrito ao bloco de <b>dados de pagamento</b> e ao bloco de <b>dependentes</b> do recibo de férias.</p>
<p>A investigação precisa cobrir tanto o <b>holerite antigo</b> quanto o <b>novo (HD 2.0)</b> para entender se o comportamento diverge entre as duas versões, qual é o caminho do dado da origem (HCM Senior) até o recibo, e por que esses campos chegam zerados/vazios na geração do PDF/HTML do recibo de férias — diferentemente do que acontece no recibo de salário do mesmo colaborador.</p>
<p>A entrega desta demanda é a <b>causa raiz identificada</b> + <b>correção aplicada</b> (ou plano de correção, caso a correção dependa de mudança em outro time/origem) para que o recibo de férias volte a apresentar banco, agência, conta, data de pagamento e dependentes corretamente.</p>`;

const FEATURE_TITLE =
  'Investigação e correção dos dados de pagamento e dependentes no recibo de férias (holerite antigo e novo)';

const FEATURE_DESCRIPTION = `<p>Conduzir a investigação ponta a ponta do recibo de férias nos dois fluxos (holerite antigo e novo / HD 2.0), identificar por que os campos <i>Data de pagamento</i>, <i>Banco</i>, <i>Agência</i>, <i>Conta</i> e bloco de <i>Dependentes</i> não são preenchidos no recibo de férias do colaborador do chamado, e aplicar a correção necessária para que esses campos passem a ser exibidos corretamente — comparando com o comportamento do recibo de salário, onde esses dados aparecem normalmente.</p>`;

interface UserStoryDef {
  title: string;
  description: string;
  acceptanceCriteria: string;
}

const USER_STORIES: UserStoryDef[] = [
  {
    title:
      'Investigar e corrigir a ausência de dados bancários, data de pagamento e dependentes no recibo de férias',
    description: `<p><b>Como</b> colaborador que tirou férias, <b>eu quero</b> que o meu recibo de férias mostre corretamente o banco, agência, conta, data de pagamento e meus dependentes, <b>para que</b> eu consiga conferir os dados do pagamento e usar o recibo como comprovante junto a terceiros, da mesma forma que acontece no recibo de salário.</p>
<p><b>Contexto técnico:</b></p>
<ul>
  <li>Chamado relata que no recibo de <b>férias</b> do Wiipo aparecem <code>Banco: 0 -</code>, <code>Agência: 0</code>, <code>Conta: 0-0</code>, <i>Data de pagamento</i> vazia e bloco de <i>Dependentes</i> ausente — enquanto no recibo de <b>salário</b> do mesmo colaborador esses dados aparecem corretamente.</li>
  <li>Demonstrativo do exemplo: competência <code>05/26</code>, empresa <code>ASSOCIACAO HOSP. SAO JOSE DE JGUA DO S</code> (CNPJ <code>12.846.027/0001-89</code>), colaborador <code>MARIANE TELES DE SOUZA</code> (CPF <code>102.099.634-09</code>, matrícula <code>8181</code>, cargo <code>Enfermeiro(a)</code>, CBO <code>223505</code>).</li>
  <li>A investigação precisa cobrir os <b>dois fluxos</b>: holerite <b>antigo</b> e <b>novo (HD 2.0)</b>, identificando se o problema ocorre em ambos ou apenas em um.</li>
  <li>Origem dos dados de banco/agência/conta e dependentes: HCM Senior (confirmar se o campo vem da mesma fonte que alimenta o recibo de salário ou se há rota diferente para férias).</li>
  <li>Comparar o <b>payload de origem</b> (resposta do HCM ou camada intermediária) com o <b>payload usado na geração do recibo de férias</b> para identificar onde o dado se perde (extração, transformação, template).</li>
  <li>Avaliar se o problema é específico da <b>tipologia de holerite</b> (recibo de férias) — ex.: se o template do recibo de férias não mapeia esses campos, mesmo que o dado esteja disponível na origem.</li>
</ul>`,
    acceptanceCriteria: `<ol>
  <li>Está documentado o <b>caminho do dado</b> (banco/agência/conta, data de pagamento e dependentes) da origem (HCM Senior) até a renderização do recibo de férias, com diferenças entre <b>holerite antigo</b> e <b>novo (HD 2.0)</b> apontadas explicitamente.</li>
  <li>Está identificada a <b>causa raiz</b> da ausência desses campos no recibo de férias do colaborador do chamado, com evidência (log, payload, screenshot da etapa onde o dado se perde) — separando: (a) dado <b>ausente na origem</b> vs (b) dado <b>presente na origem mas não mapeado</b> na geração do recibo de férias vs (c) <b>template</b> do recibo de férias não exibindo o campo.</li>
  <li>Está validado se o mesmo problema ocorre <b>somente no recibo de férias</b> ou também em outras tipologias (ex.: 13º, rescisão), e se ocorre <b>somente para esse colaborador/empresa</b> ou de forma generalizada — com amostra de pelo menos 3 colaboradores/recibos de férias diferentes.</li>
  <li>Comparação explícita entre o <b>recibo de salário</b> e o <b>recibo de férias</b> do mesmo colaborador (mesma competência ou competência mais próxima) mostrando onde o comportamento diverge.</li>
  <li>Correção aplicada (no holerite antigo, no novo ou em ambos, conforme onde o defeito estiver) <b>OU</b> plano de correção registrado quando a correção depender de outro time/sistema (ex.: ajuste no HCM, no integrador), com responsável e prazo.</li>
  <li>Após a correção, o recibo de férias do colaborador do chamado passa a exibir corretamente: <i>Data de pagamento</i>, <i>Banco</i>, <i>Agência</i>, <i>Conta</i> e bloco de <i>Dependentes</i> — validado em homologação com pelo menos 1 cliente/colaborador real.</li>
  <li>Regressão validada: o recibo de <b>salário</b> do mesmo colaborador continua apresentando os campos corretamente após a correção (não introduzir regressão nas demais tipologias).</li>
  <li>Resposta ao chamado registrada com a explicação do que estava acontecendo, o que foi corrigido e quando o cliente passa a ver o recibo correto.</li>
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
    { op: 'add', path: '/fields/Custom.SR_ENTREGA', value: 'Não informada' },
    { op: 'add', path: '/fields/Custom.SR_TEM_IMPACTO_LGPD', value: 'Não' },
    { op: 'add', path: '/fields/Custom.SR_RELEASE', value: RELEASE },
  ];

  if (type === 'Epic') {
    patch.push({
      op: 'add',
      path: '/fields/Custom.SR_TIPO_DE_DEMANDA',
      value: 'Sustentação',
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
  const epic = await createWorkItem(
    witApi,
    'Epic',
    EPIC_TITLE,
    EPIC_DESCRIPTION,
    undefined,
    undefined
  );
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

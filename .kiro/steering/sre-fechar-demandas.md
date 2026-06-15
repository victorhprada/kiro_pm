---
inclusion: manual
---

# Fechar demandas vinculadas a Deploys encerrados (SRE)

Quando o usuário pedir para **fechar/encerrar as demandas dos deploys que já subiram** (ex.: "vê o que tá Closed no SRE e fecha os cards vinculados"), siga este fluxo. O objetivo é manter os boards das squads sincronizados com a realidade: todo Deploy do SRE que foi concluído (`Closed`) carrega, via vínculo `Related`, as US/BUGs que efetivamente foram a produção — e esses cards precisam ser movidos para `Closed` nos boards de origem.

> Complementa `sre-demanda.md` (criação do chamado de Deploy). Aqui o foco é o **pós-deploy**: encerrar o que já subiu.

## Visão geral do fluxo

1. Listar os work items `Deploy` em `Wiipo\SRE` que estão **`Closed`** (deploys concluídos).
2. Para cada Deploy, ler as **relations `System.LinkTypes.Related`** → são as demandas (US/BUG) contempladas.
3. Hidratar cada demanda vinculada (tipo, estado atual, board, título, tags).
4. **Apresentar o plano** (quais cards vão de qual estado → `Closed`) e pedir confirmação.
5. Após aprovação, mover cada demanda ainda aberta para **`Closed`** e **garantir a tag de contabilização** `deploy-{MÊS}-2026` (ver seção própria).
6. Relatar o resultado (movidos / já fechados / falhas) e atualizar o `.md` local do deploy quando existir.

> ⚠️ **Mudar estado de card afeta o board de outra squad.** É uma ação de impacto compartilhado: **sempre listar primeiro e confirmar com o usuário antes de aplicar**. Suportar modo `--dry-run` (só lista, não altera). Nunca fechar em lote sem o aval explícito.

## Tag obrigatória de contabilização (recomendação de QA)

Para o QA contabilizar **quantas tasks foram entregues em cada deploy**, toda demanda que foi a produção precisa carregar uma tag no padrão:

```
deploy-{MÊS}-2026
```

- Aplica-se a **todas as entregas** que foram a produção — tanto **User Story** quanto **Bug**.
- `{MÊS}` é o nome do mês **em português, caixa alta**, sem ano repetido fora do sufixo. Ex.: `deploy-MAIO-2026`, `deploy-JUNHO-2026`.
- O mês é o **mês do Deploy que levou o card a produção** (não o mês em que o card está sendo fechado). Um card entregue num deploy de maio recebe `deploy-MAIO-2026` mesmo que só seja encerrado em junho. Derive o mês a partir da data do Deploy (data no título, ex.: `+ 19/05/2026 +`, ou, na ausência, do `System.ChangedDate` do Deploy).
- Nomes de mês: `JANEIRO`, `FEVEREIRO`, `MARÇO`, `ABRIL`, `MAIO`, `JUNHO`, `JULHO`, `AGOSTO`, `SETEMBRO`, `OUTUBRO`, `NOVEMBRO`, `DEZEMBRO`.

Por isso, ao fechar uma demanda neste fluxo (passo 5), **garanta também a tag de contabilização**: se ela ainda não existir no card, adicione — sempre **preservando** as tags já presentes. A tag é aplicada na **demanda (US/BUG)**, não só no card de Deploy.

## 1. Identificar os Deploys encerrados no SRE

Critério padrão: `System.WorkItemType = 'Deploy'`, `System.AreaPath UNDER 'Wiipo\SRE'`, `System.State = 'Closed'`.

```typescript
const wiql = {
  query: `
    SELECT [System.Id]
    FROM WorkItems
    WHERE [System.TeamProject] = 'Wiipo'
      AND [System.WorkItemType] = 'Deploy'
      AND [System.AreaPath] UNDER 'Wiipo\\SRE'
      AND [System.State] = 'Closed'
    ORDER BY [System.ChangedDate] DESC
  `,
};
```

Refinamentos comuns (perguntar/aceitar do usuário quando fizer sentido):
- **Janela de tempo**: limitar por `System.ChangedDate >= 'AAAA-MM-DDT00:00:00Z'` para pegar só os deploys fechados recentemente (ex.: "os do último deploy", "os de junho"). Sem janela, o WIQL traz todos os Deploys `Closed` históricos — quase sempre você quer filtrar.
- **Deploy específico**: se o usuário passar um ou mais IDs de Deploy, pular o WIQL e ir direto para o passo 2 com esses IDs.
- **Coluna do board**: alguns boards usam `System.BoardColumn = 'Closed'`/`'Done'` em vez do estado. Se o filtro por `State = 'Closed'` vier vazio mas o usuário afirmar que há deploys concluídos, tentar por `System.BoardColumn`. Na dúvida sobre o critério de "encerrado", **perguntar uma vez**.

## 2. Ler as demandas vinculadas (relations `Related`)

O Deploy não é pai das demandas — o vínculo é **`System.LinkTypes.Related`** (ver `sre-demanda.md`, seção 5). Buscar o work item com expand de Relations (`4`) e filtrar:

```typescript
import * as azdev from 'azure-devops-node-api';

const wi = await witApi.getWorkItem(deployId, undefined, undefined, 4 /* Relations */ as any);

const relatedIds = (wi.relations || [])
  .filter((r: any) => r.rel === 'System.LinkTypes.Related')
  .map((r: any) => {
    const m = (r.url || '').match(/workItems\/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  })
  .filter((id): id is number => typeof id === 'number');
```

- Deduplicar IDs (um mesmo card pode aparecer em mais de um Deploy).
- Ignorar relations que apontem para outro `Deploy` ou para work items fora do escopo de squad (raro, mas validar o tipo no passo 3 antes de fechar).

## 3. Hidratar as demandas vinculadas

```typescript
const demandas = await witApi.getWorkItems(
  relatedIds,
  [
    'System.Id',
    'System.WorkItemType',
    'System.Title',
    'System.State',
    'System.BoardColumn',
    'System.AreaPath',
    'System.Tags',
  ],
  undefined,
  undefined as any
);
```

Para cada demanda, classificar:
- **Já encerrada** (`State` em `Closed`, `Removed`, `Dropped`, `Resolved`) → não mexer, só reportar como "já fechada".
- **Aberta** (qualquer outro estado: `New`, `Active`, `Ready`, `Review`, `Test`) → candidata a fechar.
- **Não é US/BUG** (ex.: aponta para Feature/Epic/Deploy) → **não fechar**; listar à parte para o usuário decidir.

## 4. Apresentar o plano e confirmar

Antes de qualquer alteração, mostrar uma tabela clara agrupada por Deploy:

```
Deploy #3024 (Closed) — [SRE] Deploy Holerite + 25/05/2026 + ...
  #3002  [Bug]         Test    → Closed
  #2990  [User Story]  Review  → Closed
  #2980  [User Story]  Closed  (já fechada — sem ação)

Deploy #3050 (Closed) — [SRE] Deploy Plataforma + ...
  #3041  [Bug]         Active  → Closed
```

Resumo no fim: `X cards serão fechados, Y já estão fechados, Z ignorados (tipo não-demanda)`.

Perguntar: **"Confirma fechar esses N cards? (ou rode em --dry-run)"**. Só seguir com aval explícito.

## 5. Mover as demandas para `Closed` (e aplicar a tag)

Estados de destino válidos por tipo (ver `azure-devops-campos.md`): tanto **User Story** quanto **Bug** aceitam `Closed`. Use `Closed` como destino padrão.

No mesmo `updateWorkItem`, garanta a tag de contabilização `deploy-{MÊS}-2026`. `System.Tags` é uma string separada por `; ` — para **preservar** as tags existentes, leia as atuais, acrescente a nova só se ainda não estiver presente (case-insensitive) e regrave a lista completa.

> ⚠️ **O processo do projeto Wiipo não permite salto direto para `Closed`.** A API rejeita transições "puladas" com o erro `The field 'State' contains the value 'X' that is not in the list of supported values`. Os estados formam uma **cadeia** e só é possível avançar **um passo por vez**:
>
> `New ↔ Ready ↔ Active ↔ Review ↔ Test ↔ Resolved ↔ Closed`
>
> Ou seja, um card em `Test` fecha via `Test → Resolved → Closed`; um card em `Ready` via `Ready → Active → Review → Test → Resolved → Closed`. `Resolved` só é alcançável a partir de `Test`. O runner deve **caminhar pela cadeia** (cada passo é um `updateWorkItem` de `System.State`) até chegar em `Closed`, aplicando a tag no patch que efetiva o `Closed`. Para descobrir/validar as transições do processo, use `scripts/introspect-state-transitions.ts`.

```typescript
const MESES = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];

// mês derivado do Deploy que entregou o card (data do título ou ChangedDate)
const deployTag = `deploy-${MESES[deployMonthIndex]}-${deployYear}`;

const existing = (demanda.tags || '')
  .split(';')
  .map((t) => t.trim())
  .filter(Boolean);

const hasTag = existing.some((t) => t.toLowerCase() === deployTag.toLowerCase());
const tagsValue = (hasTag ? existing : [...existing, deployTag]).join('; ');

// Caminha pela cadeia de estados até Closed (um passo por vez), priorizando
// o avanço; aplica a tag junto ao passo que efetiva o Closed.
const PRIORITY = ['Resolved', 'Closed', 'Test', 'Review', 'New', 'Ready', 'Active'];
let current = (await witApi.getWorkItem(demandaId, ['System.State'])).fields['System.State'];
const pathTaken = [current];
for (let step = 0; step < 10 && current !== 'Closed'; step++) {
  for (const cand of PRIORITY) {
    if (cand === current) continue;
    if (pathTaken.length >= 2 && cand === pathTaken[pathTaken.length - 2]) continue; // evita ping-pong
    const ops = [{ op: 'add', path: '/fields/System.State', value: cand }];
    if (cand === 'Closed') ops.push({ op: 'add', path: '/fields/System.Tags', value: tagsValue });
    try {
      await witApi.updateWorkItem(null as any, ops, demandaId, 'Wiipo');
      current = cand; pathTaken.push(current); break;
    } catch { /* tenta o próximo candidato */ }
  }
}
```

Regras:
- Atualizar **uma demanda por vez**, capturando sucesso/falha individual (não abortar o lote inteiro numa falha pontual).
- **Avançar pela cadeia de estados** — nunca tentar `Closed` direto e desistir; caminhe `... → Resolved → Closed`. Registre o caminho percorrido no log (ex.: `Test → Resolved → Closed`).
- **Tag de contabilização obrigatória** — toda US/BUG que vai a produção recebe `deploy-{MÊS}-2026` (ver seção "Tag obrigatória de contabilização"). Aplique no fechamento **preservando** as tags já existentes; nunca sobrescreva nem remova tags. Se a tag já existir, não duplique.
- O `{MÊS}` vem do **Deploy** que levou o card a produção, não do mês corrente do fechamento.
- Se mesmo caminhando pela cadeia a demanda não chegar a `Closed` (algum passo rejeitado por campo obrigatório ou regra), reportar onde parou e o caminho tentado — **não inventar** valores para forçar o fechamento.
- **Nunca** usar `Removed`/`Dropped` no lugar de `Closed` — esses estados têm semântica diferente (cancelado/descartado), não "entregue".

## 6. Relatar e atualizar os `.md` locais

- Imprimir o resultado final: `N movidos para Closed, M já fechados, K falhas` (listando os IDs de cada grupo) e, para cada card fechado, qual tag `deploy-{MÊS}-2026` foi aplicada (ou já existia).
- Gravar um **log de fechamento por time** em `demandas/sre/fechamentos/{time}/log-fechamento-demandas.md` (ex.: `demandas/sre/fechamentos/plataforma/log-fechamento-demandas.md`). Cada execução do `--apply` anexa uma seção datada (`## Execução DD/MM/AAAA HH:MM`) com a tabela `ID | Tipo | Título | De (estado / coluna) | Para | Tag | Resultado`. A pasta do time é criada automaticamente se não existir; o arquivo acumula o histórico, não sobrescreve.
- Para cada Deploy processado que tenha um `.md` em `demandas/sre/{time}/`, atualizar a seção **Demanda(s) relacionada(s)** indicando que os cards foram encerrados (ex.: anexar `(Closed em DD/MM/AAAA)` ao item) e, se fizer sentido, registrar na **Metadata** que o pós-deploy foi concluído. O `.md` continua sendo a fonte de verdade local.
- Não criar `.md` novo para este fluxo — ele opera sobre deploys e demandas já existentes.

## Script de referência

Reaproveitar a infra existente:
- `src/infrastructure/azure-devops-client.ts` — conexão, retry e `getWorkItems`/comentários.
- Padrão de `getWorkItem(id, …, 4)` + filtro de relations: `scripts/dump-deploy-details.ts`.
- Padrão de `updateWorkItem` com JSON Patch e modo `--dry-run`: `scripts/move-plataforma-to-junho.ts`.
- WIQL por tipo/área no SRE: `scripts/query-sre-deploys-abril-maio.ts`.

Se o usuário pedir um runner dedicado, criar em `scripts/` (ex.: `scripts/close-demandas-de-deploys-fechados.ts`) seguindo esses padrões, sempre com:
1. `--dry-run` por padrão exibindo o plano da seção 4.
2. Flag explícita (ex.: `--apply`) para efetivar as mudanças do passo 5.
3. Carregamento de credenciais via `dotenv/config` (`AZURE_DEVOPS_ORG_URL`, `AZURE_DEVOPS_PAT`).

## Regras gerais

- **Listar e confirmar antes de alterar.** Fechar card é ação de impacto no board de outra squad.
- **Só fechar US e BUG** vinculados via `Related` a um Deploy `Closed`. Nunca fechar Feature/Epic/Deploy por este fluxo.
- **Nunca inventar** IDs, vínculos ou justificativas. Se um Deploy não tiver relations, reportar como "sem demandas vinculadas" — não adivinhar.
- **Preservar dados existentes** (tags pré-existentes, iteration, descrição). Este fluxo altera `System.State` e **acrescenta** a tag `deploy-{MÊS}-2026` ao `System.Tags` — sem remover ou sobrescrever as tags que já existem.
- Tom: profissional e técnico; sempre deixar claro o que foi alterado e o que ficou de fora.

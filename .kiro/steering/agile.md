---
inclusion: manual
---

# Agile — Higiene de board de Plataforma e Holerite

Fluxo de organização ágil dos boards das squads **Plataforma** e **Holerite** no Azure DevOps (projeto `Wiipo`). O objetivo é manter os boards sincronizados com a realidade ao fim de cada ciclo/deploy: encerrar o que já subiu a produção e cuidar do que **continua em andamento**, para nada ficar “perdido” numa sprint vencida.

Este agente cobre **dois fluxos complementares**, que normalmente rodam em sequência:

- **Fluxo A — Pós-deploy (fechar o que subiu):** todo Deploy do SRE concluído (`Closed`) carrega, via vínculo `Related`, as US/BUG que efetivamente foram a produção. Esses cards precisam ir para `Closed` nos boards de origem, com a tag de contabilização.
- **Fluxo B — Higiene de sprint (carregar o que ficou):** os cards que **continuam ativos / em andamento** (não foram fechados pelo Fluxo A) devem ser movidos para a **última sprint criada** do time. Se essa sprint ainda não existir, o agente **não move** — apenas **avisa que a sprint precisa ser criada**.

> Escopo deste agente: squads **Plataforma** (`Wiipo\Plataforma`) e **Holerite** (`Wiipo\Holerite`). Os Deploys são lidos de `Wiipo\SRE`, mas só fechamos/movemos US/BUG que pertencem a esses dois boards. Cards de outros times são listados à parte e nunca alterados.

> ⚠️ **Toda alteração de estado ou de sprint afeta o board de uma squad.** É ação de impacto compartilhado: **sempre listar primeiro e confirmar com o usuário antes de aplicar**. Suportar `--dry-run` (só lista, não altera) em ambos os fluxos. Nunca alterar em lote sem aval explícito.

## Ordem de execução recomendada

1. **Fluxo A** primeiro: fechar as US/BUG vinculadas a Deploys `Closed` (passos A1–A6 abaixo).
2. **Fluxo B** depois: das demandas que **continuaram abertas/em andamento** (não foram fechadas pelo Fluxo A, seja por não estarem vinculadas a um deploy fechado, seja por ainda estarem em desenvolvimento), validar a sprint de destino e carregá-las para a **última sprint criada** do time (passos B1–B5). Em seguida, **avaliar a Feature e o Epic pais** de cada card movido e decidir se eles também devem acompanhar a sprint (passo B6 — pai nunca move em silêncio).
3. Relatar o resultado consolidado e atualizar os `.md` locais.

Cada fluxo pode rodar isolado se o usuário pedir (ex.: “só fecha o que subiu” = Fluxo A; “organiza a sprint do board” = Fluxo B).

---

# Fluxo A — Pós-deploy: fechar demandas de Deploys encerrados

Mantém o comportamento de sempre: Deploy do SRE `Closed` → fecha as US/BUG vinculadas via `Related`, aplicando a tag de contabilização.

## A1. Identificar os Deploys encerrados no SRE

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
- **Deploy específico**: se o usuário passar um ou mais IDs de Deploy, pular o WIQL e ir direto para o passo A2 com esses IDs.
- **Coluna do board**: alguns boards usam `System.BoardColumn = 'Closed'`/`'Done'` em vez do estado. Se o filtro por `State = 'Closed'` vier vazio mas o usuário afirmar que há deploys concluídos, tentar por `System.BoardColumn`. Na dúvida sobre o critério de "encerrado", **perguntar uma vez**.

## A2. Ler as demandas vinculadas (relations `Related`)

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
- Ignorar relations que apontem para outro `Deploy` ou para work items fora do escopo de squad (raro, mas validar o tipo no passo A3 antes de fechar).

## A3. Hidratar as demandas vinculadas

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
    'System.IterationPath',
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
- **Fora do escopo (outro time)** — `AreaPath` não está sob `Wiipo\Plataforma` nem `Wiipo\Holerite` → **não fechar**; listar à parte.

> Guarde o `System.IterationPath` e o estado de cada demanda **aberta** que sobrar — elas alimentam o Fluxo B (higiene de sprint).

## A4. Apresentar o plano e confirmar

Antes de qualquer alteração, mostrar uma tabela clara agrupada por Deploy:

```
Deploy #3024 (Closed) — [SRE] Deploy Holerite + 25/05/2026 + ...
  #3002  [Bug]         Test    → Closed   [Holerite]
  #2990  [User Story]  Review  → Closed   [Holerite]
  #2980  [User Story]  Closed  (já fechada — sem ação)

Deploy #3050 (Closed) — [SRE] Deploy Plataforma + ...
  #3041  [Bug]         Active  → Closed   [Plataforma]
```

Resumo no fim: `X cards serão fechados, Y já estão fechados, Z ignorados (tipo não-demanda / outro time)`.

Perguntar: **"Confirma fechar esses N cards? (ou rode em --dry-run)"**. Só seguir com aval explícito.

## A5. Mover as demandas para `Closed` (e aplicar a tag)

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

## A6. Tag obrigatória de contabilização (recomendação de QA)

Para o QA contabilizar **quantas tasks foram entregues em cada deploy**, toda demanda que foi a produção precisa carregar uma tag no padrão:

```
deploy-{MÊS}-2026
```

- Aplica-se a **todas as entregas** que foram a produção — tanto **User Story** quanto **Bug**.
- `{MÊS}` é o nome do mês **em português, caixa alta**, sem ano repetido fora do sufixo. Ex.: `deploy-MAIO-2026`, `deploy-JUNHO-2026`.
- O mês é o **mês do Deploy que levou o card a produção** (não o mês em que o card está sendo fechado). Um card entregue num deploy de maio recebe `deploy-MAIO-2026` mesmo que só seja encerrado em junho. Derive o mês a partir da data do Deploy (data no título, ex.: `+ 19/05/2026 +`, ou, na ausência, do `System.ChangedDate` do Deploy).
- Nomes de mês: `JANEIRO`, `FEVEREIRO`, `MARÇO`, `ABRIL`, `MAIO`, `JUNHO`, `JULHO`, `AGOSTO`, `SETEMBRO`, `OUTUBRO`, `NOVEMBRO`, `DEZEMBRO`.

Ao fechar uma demanda neste fluxo (passo A5), **garanta também a tag de contabilização**: se ela ainda não existir no card, adicione — sempre **preservando** as tags já presentes. A tag é aplicada na **demanda (US/BUG)**, não no card de Deploy.

---

# Fluxo B — Higiene de sprint: carregar o que ficou em andamento

Depois de fechar o que subiu (Fluxo A), sobram cards que **continuam em andamento** nos boards de Plataforma e Holerite — porque ainda estão em desenvolvimento, em review, em teste, ou simplesmente não foram entregues no ciclo. Esses cards **não podem ficar parados numa sprint vencida**: devem ser carregados para a **última sprint criada** do time.

A regra-mãe deste fluxo: **só move se a sprint de destino existir.** Se a última sprint criada do time ainda não foi criada (ou já terminou e não há uma nova), **não mover** — avisar o usuário que precisa criar a sprint primeiro.

## B1. Levantar os cards "em andamento" por time

Para cada time (`Plataforma`, `Holerite`), buscar as US/BUG que **não estão encerradas**. "Em andamento" = qualquer estado fora de `Closed`/`Removed`/`Resolved`/`Dropped` (inclui `New`, `Ready`, `Active`, `Review`, `Test` — ou seja, tudo que ainda “vive” no board).

```typescript
const wiql = (areaPath: string) => ({
  query: `
    SELECT [System.Id]
    FROM WorkItems
    WHERE [System.TeamProject] = 'Wiipo'
      AND [System.AreaPath] UNDER '${areaPath}'
      AND [System.WorkItemType] IN ('User Story', 'Bug')
      AND [System.State] NOT IN ('Closed', 'Removed', 'Resolved', 'Dropped')
    ORDER BY [System.IterationPath], [System.State], [System.Id]
  `,
});
```

- Rodar uma vez por time (`Wiipo\Plataforma` e `Wiipo\Holerite`).
- Hidratar com `System.IterationPath`, `System.State`, `System.BoardColumn`, `System.Title`, `System.Tags`, `System.AssignedTo`.
- **Excluir do conjunto** os cards que o Fluxo A acabou de fechar (já estão `Closed`). O foco do Fluxo B é exatamente o que **ficou aberto**.

> Refinamento comum: o usuário pode querer mover só os cards de uma sprint específica (ex.: "carrega o que ficou da Sprint - Maio"). Nesse caso, adicionar `AND [System.IterationPath] = 'Wiipo\\{Time}\\Sprint - Maio'` ao WIQL. Sem isso, considere todos os cards em andamento do board (que tipicamente estão em sprints anteriores à atual).

## B2. Descobrir e validar a "última sprint criada" do time

A sprint de destino é a **última sprint criada** atribuída ao time. Use a Work API para listar as iterations do time e escolher a mais recente.

```typescript
const workApi = await connection.getWorkApi();
const teamContext = { projectId: 'Wiipo', teamId: TEAM }; // TEAM = 'Plataforma' | 'Holerite'
const iterations = await workApi.getTeamIterations(teamContext);

// "Última sprint criada" = a de maior data de início (finishDate como desempate).
// Considerar apenas sprints reais (path contém '\\Sprint').
const sprints = iterations
  .filter((i) => /\\Sprint/i.test(i.path || ''))
  .map((i) => ({
    id: i.id,
    path: i.path,
    name: i.name,
    start: i.attributes?.startDate ? new Date(i.attributes.startDate) : null,
    finish: i.attributes?.finishDate ? new Date(i.attributes.finishDate) : null,
  }))
  .sort((a, b) => {
    const sa = a.start?.getTime() ?? 0;
    const sb = b.start?.getTime() ?? 0;
    return sb - sa; // mais recente primeiro
  });

const targetSprint = sprints[0] ?? null;
```

**Validação obrigatória (regra-mãe do Fluxo B):**

1. **Não existe sprint** (`targetSprint == null`, nenhuma iteration de sprint atribuída ao time) → **não mover nada**. Avisar:
   > ⚠️ O time **{Time}** não tem nenhuma sprint criada/atribuída. Crie a próxima sprint em *Project Settings → Team Configuration → Iterations* e rode novamente. Nenhum card foi movido.
2. **A última sprint já terminou** (`finishDate` é anterior a hoje — compare por data, o **último dia ainda conta como sprint vigente**) e o usuário esperava uma sprint vigente → tratar como "**sprint não criada**" para o ciclo atual. Avisar que a **próxima** sprint precisa ser criada antes de carregar os cards (não empurrar trabalho para uma sprint vencida). Em caso de dúvida, **perguntar uma vez** se deve usar mesmo assim a última sprint existente.
3. **Sprint válida encontrada** → seguir para o passo B3 usando `targetSprint.path` como destino.

> Útil: `getTeamIterations(teamContext, 'current')` retorna a sprint marcada como atual (timeframe `current`). Se vier vazia, é um forte sinal de que **não há sprint vigente** — reforça o aviso do item 2.

Não criar a sprint automaticamente — criação de iteration é configuração de processo do time. Este fluxo apenas **avisa**.

## B3. Apresentar o plano de movimentação e confirmar

Mostrar, por time, os cards em andamento e para qual sprint vão (e os que já estão na sprint de destino, que ficam parados):

```
Higiene de sprint — Plataforma  (destino: Wiipo\Plataforma\Sprint - Junho)
  #2901  [User Story]  Active   Sprint - Maio   → Sprint - Junho
  #2912  [Bug]         Review   Sprint - Maio   → Sprint - Junho
  #2930  [User Story]  Active   Sprint - Junho  (já na sprint de destino — sem ação)

Higiene de sprint — Holerite  (destino: Wiipo\Holerite\Janela de Junho)
  #3110  [Bug]         Test     Janela de Maio  → Janela de Junho
```

Resumo: `X cards serão movidos para a última sprint, Y já estão nela`. Se algum time caiu no aviso do B2, deixar claro: `Holerite: sprint de destino não criada — 0 movidos, ação necessária: criar a sprint`.

Perguntar: **"Confirma mover esses N cards para a última sprint? (ou rode em --dry-run)"**. Só seguir com aval explícito.

## B4. Mover os cards para a última sprint

Movimentação é simples — só altera o `System.IterationPath`. **Não** mexe no estado nem nas tags do card.

```typescript
const patch = [
  { op: 'add', path: '/fields/System.IterationPath', value: targetSprint.path },
];
await witApi.updateWorkItem(null as any, patch, cardId, 'Wiipo');
```

Regras:
- **Uma demanda por vez**, capturando sucesso/falha individual (não abortar o lote numa falha pontual).
- **Só mexer no `IterationPath`.** Nunca alterar `System.State`, `System.Tags` ou qualquer outro campo neste fluxo — carregar de sprint não é fechar nem reclassificar.
- Cards que **já estão na sprint de destino** não recebem update.
- Se a sprint de destino não passou na validação do B2, **pular o time inteiro** e reportar a ação necessária (criar a sprint). Nunca mover para uma sprint vencida sem aval explícito.
- Preservar todo o resto: assignee, descrição, board column.

## B5. (Opcional) Cards sem nenhuma sprint

Se houver cards em andamento **sem `IterationPath`** de sprint (ex.: caídos no backlog raiz `Wiipo\{Time}`), tratá-los igual aos demais: candidatos a ir para a última sprint criada. Apenas sinalizar na tabela do B3 que a origem era o backlog, para o usuário confirmar.

## B6. Avaliar a Feature e o Épico pais dos cards movidos

Mover uma US/BUG de sprint pode deixar o **pai** (Feature) e o **avô** (Epic) desalinhados com onde o trabalho realmente está. Por isso, sempre que o Fluxo B mover cards, **suba a hierarquia** de cada card e decida — com **critério conservador** — se o pai também deve ir para a sprint de destino.

> Hierarquia no Wiipo: `Bug / User Story → Feature → Epic` (via `System.Parent`, link `System.LinkTypes.Hierarchy-Reverse`). Na prática há **variações**: uma User Story pode pendurar **direto num Epic** (sem Feature), e um Bug pode pendurar numa User Story. Por isso, **suba a cadeia genericamente** classificando cada ancestral pelo `System.WorkItemType`, em vez de assumir que o pai direto é sempre uma Feature.
>
> ⚠️ **Feature e Epic raramente devem ser movidos automaticamente.** Eles costumam atravessar vários ciclos (ficam fixados num release/raiz de área de propósito). Mexer no `IterationPath` de um pai afeta relatórios de roadmap/planejamento muito além de uma sprint. Por isso, o default é **listar e sugerir** — **nunca** mover pai no mesmo lote silencioso das US/BUG.

### Como subir a hierarquia

Para cada card movido (ou candidato a mover), suba pela cadeia de `System.Parent`, classificando cada ancestral pelo tipo: ao encontrar uma **Feature**, avalie-a; ao encontrar um **Epic**, registre-o; ancestrais intermediários que sejam US/BUG (ex.: um bug pendurado numa User Story) apenas repassam para o pai seguinte. Deduplique ancestrais (vários cards compartilham a mesma Feature/Epic) e limite a profundidade (ex.: 6 níveis) para não entrar em loop.

```typescript
// Sobe genericamente: classifica cada ancestral por System.WorkItemType.
async function climb(startParentId: number) {
  let pid: any = startParentId;
  for (let guard = 0; typeof pid === 'number' && guard < 6; guard++) {
    if (visited.has(pid)) break;
    visited.add(pid);
    const wi = await witApi.getWorkItem(pid, undefined, undefined, 4 /* Relations */);
    const f = wi.fields || {};
    const type = f['System.WorkItemType'];
    if (type === 'Feature') featureMap.set(pid, { fields: f, relations: wi.relations || [] });
    else if (type === 'Epic') epicMap.set(pid, f);
    // US/BUG intermediário (ex.: bug sob US) apenas repassa para o pai
    pid = f['System.Parent'];
  }
}

// 1) Para cada US/BUG movido, pega o Parent e sobe a cadeia
for (const card of movedCards) {
  const wi = await witApi.getWorkItem(card.id, ['System.Parent']);
  const parent = wi.fields?.['System.Parent'];
  if (typeof parent === 'number') await climb(parent);
}

// 2) Para contar filhos abertos de uma Feature, use as relations Hierarchy-Forward
//    já trazidas no expand (4) e hidrate o estado/iteration de cada filho.
```

### Critério de decisão (por pai)

Avalie **Feature** e **Epic** separadamente. Em todos os casos, só é candidato a mover quem estiver **em andamento** (estado fora de `Closed`/`Removed`/`Resolved`/`Dropped`).

**Feature:**
- **Não mover** se o `IterationPath` dela **não for um caminho de sprint** (está fixada num release / raiz de área de propósito — Features costumam abranger várias sprints).
- **Candidata a mover** só quando (todas as condições): (a) está num caminho de sprint mais antigo que a sprint de destino, **e** (b) **todos os seus filhos ainda abertos** estão indo (ou já estão) na sprint de destino — ou seja, não sobra trabalho aberto da Feature em outra sprint/backlog.
- Se a Feature ainda tem **filhos abertos em outra sprint ou no backlog** → **não mover**; ela continua viva em mais de um ciclo. Listar como "permanece (tem filhos abertos fora da sprint destino)".

**Epic:**
- Default: **não mover**, apenas listar com o estado/iteration atual. Epics vivem acima do nível de sprint. Só considerar mover com **confirmação explícita** do usuário, e somente se **todas** as Features filhas em andamento já estiverem na sprint de destino.

### Apresentar e confirmar (pai nunca move em silêncio)

Liste os pais num bloco separado do plano (seção B3), com a **ação sugerida** e o **motivo**:

```
Pais afetados — Plataforma  (sprint destino: Sprint - Julho)
  Feature #2956  Active   Sprint - Junho   → sugerido MOVER   (todos os 2 filhos abertos vão p/ Sprint - Julho)
  Feature #2810  Active   Release 2026 R2  → permanece        (iteration não é sprint)
  Feature #2733  Active   Sprint - Junho   → permanece        (ainda tem 1 filho aberto na Sprint - Junho)
  Epic    #2731  Active   Plataforma\\...   → permanece        (Epic — mover só sob confirmação)
```

- **Mover pai é opt-in.** No runner, exigir uma flag explícita (ex.: `--mover-pais`) **além** do `--apply`. Sem a flag, os pais só são listados/sugeridos, nunca alterados.
- Pedir confirmação dedicada: **"Confirma mover também as N Features sugeridas? (Epics ficam de fora salvo confirmação à parte)"**.
- A movimentação do pai segue a regra do B4: altera **apenas** o `System.IterationPath`, nunca estado nem tags.
- Se o usuário não confirmar, manter os pais como estão e registrar no log que foram **avaliados e mantidos**.

---

# Relatar e atualizar os `.md` locais

Ao final de cada execução (o log de higiene do Fluxo B é gerado também em `--dry-run`, como preview; os demais efeitos abaixo valem após `--apply`):

- **Resultado consolidado** no console:
  - Fluxo A: `N fechados para Closed, M já fechados, K falhas` (listando IDs) e, para cada card fechado, qual tag `deploy-{MÊS}-2026` foi aplicada (ou já existia).
  - Fluxo B: `P cards movidos para a última sprint, Q já na sprint, R times sem sprint de destino (ação: criar sprint)`. Quando os pais forem avaliados, acrescentar `S Feature(s) movida(s), T mantida(s), U Epic(s) avaliado(s)`.
- **Log de fechamento por time** (Fluxo A) em `demandas/sre/fechamentos/{time}/log-fechamento-demandas.md`. Cada execução do `--apply` anexa uma seção datada (`## Execução DD/MM/AAAA HH:MM`) com a tabela `ID | Tipo | Título | De (estado / coluna) | Para | Tag | Resultado`. A pasta do time é criada automaticamente; o arquivo acumula histórico, não sobrescreve.
- **Log de higiene de sprint por time** (Fluxo B) em `demandas/sre/fechamentos/{time}/log-higiene-sprint.md`. **Gerado tanto no dry-run (como `PREVIEW`, para validar antes de confirmar) quanto no `--apply` (registrando o que foi efetivado)** — cada execução anexa uma seção datada. Cada seção traz: (a) as **regras aplicadas** (como os cards foram selecionados, como a sprint de destino é escolhida/validada e os critérios de Feature/Epic); (b) a tabela de cards `ID | Tipo | Estado | Sprint origem | Sprint destino | Motivo | Resultado`; (c) a tabela de pais `ID | Tipo | Estado | Iteration atual | Decisão | Motivo`. Incluir as Features/Epics avaliadas (movidas ou mantidas, com o motivo). Quando o time cair no aviso de "sprint não criada"/"sprint vencida", registrar a **ação necessária** em vez de movimentações. A pasta do time é criada automaticamente; o arquivo acumula histórico, não sobrescreve.
- Para cada Deploy processado que tenha um `.md` em `demandas/sre/{time}/`, atualizar a seção **Demanda(s) relacionada(s)** indicando que os cards foram encerrados (ex.: anexar `(Closed em DD/MM/AAAA)` ao item) e, se fizer sentido, registrar na **Metadata** que o pós-deploy foi concluído.
- Não criar `.md` novo de demanda para este fluxo — ele opera sobre deploys, demandas e sprints já existentes (os únicos arquivos gerados são os logs acima).

---

# Script de referência

Reaproveitar a infra existente:
- `src/infrastructure/azure-devops-client.ts` — conexão, retry e `getWorkItems`/comentários.
- Padrão de `getWorkItem(id, …, 4)` + filtro de relations: `scripts/dump-deploy-details.ts`.
- Padrão de fechamento (Fluxo A) com caminhada pela cadeia de estados e log por time: `scripts/close-demandas-de-deploys-fechados.ts`.
- Padrão de movimentação de sprint (Fluxo B) com validação de iteration e `--dry-run`: `scripts/move-plataforma-to-junho.ts` (valida que a sprint de destino existe no time via `getTeamIterations` antes de mover).
- Listar cards "em andamento" de um time/sprint: `scripts/list-plataforma-em-andamento.ts`.
- Relatório read-only de demandas abertas vinculadas a deploys: `scripts/report-sre-demandas-abertas-plataforma-holerite.ts`.
- WIQL por tipo/área no SRE: `scripts/query-sre-deploys-abril-maio.ts`.

Se o usuário pedir um runner dedicado, criar em `scripts/` (ex.: `scripts/agile-higiene-board.ts`) seguindo esses padrões, sempre com:
1. `--dry-run` por padrão exibindo os planos das seções A4 e B3.
2. Flag explícita (ex.: `--apply`) para efetivar as mudanças dos passos A5 e B4.
3. Flags de escopo úteis: `--fluxo=a|b|ambos` (default `ambos`), `--time=plataforma|holerite|ambos`, `--since=AAAA-MM-DD` (janela dos Deploys do Fluxo A), `--sprint='Sprint - Maio'` (origem opcional no Fluxo B), `--mover-pais` (opt-in para mover as Features sugeridas no B6; sem ela, pais só são listados).
4. Carregamento de credenciais via `dotenv/config` (`AZURE_DEVOPS_ORG_URL`, `AZURE_DEVOPS_PAT`).

---

# Regras gerais

- **Listar e confirmar antes de alterar.** Fechar card ou mover de sprint é ação de impacto no board da squad.
- **Escopo restrito a Plataforma e Holerite.** Só fechar/mover US e BUG cujo `AreaPath` esteja sob `Wiipo\Plataforma` ou `Wiipo\Holerite`. No Fluxo B, Feature e Epic pais desses cards podem ser **avaliados e, sob confirmação, movidos de sprint** — nunca fechados. Não mexer em cards de outros times.
- **Fluxo A só fecha** US/BUG vinculados via `Related` a um Deploy `Closed`. **Fluxo B só move** o `IterationPath` de cards em andamento (US/BUG e, sob confirmação explícita, suas Features/Epics) — nunca altera estado nem tags.
- **Sprint de destino tem que existir.** Se a última sprint criada do time não existir (ou já estiver vencida sem uma nova), **não mover** — avisar que a sprint precisa ser criada. Nunca criar iteration automaticamente.
- **Pai não move em silêncio.** Mover Feature/Epic é opt-in (`--mover-pais` + confirmação) e só quando todos os filhos abertos já acompanham a sprint de destino. Epic, por padrão, só é listado. Em caso de dúvida, **manter o pai** e reportar.
- **Nunca inventar** IDs, vínculos, sprints ou justificativas. Se um Deploy não tiver relations, reportar como "sem demandas vinculadas". Se o time não tiver sprint, reportar como "sem sprint de destino" — não adivinhar nomes de sprint.
- **Preservar dados existentes** (tags pré-existentes, descrição, assignee, board column). O Fluxo A altera `System.State` e **acrescenta** a tag `deploy-{MÊS}-2026`; o Fluxo B altera **apenas** `System.IterationPath`.
- Tom: profissional e técnico; sempre deixar claro o que foi alterado e o que ficou de fora.

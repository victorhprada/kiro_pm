---
inclusion: manual
---

# Criar Demanda de Deploy para o time SRE

Quando o usuário pedir para criar um chamado de **Deploy** para o SRE, siga este fluxo. O objetivo é gerar um chamado padronizado, completo e rastreável no board do time SRE no Azure DevOps.

## 1. Coletar informações iniciais

Pergunte apenas o que estiver faltando — não faça questionário longo. Os dados necessários são:

| Campo | Observação |
|-------|------------|
| **Squad solicitante** | Crédito / Holerite / Plataforma / SuperApp / MyPass / Flex. **Define o nome no título** (`Deploy {Squad}`) — crítico para os indicadores da Qualidade. |
| **Sistema** | Serviço/repositório técnico que vai subir: Plataforma / BD Plataforma / Flex / Holerite / SuperApp / Helpii / mobile-backend / notification-service / etc. Vai no campo **Sistema** do `.md`, não no título. |
| **Data do deploy** | Formato DD/MM/AAAA. Se não informado, usar data atual. |
| **Resumo curto** | Vai compor o título. |
| **PRs** | Lista de URLs (GitHub) ou indicação de implantação direta (S3/Dynamo/ECS/etc). |
| **Demanda(s) relacionada(s)** | **OBRIGATÓRIO.** URLs ou IDs de work items (US/BUG) no Azure DevOps. **Não criar o SRE sem pelo menos uma demanda para vincular** — ver regra bloqueante abaixo. |
| **Tipo de alteração** | Melhoria / Segurança / Bugfix / Nova funcionalidade (uma ou mais). |
| **Funcionalidades alteradas** | Lista. |
| **Produtos impactados** | Plataforma / Wiipoflex / Helpii / Consignado-Holerite Digital. |
| **Áreas impactadas** | Operações / Marketing / Produto. |
| **Janela de deploy** | Dentro da janela (`Deploy Oficial`) ou fora (`Deploy Especial`). Define a tag do SRE. |
| **Envolve banco de dados?** | Se sim, adicionar tag `Mudança BD`. |
| **Riscos / impacto negativo** | Quando aplicável. |
| **Urgência** | Sim/Não + justificativa. |
| **Testes em staging** | Confirmação ou justificativa de ausência. |
| **Documentação relacionada** | Links ou "Não se aplica". |

> ⚠️ **Regra bloqueante — vínculo de demanda é obrigatório.**
> **Nenhum chamado de Deploy do SRE pode ser criado sem ao menos uma demanda (US/BUG) do Azure DevOps para vincular** via `System.LinkTypes.Related`. O Deploy é um chamado paralelo de rastreabilidade e a Qualidade só contabiliza a entrega quando há vínculo + tag `deploy-{MÊS}-2026` na demanda.
>
> Fluxo obrigatório:
> 1. **Sempre solicitar o ID/URL do work item** (US ou BUG) antes de criar o SRE. Pedir explicitamente caso o usuário não tenha informado.
> 2. **Tentar inferir pelo PR primeiro:** ler título, corpo e commits do PR (`gh api`) atrás de referência ao work item (`AB#1234`, link `dev.azure.com/.../_workitems/edit/1234`, menção a `#1234`). Se encontrar, confirmar com o usuário em vez de perguntar do zero.
> 3. Se **não houver** referência no PR e o usuário **não** souber o ID: **não criar o SRE**. Parar e pedir a demanda. Não usar placeholder "Não informada" nem prosseguir sem vínculo.
> 4. **Nunca inventar** um ID de work item.
>
> Observação técnica: a varredura automática (`DeployBoardCollector`) liga **card → PR** (varre comentários do card atrás de URLs de PR), não o inverso. Portanto, descobrir a demanda a partir do PR só funciona se o número do work item estiver escrito no próprio PR.


### Acesso ao GitHub (repos privados da wiipobr)

Para enriquecer o chamado com dados reais dos PRs (título, CHANGELOG, arquivos alterados), use o GitHub CLI com as credenciais já configuradas no projeto.

**Pré-requisito:** o `.env` do projeto deve conter:
```
GH_CONFIG_DIR=/Users/victorhugopradateixeira/.gh-config
```
Essa variável já está no `.env`. O `dotenv/config` carrega ela automaticamente em qualquer script `tsx`.

**Como invocar o `gh` em scripts TypeScript:**
```typescript
import 'dotenv/config';
import { execSync } from 'child_process';

// GH_CONFIG_DIR já está no process.env via dotenv
const result = execSync(
  'gh api repos/wiipobr/{repo}/pulls/{number} --jq "{title, state, baseRefName, headRefName, body}"',
  { env: process.env, encoding: 'utf-8' }
);
```

**Como invocar o `gh` em comandos de terminal:**
```bash
# Sempre passar GH_CONFIG_DIR explicitamente ou garantir que o .env foi carregado
GH_CONFIG_DIR=$HOME/.gh-config gh api repos/wiipobr/{repo}/pulls/{number} --jq '{title,state}'
```

**Conta ativa:** `victor-prada_SeniorSA` (conta corporativa com acesso à org `wiipobr`).
Se o `gh auth status` mostrar `victorhprada` como ativa, trocar com:
```bash
GH_CONFIG_DIR=$HOME/.gh-config gh auth switch -u victor-prada_SeniorSA
```

**Dados úteis a extrair de cada PR:**
```bash
gh api repos/wiipobr/{repo}/pulls/{number} \
  --jq '{title, state, merged, mergedAt, baseRefName, headRefName, additions, deletions, changed_files}'

# CHANGELOG (quando existir no diff do PR):
gh api repos/wiipobr/{repo}/pulls/{number}/files \
  --jq '.[] | select(.filename | test("CHANGELOG"; "i")) | .patch'

# Commits (para PRs sem body/CHANGELOG):
gh api repos/wiipobr/{repo}/pulls/{number}/commits \
  --jq '.[] | .commit.message | split("\n")[0]'
```

**Nunca usar `web_fetch` para URLs do GitHub** — repos privados retornam 404 para fetch sem autenticação, mesmo com o IDE conectado. Sempre usar `gh api` ou `gh pr view`.

- Se o usuário fornecer **ID/URL de work item** do Azure DevOps, consultar via API e extrair: título, descrição (resumo curto), critérios de aceitação, área. Usar isso para preencher Descrição, Motivo e Funcionalidades sem perguntar de novo.
- Se o usuário fornecer **link de PR do GitHub**, perguntar título e descrição do PR (ou pedir colagem) — não temos acesso direto ao GitHub, mas o link entra na seção PRs do chamado.
- Se faltar apenas 1-2 campos críticos, perguntar pontualmente. **Nunca inventar** PRs, dados técnicos ou justificativas.
- **Demanda relacionada é obrigatória e bloqueante:** se o usuário não informar e não for possível inferir pelo PR, **parar e solicitar** antes de criar o SRE (ver regra bloqueante na seção 1).

### Varredura automática de PRs no board (modo lote)

Quando o usuário pedir para criar deploys SRE para **todos os cards de uma raia/coluna específica** (ex.: "cria os deploys do Holerite na coluna Deploy"), use o coletor automático em vez de perguntar PRs um a um:

1. Use `DeployBoardCollector` (em `src/application/deploy-board-collector.ts`) com:
   - `projectName`: `Wiipo`
   - `areaPath`: `Wiipo\\{Time}` (ex.: `Wiipo\\Holerite`)
   - `boardColumn`: nome da coluna no board do time (default: `Deploy`)
2. O coletor faz o seguinte automaticamente:
   - WIQL filtrando por `System.AreaPath UNDER '<areaPath>'` e `System.BoardColumn = '<coluna>'` (exclui `Closed` e `Removed`)
   - Para cada card, busca todos os comentários (com paginação) usando `WorkItemTrackingApi.getComments` com `RenderedText` expand
   - Aplica regex `https://github.com/wiipobr/<repo>/pull/<n>` em cada comentário (texto + HTML renderizado), removendo `#fragment` e `?query`
   - Deduplica PRs por `(repo, número)` e devolve o conjunto único por card e o agregado global
3. Resultado típico: lista `[{ workItem, comments, pullRequests[] }]` + `cardsWithoutPRs[]` (cards sem PR identificado).
4. Para cada card retornado:
   - Use o título e descrição do card como base do template do deploy.
   - Pré-preencha a seção **PR(s)** com as URLs encontradas.
   - Crie o vínculo `System.LinkTypes.Related` apontando para o card original.
5. Para os cards listados em `cardsWithoutPRs`, pergunte ao usuário PR a PR — **não inventar**.

> O nome da coluna varia por board. Se o usuário não especificar e o time tiver mais de uma raia candidata, perguntar uma única vez qual é a correta antes de rodar o coletor.

## 2. Gerar o chamado

### Título (obrigatório)

Formato:
```
[SRE] Deploy {Squad} + DD/MM/AAAA + {Resumo curto}
```

> ⚠️ **Regra da Qualidade — nome da squad no título é crítico para os indicadores.**
> A Qualidade extrai e contabiliza os deploys **com base no nome da squad informado no título do SRE**, independentemente da tecnologia envolvida (app, web, backend, BD etc.). Se o nome estiver incorreto ou ausente, o deploy **não é contabilizado** nos indicadores. Use sempre o nome do **produto/squad dona da entrega**, nunca o nome do serviço/repositório.

Mapa oficial produto/squad → nome no título:

| Produto / Squad | Nome no título |
|-----------------|----------------|
| Crédito | `Deploy Crédito` |
| Holerite | `Deploy Holerite` |
| Plataforma | `Deploy Plataforma` |
| SuperApp | `Deploy SuperApp` |
| MyPass | `Deploy MyPass` |
| Flex | `Deploy Flex` |

> Mesmo que o sistema técnico que vai subir seja `wiipo-mobile-backend`, `notification-service`, `BD Plataforma` etc., o título deve usar o nome da squad (ex.: `Deploy Plataforma`). Detalhe o serviço/repositório específico no campo **Sistema** do `.md` e na **Descrição**, não no nome da squad do título.

Exemplos reais válidos:
- `[SRE] Deploy Plataforma + 13/05/2026 + Implementação de verificação de identidade via WAAPI Access Token`
- `[SRE] Deploy Flex 14/05/2026 - Remoção de vínculo legado do Wiipo Flex`
- `[SRE] Deploy Holerite + 14/05/2026 + Alteração de campos para match na API`

Use `+` como separador padrão (alguns títulos usam `-` em deploys de Flex/SuperApp; manter o que o usuário usou se já existe um padrão recente do time).

### Descrição (HTML para o Azure DevOps)

Estruture rigorosamente nesta ordem:

```html
<b>Descrição:</b> {Sumário curto do que será feito.}

<b>Motivo:</b> {Contexto técnico e impacto esperado.}

<b>Demanda(s):</b>
<ul>
  <li><a href="{url-azure}">{url-azure}</a></li>
</ul>

<b>PR(s):</b>
<ul>
  <li><a href="{url-github}">{url-github}</a></li>
</ul>
<!-- ou: "Implantação direta (sem PR): S3 / Dynamo / ECS / etc." -->

<b>Tipo da alteração:</b>
<ul>
  <li>{✅ ou (   )} Melhoria (performance, latência, etc.)</li>
  <li>{✅ ou (   )} Segurança</li>
  <li>{✅ ou (   )} Bugfix</li>
  <li>{✅ ou (   )} Nova funcionalidade</li>
</ul>

<b>Funcionalidades que serão alteradas:</b>
<ul>
  <li>{Item 1}</li>
  <li>{Item 2}</li>
</ul>

<b>Produtos da Wiipo impactados:</b>
<ul>
  <li>{✅ ou (   )} Plataforma</li>
  <li>{✅ ou (   )} Wiipoflex</li>
  <li>{✅ ou (   )} Helpii</li>
  <li>{✅ ou (   )} Consignado / Holerite Digital</li>
</ul>

<b>Áreas impactadas:</b>
<ul>
  <li>{✅ ou (   )} Operações</li>
  <li>{✅ ou (   )} Marketing</li>
  <li>{✅ ou (   )} Produto</li>
</ul>

<b>Impacto negativo potencial:</b> {Riscos identificados ou "Sem impactos negativos previstos".}

<b>Há urgência para subir as alterações?</b>
<b>Justificativa:</b> {Sim/Não + motivo.}

<b>O código foi testado em staging (sandbox)?</b>
<b>Justificativa:</b> {Sim/Não + onde foi testado, ex.: "Testado em develop".}

<b>Há documentação relacionada?</b>
{Links ou "Não se aplica".}
```

> Use `✅` para itens marcados e `(   )` para itens não marcados — esse é o padrão visual do time SRE atual.

## 3. Salvar o arquivo .md

Estrutura de pastas (organização por **time solicitante**, não por sistema que vai subir):
```
demandas/sre/{time-solicitante}/{nome-do-deploy-em-kebab-case}.md
```

Times atuais com pasta:
- `demandas/sre/holerite/` — deploys solicitados pelo time Holerite (mesmo que o sistema seja Plataforma, BD Plataforma etc.)
- `demandas/sre/plataforma/` — deploys solicitados pelo time Plataforma

Crie nova subpasta sob `demandas/sre/` quando aparecer um time novo (Flex, SuperApp, Helpii, Convenix etc.). O critério é **quem solicitou o deploy / é dono da aprovação**, não o produto que será impactado.

Formato do .md (espelha o que vai pro Azure, sem HTML):

```markdown
# {Título completo do chamado}

## Resumo

**Sistema:** {Plataforma / BD Plataforma / Flex / etc.}
**Data do deploy:** DD/MM/AAAA
**Tipo:** Deploy

## Descrição

{Sumário curto.}

## Motivo

{Contexto técnico e impacto esperado.}

## Demanda(s) relacionada(s)

- [#{id}](url) — {título}

## PR(s)

- {url-pr-github}

## Tipo da alteração

- [x] Melhoria
- [ ] Segurança
- [ ] Bugfix
- [ ] Nova funcionalidade

## Funcionalidades alteradas

- {item 1}
- {item 2}

## Produtos impactados

- [x] Plataforma
- [ ] Wiipoflex
- [ ] Helpii
- [ ] Consignado / Holerite Digital

## Áreas impactadas

- [x] Operações
- [ ] Marketing
- [x] Produto

## Impacto negativo potencial

{Riscos.}

## Urgência

**Há urgência?** Sim/Não
**Justificativa:** {...}

## Testes em staging

**Testado?** Sim/Não
**Justificativa:** {...}

## Documentação relacionada

{Links ou "Não se aplica"}

## Metadata

| Campo | Valor |
|-------|-------|
| **Time** | SRE |
| **Squad solicitante** | {Crédito / Holerite / Plataforma / SuperApp / MyPass / Flex} |
| **Status** | Pendente aprovação |
| **Tipo de Work Item** | Deploy |
| **Tags do SRE** | Deploy Oficial / Deploy Especial / Mudança BD |
| **Tag de contabilização (nas demandas)** | deploy-{MÊS}-2026 |
| **Deploy ID** | _(preenchido após criação)_ |
```

## 4. Apresentar para aprovação

Mostre o .md gerado e pergunte: "Está aprovado? Quer ajustar algo?". Aplique ajustes se houver.

## 5. Criar no Azure DevOps (após aprovação)

1. Carregar credenciais do `.env` (`AZURE_DEVOPS_ORG_URL` e `AZURE_DEVOPS_PAT`).
2. Criar work item no projeto **Wiipo**, do tipo **`Deploy`**, com:
   - `System.Title`: título no formato oficial.
   - `System.Description`: HTML completo do template da seção 2.
   - `System.AreaPath`: `Wiipo\\SRE`.
   - `System.IterationPath`: `Wiipo\\SRE` (o time SRE não usa sprints).
3. **Tags obrigatórias no SRE (regra da Qualidade):** todo Deploy deve receber **uma** tag de janela e, quando aplicável, a tag de banco:
   - `Deploy Oficial` → SRE realizado **dentro** da janela de Liberação (dias verdes no Calendário de Liberações — ver seção 7). **É o default** quando a data do deploy cai dentro da janela.
   - `Deploy Especial` → SRE realizado **fora** da janela de Liberação (urgente / hotfix / risco alto, ou em período de Estabilização/Freezing).
   - `Mudança BD` → adicionar **adicionalmente** sempre que o deploy envolver alteração em banco de dados (ex.: deploys de "BD Plataforma", migrations, scripts Dynamo/SQL).

   > As tags são `System.Tags`, separadas por `;`. Ex.: `Deploy Oficial; Mudança BD`. **Para decidir a tag de janela, cruzar a data do deploy com o Calendário de Liberações (seção 7).** Se a data não estiver clara ou cair em zona de transição, perguntar pontualmente — **não assumir `Deploy Especial`** sem sinal de urgência/fora de janela.
4. **Vínculos (obrigatório):** todo Deploy **deve** ter ao menos um link `System.LinkTypes.Related` (não `Hierarchy-Reverse` — o Deploy não é filho da User Story, é um chamado paralelo) com a URL `{orgUrl}/_apis/wit/workItems/{idDemanda}`. **Não criar o work item de Deploy sem demanda vinculada** — se não houver, voltar à seção 1 e solicitar.
5. **Campos customizados:** o tipo Deploy **não** exige `Custom.SR_ENTREGA`, `SR_RELEASE`, `SR_PACOTES` etc. — esses são da hierarquia Epic/Feature/US. Não enviar.
6. Atualizar o `.md` com o ID e URL do Deploy criado e mudar o status para "Criado no Azure DevOps".
7. **Tag de contabilização nas demandas relacionadas (regra da Qualidade):** em **cada US/BUG** que vai para produção neste deploy, adicionar a tag no padrão:
   ```
   deploy-{MÊS ATUAL EM PORTUGUÊS, MAIÚSCULO}-2026
   ```
   - Exemplo (junho/2026): `deploy-JUNHO-2026`. Em maio seria `deploy-MAIO-2026`.
   - O mês é o **mês atual do deploy**, não o mês da criação da demanda.
   - É a tag que a Qualidade usa para contar quantas tasks foram entregues em cada deploy. Sem ela, a entrega da squad **não é contabilizada**.
   - Aplicar tanto em **US quanto em BUG**. Adicionar via `System.Tags` do work item da demanda (não do Deploy), preservando as tags já existentes.
   - Meses (referência): JANEIRO, FEVEREIRO, MARÇO, ABRIL, MAIO, JUNHO, JULHO, AGOSTO, SETEMBRO, OUTUBRO, NOVEMBRO, DEZEMBRO.
8. **Gerar a mensagem de aprovação para o time não-técnico** (ver seção 6 abaixo). **Sempre anexar a mensagem ao próprio `.md`** do deploy, em uma seção `## Mensagem de aprovação` ao final do arquivo, além de exibi-la para o usuário. Esse é o padrão dos deploys já existentes (ex.: `demandas/sre/holerite/`). Não considere o fluxo concluído enquanto a seção não estiver no `.md`.

> **Controle de bugs corrigidos (regra da Qualidade — apenas BUGs, não US):** sempre que um **BUG** for testado e aprovado por QA/Produto, ele deve ser movido para a coluna **Deploy** na raia de bugs, **mesmo que a correção ainda não suba para produção naquele momento**. É assim que a Qualidade identifica que o bug foi efetivamente corrigido. Não deixar bugs já testados/aprovados parados na coluna **Doing** da Qualidade, pois isso impede a contabilização. Quando o deploy contemplar um BUG, lembrar o usuário de garantir que o card esteja na coluna Deploy.

### Exemplo de patch document

```json
[
  { "op": "add", "path": "/fields/System.Title", "value": "[SRE] Deploy Plataforma + 14/05/2026 + Resumo" },
  { "op": "add", "path": "/fields/System.Description", "value": "<html>...</html>" },
  { "op": "add", "path": "/fields/System.AreaPath", "value": "Wiipo\\SRE" },
  { "op": "add", "path": "/fields/System.IterationPath", "value": "Wiipo\\SRE" },
  { "op": "add", "path": "/fields/System.Tags", "value": "Deploy Oficial" },
  {
    "op": "add",
    "path": "/relations/-",
    "value": {
      "rel": "System.LinkTypes.Related",
      "url": "{orgUrl}/_apis/wit/workItems/{idDemanda}"
    }
  }
]
```

> Para adicionar a tag `deploy-{MÊS}-2026` na demanda relacionada (US/BUG), fazer um PATCH separado **no work item da demanda**, preservando as tags existentes:
> ```json
> [
>   { "op": "add", "path": "/fields/System.Tags", "value": "{tags-atuais}; deploy-JUNHO-2026" }
> ]
> ```

## 6. Mensagem de aprovação para o time não-técnico

Após criar o chamado no Azure DevOps, **sempre** gerar a mensagem abaixo e:

1. **Anexá-la ao próprio `.md`** do deploy, em uma seção `## Mensagem de aprovação` ao final do arquivo (após o bloco de Metadata, separada por `---`). É o padrão dos deploys já existentes — a mensagem fica versionada junto com o chamado.
2. **Exibi-la também na resposta** para o usuário encaminhar ao time responsável pela aprovação (Produto, Operações, etc.).

O objetivo é comunicar o que vai subir em linguagem acessível, sem jargão técnico, e solicitar o aval formal antes da janela de deploy.

### Template da mensagem

```
Olá, time!

Criamos o chamado de deploy #[ID] para o time SRE referente ao sistema [Sistema].

O que vai subir:
[Lista das funcionalidades alteradas em linguagem não-técnica — 1 linha por item, sem siglas de código]

Demandas contempladas:
[Lista dos cards/IDs com título resumido]

Pontos de atenção:
[Riscos em linguagem simples — ex.: "Alteração no fluxo de login", "Novo campo obrigatório no cadastro"]

Data prevista: [DD/MM/AAAA ou "A definir"]

Testado em staging? [Sim / Não — breve justificativa]

Para que o deploy seja realizado, precisamos da aprovação de vocês no chamado:
[URL do work item no Azure DevOps]

Qualquer dúvida, estou à disposição!
```

### Regras da mensagem

- **Linguagem não-técnica**: substituir nomes de serviços/endpoints por descrições funcionais. Ex.: `GET /payslip/:id` → "busca de holerite por colaborador"; `WiipoOriginAllowMiddleware` → "regras de acesso à API".
- **Funcionalidades**: listar apenas o que tem impacto visível para o usuário final ou para operações — omitir refatorações internas, ajustes de lint, sync de branches.
- **Riscos**: focar no impacto para o negócio, não no código. Ex.: "Se o deploy do backend e do app não forem feitos juntos, pode haver inconsistência na tela X" em vez de "race condition entre serviços".
- **Tom**: direto, cordial, sem alarmismo. Usar emojis com moderação para facilitar a leitura rápida.
- **Nunca inventar** datas, aprovadores ou responsáveis que não foram informados.

- **Nunca inventar** PRs, IDs, justificativas ou dados técnicos.
- Se o usuário passar IDs/URLs do Azure DevOps, **consultar a API** antes de perguntar — extrair título, descrição e área para já preencher campos do template.
- Se faltar info crítica e não for inferível, fazer **no máximo 2-3 perguntas pontuais**.
- **Vínculo de demanda (US/BUG) é pré-requisito inegociável para criar o SRE** — nunca prosseguir sem ele.
- O `.md` em `demandas/sre/{time-solicitante}/` é a fonte de verdade local — sempre salvar antes de criar no Azure.
- Cada deploy = 1 arquivo `.md`.
- Tom: profissional e técnico; use formatação clara (Markdown e HTML).

## 7. Calendário de Liberações 2026 (janela de deploy)

Este calendário é a **fonte de verdade para classificar a tag de janela do SRE** (`Deploy Oficial` vs `Deploy Especial`, ver seção 5, item 3). Cruze a **data do deploy** com o período correspondente abaixo.

### Legenda (fases do ciclo)

| Fase | Cor no calendário | Significado para o deploy |
|------|-------------------|---------------------------|
| **Liberações** | 🟩 Verde | Janela oficial de deploy. Deploy nesses dias → tag **`Deploy Oficial`**. |
| **Estabilização** | 🟧 Laranja claro | Período de estabilização pós-liberação / pré-liberação. Deploy aqui é **fora da janela oficial** → tag **`Deploy Especial`** (salvo orientação contrária do time). |
| **Freezing** | 🟪 Roxo | Congelamento (sem deploys planejados — tipicamente fim de ano). Deploy aqui é exceção → **`Deploy Especial`** e exige justificativa forte. |
| **Feriado Nacional** | 🔵 Azul | Sem deploy. |
| **Feriado Municipal** | 🟡 Amarelo | Sem deploy (Joinville/sede). |

### Regra de classificação

1. Pegue a **data do deploy** (DD/MM/2026).
2. Veja em que fase ela cai no calendário do mês:
   - Cair em dia de **Liberação (verde)** → `Deploy Oficial`.
   - Cair em **Estabilização (laranja)**, **Freezing (roxo)**, feriado ou fim de semana → `Deploy Especial`.
3. Em caso de dúvida sobre a fase exata do dia, **perguntar** — não assumir.

### Janelas por mês (⚠️ PROVISÓRIO — pendente de confirmação do usuário)

> As datas abaixo são minha **melhor leitura da imagem do calendário** e ainda **não estão confirmadas**. Como elas governam a tag que alimenta os indicadores da Qualidade, **trate como rascunho até o usuário validar**. Enquanto não confirmado, na dúvida da fase de um dia específico, perguntar.

| Mês | Janela de Liberação (verde) | Observações |
|-----|------------------------------|-------------|
| Janeiro | _a confirmar_ | Feriado municipal dia 25 (azul/amarelo na imagem). |
| Fevereiro | _a confirmar_ | Semana de Carnaval costuma entrar como estabilização/feriado. |
| Março | _a confirmar_ | |
| Abril | _a confirmar_ | |
| Maio | _a confirmar_ | |
| Junho | _a confirmar_ | |
| Julho | _a confirmar_ | |
| Agosto | _a confirmar_ | |
| Setembro | _a confirmar_ | |
| Outubro | _a confirmar_ | |
| Novembro | _a confirmar_ | |
| Dezembro | _a confirmar_ | Final do mês em **Freezing** (roxo) — congelamento de fim de ano. |

> Assim que o usuário confirmar os dias exatos de cada fase, substituir os `_a confirmar_` pelos intervalos reais (ex.: "Liberação: 15–19/06; Estabilização: 08–12/06") e **remover o aviso de PROVISÓRIO**.

---
inclusion: manual
---

# Criar Demanda de Deploy para o time SRE

Quando o usuário pedir para criar um chamado de **Deploy** para o SRE, siga este fluxo. O objetivo é gerar um chamado padronizado, completo e rastreável no board do time SRE no Azure DevOps.

## 1. Coletar informações iniciais

Pergunte apenas o que estiver faltando — não faça questionário longo. Os dados necessários são:

| Campo | Observação |
|-------|------------|
| **Sistema** | Plataforma / BD Plataforma / Flex / Holerite / SuperApp / Helpii / etc. |
| **Data do deploy** | Formato DD/MM/AAAA. Se não informado, usar data atual. |
| **Resumo curto** | Vai compor o título. |
| **PRs** | Lista de URLs (GitHub) ou indicação de implantação direta (S3/Dynamo/ECS/etc). |
| **Demanda(s) relacionada(s)** | URLs ou IDs de work items no Azure DevOps. |
| **Tipo de alteração** | Melhoria / Segurança / Bugfix / Nova funcionalidade (uma ou mais). |
| **Funcionalidades alteradas** | Lista. |
| **Produtos impactados** | Plataforma / Wiipoflex / Helpii / Consignado-Holerite Digital. |
| **Áreas impactadas** | Operações / Marketing / Produto. |
| **Riscos / impacto negativo** | Quando aplicável. |
| **Urgência** | Sim/Não + justificativa. |
| **Testes em staging** | Confirmação ou justificativa de ausência. |
| **Documentação relacionada** | Links ou "Não se aplica". |

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
[SRE] Deploy {Sistema} + DD/MM/AAAA + {Resumo curto}
```

Exemplos reais válidos:
- `[SRE] Deploy BD Plataforma + 13/05/2026 + Implementação de verificação de identidade via WAAPI Access Token`
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

Estrutura de pastas:
```
demandas/sre/{nome-do-deploy-em-kebab-case}.md
```

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
| **Status** | Pendente aprovação |
| **Tipo de Work Item** | Deploy |
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
3. **Tags opcional:** `Deploy Especial` quando o usuário marcar como urgente/de risco alto.
4. **Vínculos:** se houver demanda relacionada, criar link `System.LinkTypes.Related` (não `Hierarchy-Reverse` — o Deploy não é filho da User Story, é um chamado paralelo) com a URL `{orgUrl}/_apis/wit/workItems/{idDemanda}`.
5. **Campos customizados:** o tipo Deploy **não** exige `Custom.SR_ENTREGA`, `SR_RELEASE`, `SR_PACOTES` etc. — esses são da hierarquia Epic/Feature/US. Não enviar.
6. Atualizar o `.md` com o ID e URL do Deploy criado e mudar o status para "Criado no Azure DevOps".
7. **Gerar e exibir a mensagem de aprovação para o time não-técnico** (ver seção 6 abaixo).

### Exemplo de patch document

```json
[
  { "op": "add", "path": "/fields/System.Title", "value": "[SRE] Deploy BD Plataforma + 14/05/2026 + Resumo" },
  { "op": "add", "path": "/fields/System.Description", "value": "<html>...</html>" },
  { "op": "add", "path": "/fields/System.AreaPath", "value": "Wiipo\\SRE" },
  { "op": "add", "path": "/fields/System.IterationPath", "value": "Wiipo\\SRE" },
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

## 6. Mensagem de aprovação para o time não-técnico

Após criar o chamado no Azure DevOps, **sempre** gerar e exibir a mensagem abaixo para o usuário encaminhar ao time responsável pela aprovação (Produto, Operações, etc.). O objetivo é comunicar o que vai subir em linguagem acessível, sem jargão técnico, e solicitar o aval formal antes da janela de deploy.

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
- O `.md` em `demandas/sre/` é a fonte de verdade local — sempre salvar antes de criar no Azure.
- Cada deploy = 1 arquivo `.md`.
- Tom: profissional e técnico; use formatação clara (Markdown e HTML).

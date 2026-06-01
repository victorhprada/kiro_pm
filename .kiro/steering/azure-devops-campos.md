---
inclusion: manual
---

# Azure DevOps — Campos por tipo de work item (Projeto Wiipo)

Referência do que cada tipo de work item aceita no projeto **Wiipo**, para criar/atualizar via API sem erro de validação. Mapeado direto da API (`getWorkItemTypeFieldsWithReferences`, expand `AllowedValues`).

> Atualizar este arquivo rodando `scripts/introspect-work-item-types.ts` quando o processo do Azure mudar (campos novos, valores novos). O script vive em `scripts/` e **não é commitado**.

## Regra de ouro: onde o texto aparece

O **board e o card** exibem o campo **`System.Description`**. Sempre preencher esse campo, em todos os tipos.

| Tipo | Campo do corpo principal exibido no card | Campos complementares |
|------|------------------------------------------|-----------------------|
| Epic | `System.Description` | — |
| Feature | `System.Description` | — |
| User Story | `System.Description` | `Microsoft.VSTS.Common.AcceptanceCriteria` (aba Critérios de Aceitação) |
| Bug | `System.Description` | `Microsoft.VSTS.TCM.ReproSteps` (Passos de Reprodução) + `Microsoft.VSTS.TCM.SystemInfo` (Informações do Sistema) |

⚠️ **Armadilha do Bug:** se você preencher só `ReproSteps`/`SystemInfo` e deixar `System.Description` vazio, o card aparece **sem descrição** no board. No Bug, preencha `System.Description` (resumo) **e** `ReproSteps` (passos + critérios de aceitação).

Todos os campos de texto aceitam **HTML** (`<p>`, `<b>`, `<ul>`, `<ol>`, `<li>`, `<code>`, `<pre>`).

---

## Campos obrigatórios por tipo

Além de `System.Title`, `System.AreaPath`/`AreaId` e `System.IterationPath`/`IterationId` (sempre obrigatórios):

| Campo | Epic | Feature | User Story | Bug |
|-------|:----:|:-------:|:----------:|:---:|
| `Microsoft.VSTS.Common.ValueArea` (`Business`/`Architectural`) | ✅ | ✅ | ✅ | ✅ |
| `Microsoft.VSTS.Common.Priority` (`1`–`4`) | ✅ | — | — | — |
| `Custom.SR_SYSTEM_TEAM` (boolean) | — | — | — | ✅ |

Default seguro: `ValueArea = "Business"`, `Priority = "2"`, `SR_SYSTEM_TEAM = false`.

> Observação: na prática a API também rejeitou a criação de **Bug** sem `Custom.SR_NATUREZA` preenchido (erro `TF401320 ... SR_NATUREZA`). Tratar `SR_NATUREZA` como obrigatório de fato para Bug (ver valor recomendado abaixo).

---

## Campos customizados comuns (SR_*) — valores aceitos

Campos de **lista** (combo) só aceitam exatamente um dos valores abaixo. Campos sem lista são texto livre.

### Aplicáveis a Epic, Feature, User Story e Bug

**`Custom.SR_ENTREGA`** — `Não informada` (default) · `HCM - Novos Produtos 2026 \ 9256 \ SuperApp`

**`Custom.SR_RELEASE`** — `2026 R1` · `2026 R2` · `2026 R3` · `2026 R4`

**`Custom.SR_MOTIVO_IMPEDIMENTO`** — `Aguardando decisão de negócio` · `Aguardando outra equipe` · `Aguardando validação do PO` · `Ambiente instável / fora do ar` · `Prioridade alterada`

### Epic / Feature / User Story (não Bug)

**`Custom.SR_TIPO_DE_DEMANDA`** — `Base Instalada` · `Cobertura Funcional` · `Compromisso assumido com o cliente` · `Customização paga pelo cliente` · `Densidade Funcional` · `Evolução de mercado` · `Evolução tecnológica` · `Exigência legal` · `Inovação` · `Não informado` · `Projeto` · `Sustentação`

**`Custom.SR_TIPO_DE_REPASSE`** — `Interno` · `Suporte` *(Epic e Feature)*

### Pacotes / Tamanho

**`Custom.SR_PACOTES`** (Epic, Feature, User Story) — `Não se aplica` (default) · `P1` · `P2` · `P3` · `PX`

**`Custom.SR_TAMANHO`** (Feature, User Story) — `PP` · `P` · `M` · `G` · `GG`

### LGPD (Epic)

**`Custom.SR_TEM_IMPACTO_LGPD`** — `Não` (default) · `Sim`. Quando `Sim`, há campos de texto associados: `SR_DESCREVA_TRATAMENTO_ADOTADO_PARA_REGRAS_LGPD`, `SR_EXISTE_NECESSIDADE_ANONIMIZACAO_DADO`, `SR_SERAO_MANIPULADOS_CAMPOS_COM_DADOS_PESSOAIS`, `SR_SERAO_MANIPULADOS_CAMPOS_DADOS_PESSOAIS_SENSIVEIS`.

---

## Campos específicos de Bug

O tipo **Bug** tem o conjunto mais rico de campos de classificação. Os campos abaixo **não têm lista** salvo indicação (texto livre): `SR_CUSTOMER`, `SR_CUSTOMER_ID`, `SR_ERROR_COMMENT`, `SR_TICKET_ZENDESK`, e o bloco `SR_*_ZENDESK` (`SR_ACAO_ZENDESK`, `SR_GRUPO_ATENDIMENTO`, `SR_MODULO_ZENDESK`, `SR_PROCESSO_ZENDESK`, `SR_PRODUTO_ZENDESK`, `SR_STATUS_ZENDESK`, `SR_TIPO_ZENDESK`).

Campos de **lista**:

**`Custom.SR_NATUREZA`** (tratar como obrigatório no Bug) — valores comuns: `Erro programação` · `Erro análise de negócio` · `Erro` · `Incidente` · `Suporte` · `Implementação` · `Melhoria Interna` · `Requisição` (lista completa tem ~37 valores; estes são os usados em bug de código).
- Para bug que **veio do suporte/chamado** mas é defeito de código: usar **`Erro programação`**.

**`Custom.SR_BUG_TYPE`** — `Bug básico` · `Bug automação` · `Bug de merge` · `Bug de mídia` · `Bug deploy` · `Bug segurança`
- Default recomendado: `Bug básico`.

**`Custom.SR_BUG_ORIGIN`** — `Interno` · `Mercado`
- ⚠️ Só existem esses dois valores. **Não existe** "Suporte"/"Cliente" aqui. Bug reportado por cliente/mercado → `Mercado`; bug achado internamente → `Interno`. (A origem "suporte/chamado" deve ir no texto da descrição e/ou no campo Zendesk, não aqui.)

**`Custom.SR_OFFENSIVE_AGENT`** — `Comportamento original do produto` · `Implementação` · `Manutenção`

**`Custom.SR_CRITICAL_ANALYSIS_TYPE`** — `Ambiente (Cloud)` · `Atualizador` · `Correção de dados` · `Documentação` · `Expedição` · `Framework / Componente de terceiros` · `Funcionalidade inexistente` · `Integração` · `Lentidão` · `Mensagem incorreta` · `Produto (Cálclo / Processo)` · `Travamento`

**`Custom.SR_ERROR_AGE`** — `Até 1 mês` · `Até 3 meses` · `Até 6 meses` · `Até 1 ano` · `Até 2 anos` · `Mais de 2 anos`

**`Custom.SR_ERROR_CAUSE`** — lista longa; valores úteis: `Programação (Incompleta)` · `Programação (Lentidão)` · `Programação (Não usou melhores práticas)` · `Retro compatibilidade (a diferença da versão causa o erro)` · `Não identificada` · família `Discovery (...)` · família `SQL (...)` · `Documentação Errada/Incompleta/Inexistente`.

Campos nativos do Bug (lista):
- **`Microsoft.VSTS.Common.Severity`** — `1 - Critical` · `2 - High` · `3 - Medium` (default) · `4 - Low`
- **`Microsoft.VSTS.Common.Priority`** — `1`–`4` (default `2`)
- **`Microsoft.VSTS.CMMI.Blocked`** — `Yes` · `No`

---

## Estados (`System.State`) por tipo

- **Epic:** `New` (default) · `Active` · `Review` · `Closed` · `Removed`
- **Feature:** `New` (default) · `Active` · `Ready` · `Review` · `Resolved` · `Closed` · `Removed`
- **User Story:** `New` (default) · `Active` · `Ready` · `Review` · `Test` · `Resolved` · `Closed` · `Dropped` · `Removed`
- **Bug:** `New` (default) · `Active` · `Ready` · `Review` · `Test` · `Resolved` · `Closed` · `Dropped` · `Removed`

Criar sempre em `New` (default). Não setar `State` no payload de criação salvo necessidade.

---

## Payloads de referência (JSON Patch)

### Bug (caso de defeito de código vindo de suporte)

```json
[
  { "op": "add", "path": "/fields/System.Title", "value": "..." },
  { "op": "add", "path": "/fields/System.Description", "value": "<p>Resumo do problema + comportamento esperado (aparece no card)</p>" },
  { "op": "add", "path": "/fields/Microsoft.VSTS.TCM.ReproSteps", "value": "<p>Passos + contexto técnico + critérios de aceitação</p>" },
  { "op": "add", "path": "/fields/System.AreaPath", "value": "Wiipo\\Holerite" },
  { "op": "add", "path": "/fields/System.IterationPath", "value": "Wiipo\\Holerite\\Janela de Junho" },
  { "op": "add", "path": "/fields/Microsoft.VSTS.Common.ValueArea", "value": "Business" },
  { "op": "add", "path": "/fields/Custom.SR_SYSTEM_TEAM", "value": false },
  { "op": "add", "path": "/fields/Custom.SR_NATUREZA", "value": "Erro programação" },
  { "op": "add", "path": "/fields/Custom.SR_BUG_TYPE", "value": "Bug básico" },
  { "op": "add", "path": "/fields/Custom.SR_BUG_ORIGIN", "value": "Mercado" },
  { "op": "add", "path": "/fields/Custom.SR_OFFENSIVE_AGENT", "value": "Comportamento original do produto" },
  { "op": "add", "path": "/fields/Custom.SR_CRITICAL_ANALYSIS_TYPE", "value": "Correção de dados" },
  { "op": "add", "path": "/fields/Custom.SR_ERROR_CAUSE", "value": "Retro compatibilidade (a diferença da versão causa o erro)" },
  { "op": "add", "path": "/fields/Custom.SR_ERROR_AGE", "value": "Até 1 ano" },
  { "op": "add", "path": "/fields/Custom.SR_ENTREGA", "value": "Não informada" },
  { "op": "add", "path": "/fields/Custom.SR_TEM_IMPACTO_LGPD", "value": "Não" },
  { "op": "add", "path": "/fields/Custom.SR_RELEASE", "value": "2026 R2" },
  { "op": "add", "path": "/fields/Custom.SR_PACOTES", "value": "Não se aplica" }
]
```

### Epic / Feature / User Story
Ver `criar-demanda.md` (já documenta o patch base de Epic/Feature/US). Lembrar de incluir `System.Description` e, na US, `Microsoft.VSTS.Common.AcceptanceCriteria`.

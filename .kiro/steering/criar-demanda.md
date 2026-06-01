---
inclusion: manual
---

# Criar Demanda — Fluxo Padrão

Quando o usuário pedir para criar uma demanda, siga este fluxo obrigatoriamente:

## 1. Coletar informações iniciais

Pergunte (se não fornecido):
- **Time**: Qual time? (Plataforma, SuperApp, Beneficios, SRE, Migration, Mypass, Solucoes Financeiras, Holerite, Qualidade, Beneficios-Projetos)
- **Sprint**: Qual sprint de destino?
- **Demanda**: Descrição em texto livre do que precisa ser feito

Se o usuário já forneceu a demanda no texto, não pergunte novamente — use o que foi dito.

## 2. Gerar a hierarquia

Use os frameworks das skills em `.kiro/skills/` para estruturar:
- **create-prd**: Para contexto, objetivo e proposta de valor
- **user-stories**: Para gerar User Stories no formato 3 C's (Card, Conversation, Confirmation) com critérios INVEST
- **analyze-feature-requests**: Para estruturar tema, impacto, esforço e risco
- **job-stories**: Para cenários no formato "Quando [situação], eu quero [motivação], para que [resultado]"

Gere automaticamente a partir do texto livre:
- 1 Epic (título + descrição)
- 1 Feature (título + descrição)
- N User Stories (título + descrição + critérios de aceitação)

## 3. Salvar o arquivo .md

Estrutura de pastas:
```
demandas/{time-em-kebab-case}/{nome-da-demanda-em-kebab-case}.md
```

Formato do arquivo:
```markdown
# {Título do Epic}

## Epic

**Título:** {título}

**Descrição:**
{descrição do Epic}

---

## Feature

**Título:** {título}

**Descrição:**
{descrição da Feature}

---

## User Stories

### US1: {título}

**Descrição:** Como {role}, eu quero {ação}, para que {benefício}.

**Critérios de Aceitação:**
1. {critério testável}
2. {critério testável}
3. {critério testável}
4. {critério testável}

---

### US2: {título}

...

---

## Metadata

| Campo | Valor |
|-------|-------|
| **Time** | {nome do time} |
| **Status** | Pendente aprovação |
| **Prioridade** | A definir |
| **Sprint** | {sprint selecionada} |
```

## 4. Apresentar para aprovação

Mostre a hierarquia gerada e pergunte:
- "Está aprovado? Quer ajustar algo?"

Se o usuário pedir ajustes, modifique o arquivo e apresente novamente.

## 5. Criar no Azure DevOps (após aprovação)

Quando o usuário aprovar, crie os work items no Azure DevOps usando a API:

1. Carregar credenciais do `.env` (AZURE_DEVOPS_ORG_URL e AZURE_DEVOPS_PAT)
2. Criar o **Epic** no projeto Wiipo, time e sprint selecionados
3. Criar a **Feature** vinculada ao Epic (System.LinkTypes.Hierarchy-Reverse)
4. Criar cada **User Story** vinculada à Feature (System.LinkTypes.Hierarchy-Reverse)
5. Atualizar o campo **Status** no .md para "Criado no Azure DevOps"
6. Adicionar os IDs e URLs dos work items criados no .md

Usar o script em `dist/index.js` ou chamar a API diretamente via node script inline.

> **Referência completa de campos por tipo:** ver `azure-devops-campos.md` (mapeamento de campos obrigatórios, valores aceitos em cada combo e onde o texto aparece no card) para Epic, Feature, User Story e **Bug**. Consultar antes de criar, especialmente para Bug (que tem campos próprios e não usa a hierarquia Epic→Feature→US).

### Quando a demanda é um Bug (correção vinda de suporte/chamado)

Demanda de correção que veio do suporte normalmente é **1 único work item do tipo Bug** — não a hierarquia Epic→Feature→US. Pontos críticos (detalhes em `azure-devops-campos.md`):
- Preencher **`System.Description`** (resumo — é o que aparece no card do board) **E** **`Microsoft.VSTS.TCM.ReproSteps`** (passos de reprodução + critérios de aceitação). Só preencher ReproSteps deixa o card "sem descrição".
- Campos obrigatórios extras do Bug: `Custom.SR_SYSTEM_TEAM` (boolean) e `Custom.SR_NATUREZA` (usar `Erro programação` para defeito de código).
- `Custom.SR_BUG_ORIGIN` só aceita `Interno` ou `Mercado` (não existe "Suporte"/"Cliente"). Bug reportado por cliente → `Mercado`.

### Campos obrigatórios customizados (Azure DevOps - Projeto Wiipo)

Ao criar work items, os seguintes campos customizados são **obrigatórios** e devem ser incluídos no payload JSON Patch:

| Campo | Reference Name | Aplicável a | Valor padrão |
|-------|---------------|-------------|--------------|
| SR_ENTREGA | `Custom.SR_ENTREGA` | Epic, Feature, User Story, Bug | `Não informada` |
| SR_TEM_IMPACTO_LGPD | `Custom.SR_TEM_IMPACTO_LGPD` | Epic, Feature, User Story | `Não` (valores: `Sim` / `Não`) |
| SR_RELEASE | `Custom.SR_RELEASE` | Epic, Feature, User Story, Bug | `2026 R2` (valores: `2026 R1`–`R4`; atualizar conforme o semestre) |
| SR_TIPO_DE_DEMANDA | `Custom.SR_TIPO_DE_DEMANDA` | Epic | `Evolução tecnológica` (valores: `Sustentação`, `Exigência legal`, `Cobertura Funcional`, etc. — lista completa em `azure-devops-campos.md`) |
| SR_PACOTES | `Custom.SR_PACOTES` | Feature, User Story | `Não se aplica` |
| ValueArea | `Microsoft.VSTS.Common.ValueArea` | Epic, Feature, User Story, Bug | `Business` |
| Priority | `Microsoft.VSTS.Common.Priority` | Epic | `2` |
| SR_SYSTEM_TEAM | `Custom.SR_SYSTEM_TEAM` | Bug | `false` |
| SR_NATUREZA | `Custom.SR_NATUREZA` | Bug | `Erro programação` |

**Exemplo de patch document para Feature:**
```json
[
  { "op": "add", "path": "/fields/System.Title", "value": "..." },
  { "op": "add", "path": "/fields/System.Description", "value": "..." },
  { "op": "add", "path": "/fields/System.AreaPath", "value": "Wiipo\\{Time}" },
  { "op": "add", "path": "/fields/System.IterationPath", "value": "Wiipo\\{Time}\\{Sprint}" },
  { "op": "add", "path": "/fields/Custom.SR_ENTREGA", "value": "Não informada" },
  { "op": "add", "path": "/fields/Custom.SR_TEM_IMPACTO_LGPD", "value": "Não" },
  { "op": "add", "path": "/fields/Custom.SR_RELEASE", "value": "2026 R2" },
  { "op": "add", "path": "/fields/Custom.SR_PACOTES", "value": "Não se aplica" }
]
```

**Notas:**
- O `AreaPath` segue o padrão `Wiipo\\{NomeDoTime}` (ex: `Wiipo\\Holerite`, `Wiipo\\Plataforma`)
- O `IterationPath` segue o padrão `Wiipo\\{NomeDoTime}\\{NomeDaSprint}` (ex: `Wiipo\\Holerite\\Janela de Junho`)
- Para User Stories, incluir também `Microsoft.VSTS.Common.AcceptanceCriteria` com HTML formatado
- O vínculo pai é feito via `System.LinkTypes.Hierarchy-Reverse` com URL: `{orgUrl}/_apis/wit/workItems/{parentId}`

## Regras

- NUNCA faça um questionário longo — gere tudo automaticamente a partir do texto livre
- Se faltar informação crítica, faça NO MÁXIMO 2-3 perguntas pontuais
- O arquivo .md é a fonte de verdade — sempre salve antes de criar no Azure
- Cada demanda = 1 arquivo .md
- Nomes de pasta em kebab-case e lowercase

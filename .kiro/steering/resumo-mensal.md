---
inclusion: manual
---

# Resumo Mensal de Entregas — Apresentação

Quando o usuário pedir o resumo mensal de entregas, siga este fluxo:

## 1. Coletar parâmetros

Pergunte (se não fornecido):
- **Mês/Ano**: Qual mês e ano? (ex.: Maio/2026)
- **Time(s)**: Qual time? Ou "todos" para consolidar todos os times.
  - Times válidos: Plataforma, SuperApp, Beneficios, SRE, Migration, Mypass, Solucoes Financeiras, Holerite, Qualidade, Beneficios-Projetos

Se o usuário já informou no texto, não pergunte novamente.

---

## 2. Consulta ao Azure DevOps — dois caminhos obrigatórios

**Os arquivos locais em `demandas/` NÃO são fonte confiável de entregas finalizadas** — eles registram o que foi criado/documentado, não o que foi de fato entregue. A fonte de verdade é sempre o Azure DevOps.

Carregue do `.env`:
- `AZURE_DEVOPS_ORG_URL`
- `AZURE_DEVOPS_PAT`

Use um script Node.js temporário com o SDK `azure-devops-node-api` já instalado no projeto.

> **Atenção**: nas queries WIQL, use datas no formato `'YYYY-MM-DD'` (sem hora). O Azure DevOps rejeita datas com hora no campo `ClosedDate`.

### 2.1 Mapeamento de times → AreaPath

| Time | AreaPath |
|------|----------|
| Plataforma | `Wiipo\Plataforma` |
| Holerite | `Wiipo\Holerite` |
| SuperApp | `Wiipo\SuperApp` |
| SRE | `Wiipo\SRE` |
| Migration | `Wiipo\Migration` |
| Mypass | `Wiipo\Mypass` |
| Solucoes Financeiras | `Wiipo\Solucoes Financeiras` |
| Qualidade | `Wiipo\Qualidade` |
| Beneficios | `Wiipo\Beneficios` |
| Beneficios-Projetos | `Wiipo\Beneficios-Projetos` |

### 2.2 Calcular intervalo de datas do mês

- `startDate` = primeiro dia do mês (ex.: `2026-06-01`)
- `endDate` = último dia do mês (ex.: `2026-06-30`)

---

## 3. Caminho 1 — Cards de Deploy do SRE + vínculos

Busque todos os cards de `WorkItemType = Deploy` na `AreaPath Wiipo\SRE` com `ClosedDate` dentro do mês solicitado.

```wiql
SELECT [System.Id], [System.Title], [System.State],
       [Microsoft.VSTS.Common.ClosedDate], [System.Tags]
FROM WorkItems
WHERE [System.AreaPath] UNDER 'Wiipo\SRE'
  AND [System.WorkItemType] = 'Deploy'
  AND [Microsoft.VSTS.Common.ClosedDate] >= '{startDate}'
  AND [Microsoft.VSTS.Common.ClosedDate] <= '{endDate}'
ORDER BY [Microsoft.VSTS.Common.ClosedDate] DESC
```

Para cada card retornado, busque com `WorkItemExpand.Relations` (valor `4`) para obter os **work items vinculados**. Filtre apenas os vínculos cujo `AreaPath` pertence ao(s) time(s) solicitados (ex.: `Wiipo\Holerite`, `Wiipo\Plataforma`).

Esses itens vinculados = **entregues via SRE**.

### 3.1 Previsto para deploy (cards SRE ainda abertos)

Busque também os cards de Deploy do SRE que **não estão fechados** (State NOT IN Closed/Done/Resolved/Removed) e repita o mesmo processo de vínculos. Esses itens vinculados = **previstos para deploy**.

```wiql
SELECT [System.Id], [System.Title], [System.State], [System.Tags]
FROM WorkItems
WHERE [System.AreaPath] UNDER 'Wiipo\SRE'
  AND [System.WorkItemType] = 'Deploy'
  AND [System.State] NOT IN ('Closed', 'Done', 'Resolved', 'Removed')
ORDER BY [System.ChangedDate] DESC
```

---

## 4. Caminho 2 — ClosedDate direto nos times

Busque diretamente nos times solicitados todos os work items finalizados no mês, independentemente de terem card SRE vinculado. Isso garante que entregas sem vínculo no SRE não sejam perdidas.

```wiql
SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State],
       [Microsoft.VSTS.Common.ClosedDate], [System.AreaPath]
FROM WorkItems
WHERE [System.AreaPath] UNDER '{AreaPath}'
  AND [System.WorkItemType] IN ('Epic', 'Feature', 'User Story')
  AND [System.State] IN ('Done', 'Closed', 'Resolved')
  AND [Microsoft.VSTS.Common.ClosedDate] >= '{startDate}'
  AND [Microsoft.VSTS.Common.ClosedDate] <= '{endDate}'
ORDER BY [System.WorkItemType] ASC, [Microsoft.VSTS.Common.ClosedDate] DESC
```

Execute para cada AreaPath dos times solicitados.

---

## 5. Mesclar os dois caminhos

Combine os resultados dos Caminhos 1 e 2, **deduplicando por ID**:

1. Adicione todos os itens do Caminho 2 (ClosedDate direto)
2. Adicione/sobrescreva com os itens do Caminho 1 (via SRE) — são a fonte mais confiável
3. Itens que aparecem nos dois caminhos = fonte `SRE + Direct` (registre na tabela de referências)
4. Itens apenas no Caminho 1 = fonte `SRE`
5. Itens apenas no Caminho 2 = fonte `Direct`

> Itens do Caminho 1 e 2 que aparecem apenas em um dos caminhos indicam oportunidade de melhoria no vínculo dos cards no Azure DevOps.

---

## 6. Hierarquia e filtragem

Após mesclar, aplique:

1. **Hierarquia**: prefira o nível mais alto disponível — Epic > Feature > User Story. Se um Epic foi fechado, não liste separadamente as Features/USs filhas dele.
2. **Exceção**: se uma Feature ou US pertence a um Epic ainda aberto, inclua mesmo assim.
3. **Filtragem**: omita itens puramente técnicos sem valor de negócio visível (mocks, ajustes de env, sustentação interna de CI/CD, migrations de banco sem impacto ao usuário), a menos que o usuário peça explicitamente.

---

## 7. Gerar o resumo

Para cada item entregue, gere **1 bullet** no estilo da apresentação mensal:
- Linguagem de negócio, não técnica
- Máximo ~60 caracteres por bullet (cabe num slide)
- Foco no valor entregue ao usuário/cliente
- Sem jargões de engenharia (sem "refactor", "fix", "merge", "DLQ", "WIQL", "payload", "runtime", etc.)
- Use o título do **Epic** como base (ou Feature se não houver Epic)

**Exemplos de transformação:**

| Título original | Resumo para slide |
|---|---|
| Corrigir visualização de holerite para colaboradores vinculados a mais de uma empresa | Visualização de holerite para quem tem mais de uma empresa |
| Reprocessamento correto do payslip quando o arquivo do HCM é atualizado | Reprocessamento de holerite ao atualizar dados no HCM |
| Robustez da fila de processamento do tenant — retry, mapeamento de erros e DLQ | Fila de processamento mais resiliente a erros |
| Backend: seleção manual e em lote para envio de push | Envio de push por seleção manual e em lote |
| Cadastro de tipos de funcionário complementares por cliente na integração HCM Senior | Suporte a tipos de funcionário adicionais no HCM |

---

## 8. Buscar "O que vem por aí" (próximo trimestre)

Busque Epics e Features ainda em aberto nos times solicitados:

```wiql
SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State],
       [System.IterationPath], [System.BoardColumn]
FROM WorkItems
WHERE [System.AreaPath] UNDER '{AreaPath}'
  AND [System.WorkItemType] IN ('Epic', 'Feature')
  AND [System.State] NOT IN ('Closed', 'Removed', 'Done', 'Resolved')
ORDER BY [System.WorkItemType] ASC, [System.ChangedDate] DESC
```

Priorize na ordem:
1. `State = Active` ou `BoardColumn = Em Andamento` — já em execução
2. `State = Review` ou `BoardColumn = Validar/Testar` — quase prontos
3. Epics/Features estratégicos com iteração definida (não apenas `Wiipo` genérico)

Mesmas regras de linguagem do passo 7.

---

## 9. Apresentar o resultado

Formato de saída:

```
## Principais Entregas — {Mês} {Ano}

### {Time}
- {Resumo 1}
- {Resumo 2}

---

## Previsto para Deploy

### {Time}
- {Item previsto 1}

---

## O que vem por aí — {Próximo Trimestre}

### {Time}
- {Resumo futuro 1}
```

- Se apenas um time, omita o cabeçalho de time
- A seção "Previsto para Deploy" só aparece se houver cards SRE abertos com vínculos relevantes
- A seção "O que vem por aí" sempre aparece

Ao final, pergunte: "Quer ajustar algum texto ou incluir/excluir alguma entrega?"

---

## 10. Ajustes (se solicitado)

Refaça apenas a linha solicitada e apresente novamente.

---

## 11. Salvar o arquivo de entrega mensal

Salve em:

```
entregas-mensais/{time-em-kebab-case}/{YYYY-MM-nomemes}.md
```

Mapeamento time → pasta:

| Time | Pasta |
|------|-------|
| Plataforma | `plataforma` |
| Holerite | `holerite` |
| SuperApp | `superapp` |
| SRE | `sre` |
| Migration | `migration` |
| Mypass | `mypass` |
| Solucoes Financeiras | `solucoes-financeiras` |
| Qualidade | `qualidade` |
| Beneficios | `beneficios` |
| Beneficios-Projetos | `beneficios-projetos` |
| Todos (consolidado) | `todos` |

Formato do arquivo:

```markdown
# Entregas Mensais — {Time} | {Mês} {Ano}

> Gerado em: {data}
> Fonte: Azure DevOps — combinação de cards SRE (vínculos) + ClosedDate direto

---

## Principais Entregas

### {Time}
- {bullet 1}

---

## Previsto para Deploy

### {Time}
- {bullet deploy 1}

---

## O que vem por aí — {Próximo Trimestre}

### {Time}
- {bullet futuro 1}

---

## Referências Azure DevOps

### Entregues em {Mês}

| Item | ID | Tipo | Fonte | Time |
|---|---|---|---|---|
| {título} | [#{id}]({url}) | Epic/Feature/US | SRE / Direct / SRE+Direct | {Time} |

### Previsto para Deploy

| Item | ID | Tipo | Time |
|---|---|---|---|
| {título} | [#{id}]({url}) | US/Bug | {Time} |
```

A coluna **Fonte** na tabela de referências indica:
- `SRE` — encontrado via vínculo em card de Deploy do SRE
- `Direct` — encontrado via ClosedDate direto no time (sem card SRE vinculado)
- `SRE + Direct` — aparece nos dois caminhos (vínculo correto)

---

## Regras

- **NUNCA invente entregas** — use apenas o que veio do Azure DevOps
- **Arquivos locais `demandas/`** são para documentação/referência, não são fonte de entregas finalizadas
- Se não encontrar nada no Azure DevOps, informe: "Não encontrei entregas finalizadas para {time} em {mês}."
- O resumo é para slides — conciso, direto, orientado a valor de negócio
- Sempre salve o arquivo após o usuário validar o conteúdo
- Ao usar `ClosedDate` em WIQL, use formato `'YYYY-MM-DD'` sem hora (o Azure rejeita com hora nesse campo)

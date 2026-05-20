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

## 2. Fonte primária — arquivos locais

Leia todos os arquivos `.md` em `demandas/` recursivamente.

Critérios para considerar uma demanda como **finalizada no mês**:
- Campo `**Status**` contém `Criado no Azure DevOps` (ou variações: `Concluído`, `Done`, `Finalizado`)
- Campo `**Sprint**` contém o mês solicitado (ex.: "Abril", "Maio") **ou** `**Data de conclusão**` cai dentro do mês/ano
- Se filtrado por time, o campo `**Time**` deve bater

> Dica: sprints como "Sprint - Abril" ou "Janela de Abril" — extraia o mês do nome para comparar.

Se encontrar demandas locais para o mês/time solicitado, vá direto para o **passo 4**.

---

## 3. Fallback — consulta ao Azure DevOps (quando não há arquivos locais)

Se **não encontrar nenhum arquivo local** para o mês/time solicitado, consulte o Azure DevOps via API.

### 3.1 Credenciais

Carregue do `.env`:
- `AZURE_DEVOPS_ORG_URL`
- `AZURE_DEVOPS_PAT`

### 3.2 Mapeamento de times → AreaPath

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

### 3.3 Calcular intervalo de datas do mês

A partir do mês/ano solicitado, calcule:
- `startDate` = primeiro dia do mês (ex.: 2026-04-01)
- `endDate` = último dia do mês (ex.: 2026-04-30)

### 3.4 Executar WIQL via script Node.js inline

Use um script Node.js inline (via `node -e` ou arquivo temporário) com o SDK `azure-devops-node-api` já instalado no projeto para executar a seguinte query WIQL:

```wiql
SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State],
       [System.AreaPath], [Microsoft.VSTS.Common.ClosedDate],
       [System.ChangedDate], [System.IterationPath]
FROM WorkItems
WHERE [System.AreaPath] UNDER '{AreaPath}'
  AND [System.WorkItemType] IN ('Epic', 'Feature', 'User Story')
  AND [System.State] IN ('Done', 'Closed', 'Resolved')
  AND [Microsoft.VSTS.Common.ClosedDate] >= '{startDate}T00:00:00Z'
  AND [Microsoft.VSTS.Common.ClosedDate] <= '{endDate}T23:59:59Z'
ORDER BY [System.WorkItemType] ASC, [Microsoft.VSTS.Common.ClosedDate] DESC
```

Substitua `{AreaPath}`, `{startDate}` e `{endDate}` com os valores calculados.

### 3.5 Hierarquia de prioridade dos resultados

O Azure DevOps pode retornar Epics, Features e User Stories finalizados no mesmo mês. Para evitar duplicidade no resumo, aplique esta lógica:

1. **Se há Epics finalizados** → use apenas os Epics (eles representam o maior valor entregue)
2. **Se não há Epics, mas há Features** → use as Features
3. **Se não há Epics nem Features, mas há User Stories** → agrupe as USs por tema/assunto e gere 1 bullet por grupo temático (não liste cada US individualmente)

> Exceção: se uma Feature ou US pertence a um Epic que **não** foi finalizado no mês (Epic ainda aberto), inclua a Feature/US mesmo assim — ela representa entrega parcial relevante.

### 3.6 Enriquecer com contexto

Para cada Epic ou Feature retornado, leia a descrição completa via `getWorkItem` para ter contexto suficiente para gerar o resumo de negócio.

---

## 4. Gerar o resumo

Para cada item finalizado (local ou do Azure DevOps), gere **1 bullet** no estilo da apresentação mensal:
- Linguagem de negócio, não técnica
- Máximo ~60 caracteres por bullet (cabe num slide)
- Foco no valor entregue ao usuário/cliente, não na implementação
- Sem jargões de engenharia (sem "refactor", "fix", "merge", "DLQ", "WIQL", "payload", etc.)
- Use o título do **Epic** (ou Feature, se não houver Epic) como base, simplificando quando necessário

**Exemplos de transformação:**

| Título original | Resumo para slide |
|---|---|
| Robustez da fila de processamento do tenant — retry, mapeamento de erros e DLQ | Fila de processamento mais resiliente a erros |
| Cadastro de tipos de funcionário complementares por cliente na integração HCM Senior | Suporte a tipos de funcionário adicionais no HCM |
| Discovery — Atualização dos dashboards de holerite com delay menor que 1 semana | Discovery: redução de delay nos dashboards de holerite |
| Backend: seleção manual e em lote para envio de push | Envio de push por seleção manual e em lote |
| Correção no merge do getEmployee no payslip processing | Correção no processamento de holerite |

---

## 5. Buscar "O que vem por aí" (próximo trimestre)

Além das entregas do mês, busque no Azure DevOps o que está planejado para os próximos meses.

### 5.1 Query WIQL para itens futuros

```wiql
SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State],
       [System.IterationPath], [System.BoardColumn]
FROM WorkItems
WHERE [System.AreaPath] UNDER '{AreaPath}'
  AND [System.WorkItemType] IN ('Epic', 'Feature')
  AND [System.State] NOT IN ('Closed', 'Removed', 'Done', 'Resolved')
ORDER BY [System.WorkItemType] ASC, [System.ChangedDate] DESC
```

### 5.2 Filtrar o que é relevante para "próximo trimestre"

Dos resultados, priorize nesta ordem:
1. Epics/Features com `State = Active` ou `BoardColumn = Em Andamento` — já em execução, entregam em breve
2. Epics/Features com `State = Review` ou `BoardColumn = Validar/Testar` — quase prontos
3. Epics estratégicos com `State = New` e `BoardColumn = Backlog` que tenham iteração definida (não apenas `Wiipo` genérico)

Ignore itens puramente técnicos/sustentação sem valor de negócio visível para o slide (ex.: ajustes de CI/CD, limpeza de débito técnico, estudos de viabilidade internos) — a menos que o usuário peça para incluir.

### 5.3 Gerar bullets "O que vem por aí"

Mesmas regras de linguagem: negócio, ~60 chars, sem jargão técnico.

---

## 6. Apresentar o resultado

Organize por time (se "todos" foi solicitado) ou liste direto (se um time específico).

Formato de saída:

```
## Principais Entregas — {Mês} {Ano}

**Fechado no mês:**
- {Resumo 1}
- {Resumo 2}

**Previsto para deploy:**
- {Item na fila de deploy 1}
- {Item na fila de deploy 2}

---

## O que vem por aí — {Próximo Trimestre}

- {Resumo futuro 1}
- {Resumo futuro 2}
- {Resumo futuro N}
```

Se apenas um time foi solicitado, omita o cabeçalho de time e liste direto os bullets.

A seção "Previsto para deploy" só aparece se houver itens na coluna Deploy (passo 4 do fluxo).
A seção "O que vem por aí" sempre aparece, com base nos Epics/Features ativos.

Indique a fonte ao final: `(fonte: arquivos locais)` ou `(fonte: Azure DevOps — {N} itens encontrados)`.

Ao final, pergunte:
- "Quer ajustar algum texto ou incluir/excluir alguma entrega?"

---

## 6. Ajustes (se solicitado)

Se o usuário pedir ajuste de texto, refaça apenas a linha solicitada e apresente novamente.

Se o usuário pedir para incluir uma entrega que não estava nos resultados, adicione com o texto que ele fornecer.

---

## 7. Salvar o arquivo de entrega mensal

Após gerar e validar o resumo com o usuário, salve o resultado em:

```
entregas-mensais/{time-em-kebab-case}/{YYYY-MM-nomemes}.md
```

A pasta raiz `entregas-mensais/` é organizada **por time**, cada time tem sua própria subpasta:

```
entregas-mensais/
  plataforma/
    2026-04-abril.md
    2026-05-maio.md
  holerite/
    2026-05-maio.md
  superapp/
    2026-05-maio.md
  sre/
    2026-05-maio.md
  todos/
    2026-05-maio.md   ← consolidado quando time = "todos"
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
| Todos | `todos` |

Formato do arquivo:

```markdown
# Entregas Mensais — {Time} | {Mês} {Ano}

> Gerado em: {data}
> Fonte: Azure DevOps ({AreaPath}) ou arquivos locais

---

## Principais Entregas

- {bullet 1}
- {bullet 2}

---

## Previsto para Deploy

- {bullet deploy 1}
- {bullet deploy 2}

> Cards na coluna Deploy: #{id}, #{id}

---

## O que vem por aí — {Próximo Trimestre}

- {bullet futuro 1}
- {bullet futuro 2}

---

## Referências Azure DevOps

| Item | ID | Tipo |
|------|-----|------|
| {título} | [#{id}]({url}) | Epic/Feature |
```

A seção "Previsto para Deploy" só aparece se houver itens na coluna Deploy.
A seção de referências só aparece quando a fonte for Azure DevOps.

---

## Regras

- NUNCA invente entregas — use apenas o que está nos arquivos `.md` ou no Azure DevOps
- Se não encontrar nada nem localmente nem no Azure DevOps, informe: "Não encontrei entregas finalizadas para {time} em {mês}."
- O resumo é para slides — seja conciso, direto e orientado a valor de negócio
- Demandas com `**Status**` = `Pendente aprovação` **não** entram no resumo
- Deploys (SRE) podem entrar se o usuário quiser — pergunte se deve incluir deploys no resumo
- Ao usar o fallback do Azure DevOps, prefira sempre o nível mais alto da hierarquia (Epic > Feature > US) para evitar lista longa e repetitiva
- Sempre salve o arquivo de entrega mensal após o usuário validar o conteúdo

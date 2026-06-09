---
inclusion: manual
---

# Overview para Sync de Produto — O que os times estão trabalhando

Quando o usuário pedir um **overview para a sync de produto** (ex.: "o que o time está trabalhando", "monta o que temos em andamento pra sync"), siga este fluxo. O foco é o trabalho **em andamento agora** na sprint corrente — diferente do `resumo-mensal`, que trata de entregas **finalizadas**.

## 1. Coletar parâmetros

Pergunte apenas o que faltar:

- **Data da sync**: qual dia? Default = hoje. Usada para nomear a pasta de saída.
- **Time(s)**: quais times? Default = `Plataforma` e `Holerite`.
  - Times válidos: Plataforma, SuperApp, Beneficios, SRE, Migration, Mypass, Solucoes Financeiras, Holerite, Qualidade, Beneficios-Projetos.

Se o usuário já informou no texto, não pergunte de novo.

---

## 2. Fonte primária — Azure DevOps ao vivo

O overview reflete o **estado atual do board**, então sempre consulte o Azure DevOps (não os arquivos locais). Use o script já pronto:

```bash
npx tsx scripts/overview-sync-em-andamento.ts --json
# ou para times específicos:
npx tsx scripts/overview-sync-em-andamento.ts --teams Plataforma,Holerite --json
```

O script, para cada time:
1. Descobre a **iteration corrente** (`TimeFrame = Current`) do time — pode ter nome diferente entre times (ex.: "Sprint - Maio" no Plataforma, "Janela de Junho" no Holerite) e pode não bater com o mês do calendário (uma sprint pode atravessar dois meses).
2. Lista os work items dessa iteration que **não** estão em `Done`, `Closed`, `Removed` ou `Resolved` — ou seja, o trabalho em andamento.
3. Retorna, por item: `id`, `type`, `state`, `column` (coluna do board), `assignedTo`, `title` e `parent`.

> Use o `--json` para parsear; rode sem `--json` se quiser conferir no terminal de forma legível.

### Credenciais

Carregadas do `.env` pelo próprio script:
- `AZURE_DEVOPS_ORG_URL`
- `AZURE_DEVOPS_PAT`

### Mapeamento de times → AreaPath (referência)

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

---

## 3. Organizar o overview por estágio do board

Agrupe os itens pelo estágio em que estão, do mais avançado ao menos avançado. Use `column` (coluna do board) como guia, com `state` como apoio. Estágios típicos:

| Estágio (título no overview) | Colunas/estados que caem aqui |
|------------------------------|-------------------------------|
| **Em desenvolvimento** | `Em Desenvolvimento`, `Em Andamento`, `Active` |
| **Em review (quase pronto)** | `Review` |
| **Em teste / QA** | `Test` |
| **Na fila (To Do)** | `To Do`, `Ready` |
| **Backlog da sprint (ainda não iniciado)** | `Backlog`, `New` |

Regras de organização:
- Mostre **um item por linha**: `#id Título — Responsável`. Itens sem responsável: marque como `— sem responsável`.
- Quando um conjunto de User Stories pertence ao mesmo Epic/Feature (mesmo `parent`) e está no mesmo estágio, **agrupe sob o Epic/Feature** e resuma (ex.: "5 US em review sob o Epic WhatsApp/Wiizap #2969") em vez de listar cada uma.
- Por time, comece com um cabeçalho informando a iteration corrente e o período (`startDate → endDate`), além do total em andamento.
- Se um time não tem nada em andamento, diga explicitamente.

---

## 4. Linguagem

Diferente do `resumo-mensal` e da news, o overview de sync é **interno e técnico** — a audiência é o time de produto/engenharia. Então:
- Pode manter IDs do Azure DevOps (`#1234`) e nomes de responsáveis — ajuda a sync.
- Pode usar termos técnicos quando forem o nome real do card.
- Mantenha cada linha enxuta: título do card (simplificado se for muito longo) + responsável.
- Não invente status nem responsáveis — use só o que o script retornar.

---

## 5. Apresentar o resultado

Formato de saída (markdown), por time:

```
## {Time} — {Iteration} ({início} → {fim}) · {N} itens ativos

**Em desenvolvimento**
- #{id} {título} — {responsável}

**Em review (quase pronto)**
- #{id} {título} — {responsável}

**Em teste / QA**
- #{id} {título} — {responsável}

**Na fila (To Do)**
- #{id} {título} — {responsável}

**Backlog da sprint (ainda não iniciado)**
- {Epic/tema} (#{id}) — {1 linha}
```

Omita os estágios que não tiverem nenhum item. Inclua observações relevantes ao final (ex.: "a iteration corrente do Plataforma ainda é a de Maio, vai até 17/06").

---

## 6. Salvar o arquivo

Após apresentar e validar com o usuário, salve em:

```
comunicacao/sync/{DD-MM-AAAA}/overview-sync.md
```

- A pasta usa a **data da sync** no formato `DD-MM-AAAA` (ex.: hoje → `comunicacao/sync/01-06-2026/`).
- Crie a pasta `comunicacao/sync/{DD-MM-AAAA}/` se não existir.
- Se a sync cobrir só um time, pode nomear o arquivo `overview-sync-{time-kebab}.md` para conviver com outros times na mesma data.

Estrutura do arquivo:

```markdown
# Overview Sync de Produto — {DD/MM/AAAA}

> Time(s): {lista}
> Gerado em: {data}
> Fonte: Azure DevOps (iterations correntes)

---

{Corpo do overview da seção 5, por time}

---

## Observações

- {ponto de atenção sobre sprint/iteration, bloqueios, etc.}
```

---

## Regras

- **Sempre consultar o Azure DevOps ao vivo** — o overview é um retrato do board no momento da sync.
- **Nunca inventar** itens, estados ou responsáveis — use só o retorno do script.
- A iteration corrente de cada time pode ter nome próprio e atravessar meses; **não assuma** que "sprint atual" = mês do calendário. Confie no `TimeFrame = Current`.
- Prefira **agrupar User Stories sob o Epic/Feature** quando estiverem no mesmo estágio, para não poluir a sync.
- Mantenha o overview enxuto o suficiente para caber em um slide ou em 2 minutos de fala por time.
- Salve o arquivo em `comunicacao/sync/{DD-MM-AAAA}/` após validar o conteúdo com o usuário.

# PM Wiipo — Kit de ferramentas de PM com Kiro

Conjunto de steerings e scripts integrados ao Kiro para automatizar o trabalho de PM no Azure DevOps da Wiipo. Vai desde a criação de demandas (Epic → Feature → User Stories) até higiene de board, deploy para o SRE, resumo mensal de entregas e comunicação semanal — tudo direto do chat da IDE.

## Steerings disponíveis

Use `#nome-do-steering` no chat do Kiro para acionar cada fluxo:

| Steering | O que faz |
|----------|-----------|
| `#criar-demanda` | Gera hierarquia Epic → Feature → User Stories a partir de texto livre e cria os work items no Azure DevOps |
| `#sre-demanda` | Cria chamado padronizado de Deploy para o time SRE |
| `#agile` | Higiene de board: encerra o que subiu a produção, organiza o que está em andamento (Plataforma e Holerite) |
| `#resumo-mensal` | Gera apresentação de resumo mensal de entregas por time |
| `#sync-produto` | Monta overview do que os times estão trabalhando agora para a sync de produto |
| `#wiipo-comms` | Gera a News Semanal do Wiiportal (newsletter interna de Plataforma/Holerite) |
| `#redator-wiki` | Produz página de Wiki padronizada a partir de uma funcionalidade descrita |
| `#azure-devops-campos` | Referência dos campos por tipo de work item no projeto Wiipo |
| `#git-remote` | Contexto fixo de remote e autenticação deste repositório |

## Como funciona o `#criar-demanda`

No chat do Kiro, use o steering `#criar-demanda` e descreva o que precisa ser feito. O Kiro:

1. **Coleta contexto** — pergunta time e sprint (se não informados)
2. **Gera a hierarquia** — cria automaticamente Epic, Feature e User Stories com critérios de aceitação
3. **Salva o arquivo** — persiste em `demandas/{time}/{nome-da-demanda}.md`
4. **Apresenta para revisão** — mostra a hierarquia e pergunta se quer ajustar algo
5. **Cria no Azure DevOps** — após aprovação, cria os work items com vínculos pai-filho

**Exemplo:**

```
#criar-demanda

Preciso que o time de holerite consuma o novo campo codcli que a plataforma
já disponibilizou no retorno da API. Sprint: Janela de Junho.
```

O Kiro gera automaticamente a hierarquia e salva em `demandas/holerite/consumir-codcli-listagem-holerites.md`.

## Pré-requisitos

- **Kiro** instalado como IDE
- Acesso a uma organização Azure DevOps com um **Personal Access Token (PAT)** com permissão de leitura/escrita em Work Items

## Configuração

```bash
cp .env.example .env
```

Edite o `.env`:

```env
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/sua-organizacao
AZURE_DEVOPS_PAT=seu-personal-access-token
```

## Times disponíveis

- Plataforma
- SuperApp
- Beneficios
- SRE
- Migration
- Mypass
- Solucoes Financeiras
- Holerite
- Qualidade
- Beneficios-Projetos

## Campos customizados (Azure DevOps - Projeto Wiipo)

Ao criar work items, os seguintes campos customizados são incluídos automaticamente:

| Campo | Aplicável a | Valor padrão |
|-------|-------------|--------------|
| `Custom.SR_ENTREGA` | Epic, Feature, US | `Não informada` |
| `Custom.SR_TEM_IMPACTO_LGPD` | Epic, Feature, US | `Não` |
| `Custom.SR_RELEASE` | Epic, Feature, US | `2026 R2` |
| `Custom.SR_TIPO_DE_DEMANDA` | Epic | `Evolução tecnológica` |
| `Custom.SR_PACOTES` | Feature, US | `Não se aplica` |

## Estrutura do projeto

```
pm_wiipo/
├── .kiro/
│   └── steering/
│       ├── criar-demanda.md        # Criação de demandas (Epic → Feature → US)
│       ├── sre-demanda.md          # Chamados de deploy para o SRE
│       ├── agile.md                # Higiene de board (Plataforma e Holerite)
│       ├── resumo-mensal.md        # Resumo mensal de entregas
│       ├── sync-produto.md         # Overview para sync de produto
│       ├── wiipo-comms.md          # News Semanal do Wiiportal
│       ├── redator-wiki.md         # Documentação de funcionalidades na Wiki
│       ├── azure-devops-campos.md  # Referência de campos do Azure DevOps
│       └── git-remote.md           # Contexto de remote e autenticação
├── src/
│   ├── index.ts                    # Entry point
│   ├── application/
│   │   ├── orchestrator.ts         # Coordena o fluxo de criação de demandas
│   │   ├── pm-skill.ts             # Lógica de refinamento
│   │   ├── work-item-generator.ts  # Geração da hierarquia
│   │   └── deploy-board-collector.ts  # Varredura da raia Deploy do board
│   ├── domain/
│   │   ├── models.ts               # Modelos de domínio
│   │   ├── types.ts                # Tipos auxiliares
│   │   ├── hierarchy-builder.ts    # Construção da hierarquia
│   │   ├── hierarchy-template-engine.ts  # Templates e ajustes
│   │   ├── html-formatter.ts       # Formatação HTML para descriptions
│   │   ├── invest-validation.ts    # Validação INVEST das stories
│   │   ├── question-templates.ts   # Perguntas do refinamento
│   │   ├── feature-analysis.ts     # Análise de features
│   │   ├── github-pr-extractor.ts  # Extração de URLs de PR do GitHub
│   │   ├── security.ts             # Sanitização de PAT em logs
│   │   └── errors.ts               # Erros de domínio
│   ├── infrastructure/
│   │   ├── azure-devops-client.ts  # Client da API Azure DevOps
│   │   └── config-manager.ts       # Carregamento de .env
│   └── presentation/
│       └── cli.ts                  # Interface interativa (fallback)
├── scripts/                        # Scripts utilitários avulsos
│   ├── create-*.ts                 # Criação de demandas específicas
│   ├── create-sre-deploy*.ts       # Criação de chamados SRE
│   ├── agile-higiene-board.ts      # Higiene de board via script
│   ├── close-demandas-de-deploys-fechados.ts
│   ├── dump-deploy-details.ts      # Dump de detalhes de deploys
│   ├── introspect-*.ts             # Introspecção da API Azure DevOps
│   ├── list-plataforma-em-andamento.ts
│   ├── move-plataforma-to-junho.ts
│   ├── overview-sync-em-andamento.ts
│   ├── query-sre-deploys-abril-maio.ts
│   ├── report-sre-demandas-abertas-plataforma-holerite.ts
│   ├── run-deploy-collector.ts
│   ├── validate-entregas-semana-0106.ts
│   └── validate-last-comment-pr.ts
├── demandas/                       # Demandas geradas (.md) — no .gitignore
├── entregas-mensais/               # Resumos mensais por time — no .gitignore
├── documentacao/                   # Documentação e wikis geradas — no .gitignore
│   ├── wiki/
│   ├── sync/
│   └── release/
├── comunicacao/                    # Comunicações geradas — no .gitignore
│   ├── news-semanal/
│   └── sync/
├── tests/
│   ├── unit/
│   ├── property/
│   └── integration/
├── .env.example
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run build` | Compila TypeScript para `dist/` |
| `npm test` | Roda todos os testes |
| `npm run test:unit` | Roda apenas testes unitários |
| `npm run test:property` | Roda apenas testes de propriedade |
| `npm run test:integration` | Roda apenas testes de integração |

## Tecnologias

- **TypeScript** — linguagem principal
- **azure-devops-node-api** — client oficial da API Azure DevOps
- **dotenv** — carregamento de variáveis de ambiente
- **vitest** — framework de testes
- **fast-check** — testes de propriedade

## Licença

MIT

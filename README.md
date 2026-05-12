# PM Wiipo — Criação de Demandas via Kiro

Ferramenta integrada ao Kiro para criação automatizada de work items no Azure DevOps. Transforma uma descrição em texto livre em uma hierarquia completa de **Epic → Feature → User Stories**, com critérios de aceitação, e cria tudo no Azure DevOps com os vínculos corretos — tudo direto do chat da IDE.

## Como funciona

No chat do Kiro, use o steering `#criar-demanda` e descreva o que precisa ser feito. O Kiro:

1. **Coleta contexto** — pergunta time, sprint (se não informados) e usa a descrição fornecida
2. **Gera a hierarquia** — cria automaticamente Epic, Feature e User Stories com critérios de aceitação
3. **Salva o arquivo** — persiste em `demandas/{time}/{nome-da-demanda}.md`
4. **Apresenta para revisão** — mostra a hierarquia e pergunta se quer ajustar algo
5. **Cria no Azure DevOps** — após aprovação, cria os work items com vínculos pai-filho

## Exemplo de uso

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

Copie o arquivo de exemplo e preencha com suas credenciais:

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

## Formato das demandas geradas

Cada demanda é salva como Markdown em `demandas/{time}/{nome}.md` com:

- **Epic** — título e descrição
- **Feature** — título e descrição
- **User Stories** — título, descrição no formato "Como X, eu quero Y, para que Z" e critérios de aceitação testáveis
- **Metadata** — time, status, sprint e IDs/URLs dos work items criados

## Campos customizados (Azure DevOps - Projeto Wiipo)

Ao criar work items, os seguintes campos customizados são incluídos automaticamente:

| Campo | Aplicável a | Valor padrão |
|-------|-------------|--------------|
| `Custom.SR_ENTREGA` | Epic, Feature, US | `Não informada` |
| `Custom.SR_TEM_IMPACTO_LGPD` | Epic, Feature, US | `Não` |
| `Custom.SR_RELEASE` | Epic, Feature, US | `2026 R1` |
| `Custom.SR_TIPO_DE_DEMANDA` | Epic | `Evolução tecnológica` |
| `Custom.SR_PACOTES` | Feature, US | `Não se aplica` |

## Estrutura do projeto

```
pm_wiipo/
├── .kiro/
│   └── steering/
│       └── criar-demanda.md        # Steering que orquestra o fluxo
├── src/
│   ├── index.ts                    # Entry point
│   ├── application/
│   │   ├── orchestrator.ts         # Coordena o fluxo completo
│   │   ├── pm-skill.ts             # Lógica de refinamento
│   │   └── work-item-generator.ts  # Geração da hierarquia
│   ├── domain/
│   │   ├── models.ts               # Modelos de domínio
│   │   ├── types.ts                # Tipos auxiliares
│   │   ├── hierarchy-builder.ts    # Construção da hierarquia
│   │   ├── hierarchy-template-engine.ts  # Templates e ajustes
│   │   ├── html-formatter.ts       # Formatação HTML para descriptions
│   │   ├── invest-validation.ts    # Validação INVEST das stories
│   │   ├── question-templates.ts   # Perguntas do refinamento
│   │   ├── feature-analysis.ts     # Análise de features
│   │   ├── security.ts             # Sanitização de PAT em logs
│   │   └── errors.ts               # Erros de domínio
│   ├── infrastructure/
│   │   ├── azure-devops-client.ts  # Client da API Azure DevOps
│   │   └── config-manager.ts       # Carregamento de .env
│   └── presentation/
│       └── cli.ts                  # Interface interativa (fallback)
├── demandas/                       # Demandas geradas (.md)
│   ├── holerite/
│   └── plataforma/
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

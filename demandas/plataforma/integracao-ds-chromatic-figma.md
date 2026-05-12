# Integração do Design System com Chromatic e Figma

## Epic

**Título:** Integração do Design System com Chromatic e Figma

**Descrição:**
Investigar e implementar a integração do Design System (DS) existente no Figma com o Chromatic/Storybook, permitindo que os componentes do DS sejam importados, documentados e testados visualmente de forma automatizada. O objetivo é criar uma ponte entre design e desenvolvimento, garantindo consistência visual e acelerando o handoff.

---

## Feature

**Título:** Pipeline de importação do Design System Figma → Storybook + Chromatic

**Descrição:**
Criar um fluxo que conecte os componentes do Design System no Figma ao Storybook publicado no Chromatic, utilizando o plugin "Storybook Connect" para vincular variantes do Figma às stories correspondentes. Inclui a avaliação do Chromatic como ferramenta de visual regression testing e documentação viva do DS.

---

## User Stories

### US1: Avaliação do Chromatic para o DS

**Descrição:** Como Tech Lead, eu quero avaliar o Chromatic como ferramenta de visual testing e documentação do Design System, para que possamos decidir se atende às necessidades do time.

**Critérios de Aceitação:**
1. Documento de avaliação criado com prós/contras do Chromatic (planos, limites de snapshots, integração com CI)
2. POC publicada no Chromatic com pelo menos 3 componentes do DS atual
3. Comparação de custo vs. benefício documentada
4. Decisão go/no-go registrada com justificativa

---

### US2: Setup do Storybook para o Design System

**Descrição:** Como desenvolvedor front-end, eu quero ter o Storybook configurado com os componentes do Design System, para que cada componente tenha uma story documentada e testável.

**Critérios de Aceitação:**
1. Storybook configurado no repositório do DS com suporte ao framework utilizado (React/Vue/etc.)
2. Pelo menos os componentes base (Button, Input, Typography, Card) possuem stories criadas
3. Stories incluem variantes (tamanhos, estados, temas) conforme definido no Figma
4. Build do Storybook roda sem erros no CI

---

### US3: Publicação no Chromatic com visual testing

**Descrição:** Como desenvolvedor, eu quero que o Storybook seja publicado automaticamente no Chromatic a cada PR, para que mudanças visuais sejam detectadas antes do merge.

**Critérios de Aceitação:**
1. Chromatic integrado ao pipeline de CI (GitHub Actions ou Azure Pipelines)
2. Cada PR gera um build no Chromatic com snapshots dos componentes
3. Mudanças visuais são sinalizadas como "pending review" no PR
4. Baseline de snapshots aprovada para o estado atual do DS

---

### US4: Conexão Figma ↔ Storybook via plugin Storybook Connect

**Descrição:** Como designer, eu quero visualizar as stories do Storybook diretamente no Figma, para que eu possa comparar a implementação com o design sem sair da ferramenta.

**Critérios de Aceitação:**
1. Plugin "Storybook Connect" instalado e configurado no projeto Figma do DS
2. Pelo menos 5 componentes do Figma vinculados às stories correspondentes no Chromatic
3. Designers conseguem visualizar a story renderizada dentro do Figma
4. Documentação de como vincular novos componentes disponível para o time

---

### US5: Documentação do fluxo de manutenção do DS

**Descrição:** Como membro do time de plataforma, eu quero uma documentação do fluxo completo (Figma → Código → Storybook → Chromatic), para que qualquer pessoa do time consiga manter e evoluir o Design System.

**Critérios de Aceitação:**
1. Documento (README ou Confluence) descrevendo o fluxo end-to-end
2. Inclui instruções de como adicionar um novo componente ao DS
3. Inclui instruções de como vincular componente no Figma ao Storybook
4. Inclui troubleshooting para problemas comuns (build falhou, snapshot rejeitado, etc.)

---

## Metadata

| Campo | Valor |
|-------|-------|
| **Time** | Plataforma |
| **Status** | Criado no Azure DevOps |
| **Sprint** | Sprint - Maio |
| **Epic ID** | [2768](https://dev.azure.com/wiipo/49bd1103-882e-408d-b437-5be55d896562/_workitems/edit/2768) |
| **Feature ID** | [2769](https://dev.azure.com/wiipo/49bd1103-882e-408d-b437-5be55d896562/_workitems/edit/2769) |
| **US1 ID** | [2770](https://dev.azure.com/wiipo/49bd1103-882e-408d-b437-5be55d896562/_workitems/edit/2770) |
| **US2 ID** | [2771](https://dev.azure.com/wiipo/49bd1103-882e-408d-b437-5be55d896562/_workitems/edit/2771) |
| **US3 ID** | [2772](https://dev.azure.com/wiipo/49bd1103-882e-408d-b437-5be55d896562/_workitems/edit/2772) |
| **US4 ID** | [2773](https://dev.azure.com/wiipo/49bd1103-882e-408d-b437-5be55d896562/_workitems/edit/2773) |
| **US5 ID** | [2774](https://dev.azure.com/wiipo/49bd1103-882e-408d-b437-5be55d896562/_workitems/edit/2774) |

# Requirements Document

## Introduction

Aplicação que conecta ao Azure DevOps via Personal Access Token (PAT) para criar work items seguindo uma hierarquia padronizada: 1 Epic → 1 Feature → N User Stories, todas vinculadas entre si. A aplicação possui uma habilidade de PM (Product Manager) que, ao receber uma necessidade, faz perguntas de refinamento para estruturar corretamente as demandas. Após aprovação do usuário, os work items são criados no Azure DevOps vinculados ao time e à sprint de entrega.

## Glossary

- **Application**: Sistema que gerencia a criação de work items no Azure DevOps
- **Azure_DevOps_API**: Interface de programação do Azure DevOps utilizada para criar e vincular work items
- **PAT**: Personal Access Token utilizado para autenticação na API do Azure DevOps
- **Work_Item**: Unidade de trabalho no Azure DevOps (Epic, Feature ou User Story)
- **Epic**: Work item de nível mais alto na hierarquia, representando uma iniciativa ampla
- **Feature**: Work item de nível intermediário, vinculado a um Epic
- **User_Story**: Work item de nível mais baixo na hierarquia, vinculado a uma Feature, representando uma necessidade do usuário
- **Hierarchy**: Estrutura de vinculação entre work items: Epic → Feature → User Stories
- **PM_Skill**: Módulo inteligente que conduz perguntas de refinamento para estruturar as demandas
- **Sprint**: Iteração de trabalho do time no Azure DevOps
- **Team**: Equipe no Azure DevOps à qual os work items serão atribuídos
- **Refinement_Session**: Processo interativo de perguntas e respostas conduzido pelo PM_Skill para coletar informações necessárias
- **Approval**: Confirmação do usuário de que as demandas geradas estão corretas antes do envio ao Azure DevOps

## Requirements

### Requirement 1: Autenticação no Azure DevOps

**User Story:** Como usuário, eu quero configurar minha conexão com o Azure DevOps usando um Personal Access Token, para que a aplicação possa criar work items na minha organização.

#### Acceptance Criteria

1. WHEN o usuário fornece um PAT e a URL da organização, THE Application SHALL validar a conexão com o Azure DevOps e confirmar o acesso
2. IF o PAT fornecido for inválido ou expirado, THEN THE Application SHALL retornar uma mensagem de erro descritiva informando o problema de autenticação
3. IF a URL da organização for inválida, THEN THE Application SHALL retornar uma mensagem de erro indicando que a organização não foi encontrada
4. THE Application SHALL armazenar o PAT de forma segura, sem expô-lo em logs ou respostas

### Requirement 2: Configuração de Time e Projeto

**User Story:** Como usuário, eu quero selecionar o projeto, o time e a sprint de destino, para que os work items sejam criados no contexto correto.

#### Acceptance Criteria

1. WHEN a autenticação for bem-sucedida, THE Application SHALL listar os projetos disponíveis na organização
2. WHEN o usuário selecionar um projeto, THE Application SHALL listar os times disponíveis naquele projeto
3. WHEN o usuário selecionar um time, THE Application SHALL listar as sprints disponíveis para aquele time
4. IF o projeto selecionado não possuir times configurados, THEN THE Application SHALL informar que não há times disponíveis no projeto

### Requirement 3: Sessão de Refinamento com PM Skill

**User Story:** Como usuário, eu quero que a aplicação me faça perguntas de refinamento quando eu enviar uma necessidade, para que as demandas sejam estruturadas corretamente.

#### Acceptance Criteria

1. WHEN o usuário submeter uma necessidade em texto livre, THE PM_Skill SHALL iniciar uma Refinement_Session com perguntas relevantes para estruturar as demandas
2. THE PM_Skill SHALL perguntar sobre o objetivo de negócio para compor o Epic
3. THE PM_Skill SHALL perguntar sobre a funcionalidade principal para compor a Feature
4. THE PM_Skill SHALL perguntar sobre os cenários de uso e critérios de aceitação para compor as User Stories
5. THE PM_Skill SHALL perguntar sobre dependências, riscos e critérios de pronto (Definition of Done)
6. WHEN o usuário responder todas as perguntas necessárias, THE PM_Skill SHALL gerar um resumo estruturado com Epic, Feature e User Stories propostas
7. IF o usuário fornecer informações insuficientes, THEN THE PM_Skill SHALL fazer perguntas adicionais de esclarecimento

### Requirement 4: Geração da Hierarquia de Work Items

**User Story:** Como usuário, eu quero que a aplicação gere automaticamente a hierarquia de work items (Epic, Feature, User Stories), para que eu tenha uma estrutura padronizada.

#### Acceptance Criteria

1. WHEN a Refinement_Session for concluída, THE Application SHALL gerar exatamente 1 Epic com título e descrição baseados nas respostas do usuário
2. WHEN a Refinement_Session for concluída, THE Application SHALL gerar exatamente 1 Feature vinculada ao Epic com título e descrição baseados nas respostas do usuário
3. WHEN a Refinement_Session for concluída, THE Application SHALL gerar 1 ou mais User Stories vinculadas à Feature, cada uma com título, descrição e critérios de aceitação
4. THE Application SHALL apresentar a hierarquia completa ao usuário para revisão antes do envio

### Requirement 5: Aprovação das Demandas

**User Story:** Como usuário, eu quero revisar e aprovar as demandas geradas antes que sejam enviadas ao Azure DevOps, para garantir que estão corretas.

#### Acceptance Criteria

1. WHEN a hierarquia de work items for apresentada, THE Application SHALL solicitar a aprovação explícita do usuário
2. WHEN o usuário aprovar as demandas, THE Application SHALL prosseguir com a criação dos work items no Azure DevOps
3. WHEN o usuário rejeitar as demandas, THE Application SHALL permitir que o usuário indique as correções necessárias
4. WHEN o usuário indicar correções, THE PM_Skill SHALL ajustar as demandas conforme o feedback e apresentar novamente para aprovação
5. IF o usuário solicitar a adição de mais User Stories, THEN THE Application SHALL incluir as novas User Stories na hierarquia existente

### Requirement 6: Criação de Work Items no Azure DevOps

**User Story:** Como usuário, eu quero que os work items aprovados sejam criados no Azure DevOps com os vínculos corretos, para que o histórico e a rastreabilidade sejam mantidos.

#### Acceptance Criteria

1. WHEN o usuário aprovar as demandas, THE Application SHALL criar o Epic no Azure DevOps no projeto selecionado
2. WHEN o Epic for criado com sucesso, THE Application SHALL criar a Feature vinculada ao Epic usando o link type "System.LinkTypes.Hierarchy-Reverse"
3. WHEN a Feature for criada com sucesso, THE Application SHALL criar cada User Story vinculada à Feature usando o link type "System.LinkTypes.Hierarchy-Reverse"
4. THE Application SHALL atribuir todos os work items criados à sprint selecionada pelo usuário
5. THE Application SHALL atribuir todos os work items criados ao time selecionado pelo usuário
6. WHEN todos os work items forem criados com sucesso, THE Application SHALL retornar os IDs e URLs dos work items criados
7. IF a criação de um work item falhar, THEN THE Application SHALL informar qual work item falhou, o motivo do erro, e manter os work items já criados com sucesso

### Requirement 7: Formatação dos Work Items

**User Story:** Como usuário, eu quero que os work items criados sigam um padrão de formatação consistente, para manter a qualidade e legibilidade das demandas no Azure DevOps.

#### Acceptance Criteria

1. THE Application SHALL criar o Epic com os campos: Title, Description e Area Path
2. THE Application SHALL criar a Feature com os campos: Title, Description e Area Path
3. THE Application SHALL criar cada User Story com os campos: Title, Description, Acceptance Criteria e Area Path
4. THE Application SHALL formatar o campo Description usando HTML compatível com o Azure DevOps
5. THE Application SHALL formatar o campo Acceptance Criteria das User Stories usando HTML compatível com o Azure DevOps

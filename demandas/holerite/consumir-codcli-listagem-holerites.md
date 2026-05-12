# Consumir campo codcli na listagem de holerites

## Epic

**Título:** Consumir campo codcli na listagem de holerites

**Descrição:**
Adequar o serviço de listagem de holerites para consumir o novo campo `codcli` retornado pela API de plataforma. Atualmente a listagem de holerites do usuário não referencia nenhum `codcli`, impossibilitando a identificação do cliente associado a cada holerite. O time de plataforma já disponibilizou esse campo no retorno e agora o time de holerite precisa integrá-lo ao fluxo de listagem.

---

## Feature

**Título:** Integração do campo codcli na listagem de holerites

**Descrição:**
Implementar o consumo do campo `codcli` disponibilizado pelo time de plataforma no endpoint de listagem de holerites, garantindo que o código do cliente seja mapeado, persistido (se aplicável) e exibido corretamente no retorno da API de holerites para o front-end/consumidores.

---

## User Stories

### US1: Mapear o novo campo codcli no modelo de dados

**Descrição:** Como desenvolvedor back-end do time de holerite, eu quero mapear o campo `codcli` retornado pela API de plataforma no modelo de dados de holerite, para que o sistema reconheça e processe essa informação.

**Critérios de Aceitação:**
1. O campo `codcli` é reconhecido no payload de resposta da API de plataforma
2. O modelo/DTO de holerite inclui o campo `codcli` com o tipo correto
3. O mapeamento não quebra a deserialização dos demais campos existentes
4. Testes unitários validam o mapeamento correto do novo campo

---

### US2: Retornar codcli na API de listagem de holerites

**Descrição:** Como consumidor da API de holerites, eu quero que o campo `codcli` seja incluído no retorno da listagem de holerites, para que eu possa identificar a qual cliente cada holerite pertence.

**Critérios de Aceitação:**
1. O endpoint de listagem de holerites retorna o campo `codcli` em cada item da lista
2. O campo `codcli` é retornado com o mesmo valor recebido da API de plataforma
3. Quando o campo `codcli` não estiver presente na origem, o retorno trata graciosamente (null ou valor padrão documentado)
4. Contrato da API (swagger/documentação) atualizado com o novo campo

---

### US3: Validar integração com o retorno da plataforma

**Descrição:** Como QA do time de holerite, eu quero validar que o campo `codcli` é consumido corretamente da API de plataforma e repassado na listagem, para que tenhamos confiança na integridade do dado.

**Critérios de Aceitação:**
1. Teste de integração confirma que o `codcli` retornado pela plataforma chega corretamente no response da listagem de holerites
2. Cenário com múltiplos holerites de clientes diferentes retorna `codcli` correto para cada item
3. Cenário com `codcli` ausente ou nulo na origem não causa erro 500
4. Log de auditoria registra quando `codcli` não é encontrado na resposta da plataforma

---

## Metadata

| Campo | Valor |
|-------|-------|
| **Time** | Holerite |
| **Status** | Criado no Azure DevOps |
| **Prioridade** | A definir |
| **Sprint** | Janela de Junho |
| **Epic ID** | [2785](https://dev.azure.com/wiipo/49bd1103-882e-408d-b437-5be55d896562/_workitems/edit/2785) |
| **Feature ID** | [2786](https://dev.azure.com/wiipo/49bd1103-882e-408d-b437-5be55d896562/_workitems/edit/2786) |
| **US1 ID** | [2787](https://dev.azure.com/wiipo/49bd1103-882e-408d-b437-5be55d896562/_workitems/edit/2787) |
| **US2 ID** | [2788](https://dev.azure.com/wiipo/49bd1103-882e-408d-b437-5be55d896562/_workitems/edit/2788) |
| **US3 ID** | [2789](https://dev.azure.com/wiipo/49bd1103-882e-408d-b437-5be55d896562/_workitems/edit/2789) |

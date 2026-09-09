## Purpose

Registra toda movimentação financeira do usuário com precisão decimal e filtros poderosos, sendo o núcleo operacional que alimenta saldos, budgets e relatórios.

## ADDED Requirements

### Requirement: CRUD de transações com validação e paginação
O sistema SHALL permitir criar, listar (paginado), atualizar e remover transações próprias com type, amount positivo, date, description, accountId e categoryId opcional, isoladas por usuário.

#### Scenario: Criar despesa válida
- **WHEN** usuário envia POST /transactions com type EXPENSE, amount 49.90, date ISO, description "Mercado", accountId própria e categoryId própria
- **THEN** sistema cria Transaction com amount Decimal e retorna 201

#### Scenario: Listagem paginada e filtrada
- **WHEN** usuário envia GET /transactions?page=1&limit=20&from=2026-01-01&to=2026-01-31&categoryId=xxx&accountId=yyy&q=mercado
- **THEN** sistema retorna 200 com items, total, page, limit e hasNext, filtrando por período/categoria/conta e busca textual case-insensitive em description

#### Scenario: Usuário não usa conta de outro
- **WHEN** usuário tenta criar transação com accountId de outro usuário
- **THEN** sistema retorna 404 para accountId (não vaza existência) ou 400 com validação

### Requirement: Transferência atômica entre contas
O sistema SHALL tratar type TRANSFER como duas transações espelhadas (saída na origem, entrada no destino) com mesmo transferId, criadas em transação atômica.

#### Scenario: Transferência cria par atômico
- **WHEN** usuário envia POST /transactions com type TRANSFER, amount 200, fromAccountId e toAccountId próprias distintas
- **THEN** sistema cria 2 transações com transferId compartilhado em Prisma $transaction e retorna 201 com ambas; se falhar uma, nenhuma persiste

#### Scenario: Transferência para mesma conta é rejeitada
- **WHEN** usuário envia TRANSFER com fromAccountId equals toAccountId
- **THEN** sistema retorna 400 com mensagem de validação

### Requirement: Ordenação e integridade de data
O sistema SHALL ordenar listagem por date desc por padrão e rejeitar date futura além de 1 dia ou amount com mais de 2 casas decimais.

#### Scenario: Ordenação padrão
- **WHEN** usuário lista GET /transactions sem sort
- **THEN** sistema retorna items ordenados por date desc, id desc como desempate

## Purpose

Permite ao usuário organizar seu dinheiro em múltiplas contas/carteiras (banco, carteira física, cartão) com saldo derivado de transações, base para todo o controle financeiro.

## ADDED Requirements

### Requirement: CRUD de contas por usuário
O sistema SHALL permitir criar, listar, atualizar e arquivar contas próprias com nome, tipo e cor, nunca expondo contas de outros usuários.

#### Scenario: Criar conta
- **WHEN** usuário autenticado envia POST /accounts com name, type (CHECKING|SAVINGS|WALLET|CARD) e color hex
- **THEN** sistema cria Account vinculada ao userId e retorna 201 com id e dados

#### Scenario: Listar apenas contas próprias
- **WHEN** usuário autenticado envia GET /accounts
- **THEN** sistema retorna apenas contas onde account.userId equals token userId

#### Scenario: Arquivar conta com transações mantém histórico
- **WHEN** usuário arquiva conta que possui transações via PATCH /accounts/:id/archive
- **THEN** sistema marca isArchived true, remove de listagens padrão (salvo ?includeArchived=true) mas mantém transações consultáveis

### Requirement: Saldo computado por conta
O sistema SHALL computar saldo como soma de INCOME menos EXPENSE mais transferências (entrada/saída) por conta, sem armazenar saldo desnormalizado em v1.

#### Scenario: Saldo reflete transações
- **WHEN** conta possui 2 INCOME de 100 e 1 EXPENSE de 30
- **THEN** GET /accounts/:id retorna balance 170 e GET /accounts inclui balance por conta

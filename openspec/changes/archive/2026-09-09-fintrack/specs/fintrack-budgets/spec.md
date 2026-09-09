## Purpose

Ajuda o usuário a planejar e controlar limites de gasto mensal por categoria, comparando previsto vs realizado para tomada de decisão financeira consciente.

## ADDED Requirements

### Requirement: Definir orçamento mensal por categoria
O sistema SHALL permitir criar e atualizar orçamento com categoryId, month (1-12), year e amount >=0, único por usuário/categoria/mês/ano.

#### Scenario: Criar budget
- **WHEN** usuário envia PUT /budgets com categoryId própria, month 8, year 2026, amount 500
- **THEN** sistema cria ou atualiza (upsert) Budget e retorna 200 com dados

#### Scenario: Budget duplicado faz upsert
- **WHEN** usuário envia novamente PUT /budgets para mesma categoria/mês/ano com amount diferente
- **THEN** sistema atualiza amount existente em vez de criar duplicado

### Requirement: Consulta de budget com realizado e percentual
O sistema SHALL retornar para cada budget o amount previsto, spent (soma de EXPENSE da categoria no mês) e percentUsed, com lista filtrável por mês/ano.

#### Scenario: Listar budgets do mês com progresso
- **WHEN** usuário envia GET /budgets?month=8&year=2026
- **THEN** sistema retorna 200 com lista onde cada item contém category, amount, spent e percentUsed (spent/amount*100)

#### Scenario: Budget sem gastos retorna spent zero
- **WHEN** categoria possui budget mas nenhuma transação no mês
- **THEN** sistema retorna spent 0 e percentUsed 0

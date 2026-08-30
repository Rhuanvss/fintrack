# fintrack-reports Specification

## Purpose
Transforma transações brutas em insights visuais para dashboard, fornecendo agregações rápidas e precisas que sustentam gráficos e indicadores do frontend sem sobrecarregar o cliente.

## Requirements

### Requirement: Resumo financeiro do período
O sistema SHALL fornecer GET /reports/summary?from&to com totalIncome, totalExpense, balance (income-expense), por usuário e período, com validação de intervalo máximo 12 meses.

#### Scenario: Resumo mensal correto
- **WHEN** usuário autenticado envia GET /reports/summary?from=2026-08-01&to=2026-08-31 com transações no período
- **THEN** sistema retorna 200 com totalIncome, totalExpense e balance computados apenas com transações do usuário no intervalo

#### Scenario: Intervalo excede limite
- **WHEN** cliente envia from/to com diferença >12 meses
- **THEN** sistema retorna 400 com mensagem de intervalo máximo excedido

### Requirement: Gastos por categoria e evolução mensal
O sistema SHALL fornecer GET /reports/by-category e GET /reports/evolution agrupando gastos por categoria e por mês, ordenados, com suporte a filtros accountId/categoryId.

#### Scenario: Por categoria retorna ranking
- **WHEN** usuário envia GET /reports/by-category?from=2026-08-01&to=2026-08-31
- **THEN** sistema retorna 200 com lista {categoryId, categoryName, total, percent} ordenada por total desc, totalizando apenas EXPENSE

#### Scenario: Evolução mensal retorna série temporal
- **WHEN** usuário envia GET /reports/evolution?from=2026-01-01&to=2026-08-31
- **THEN** sistema retorna 200 com lista {month, year, income, expense, balance} para cada mês no intervalo, incluindo meses sem transação com zeros

### Requirement: Saldo por conta
O sistema SHALL incluir em GET /reports/balances o saldo atual por conta do usuário, derivado de transações confirmadas.

#### Scenario: Saldos por conta
- **WHEN** usuário envia GET /reports/balances
- **THEN** sistema retorna 200 com lista {accountId, accountName, balance} computada como soma de transações da conta

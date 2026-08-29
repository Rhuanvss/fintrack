# fintrack-categories Specification

## Purpose
Organiza transações em categorias hierárquicas personalizáveis para análise de gastos, permitindo ao usuário criar sua própria taxonomia financeira com visual consistente.

## Requirements

### Requirement: CRUD de categorias hierárquicas por usuário
O sistema SHALL permitir criar, listar, atualizar e remover categorias próprias com nome, cor, ícone e parent opcional (1 nível), com unicidade de nome por usuário no mesmo nível.

#### Scenario: Criar categoria raiz e subcategoria
- **WHEN** usuário cria POST /categories com name Alimentação e depois POST /categories com name Delivery e parentId da primeira
- **THEN** sistema cria ambas vinculadas ao userId, retornando 201, e GET /categories retorna árvore ou lista com parentId

#### Scenario: Nome duplicado no mesmo nível é rejeitado
- **WHEN** usuário tenta criar categoria com nome já existente no mesmo parent (case-insensitive)
- **THEN** sistema retorna 409

#### Scenario: Remover categoria com transações exige reatribuição
- **WHEN** usuário tenta DELETE /categories/:id onde existem transações vinculadas
- **THEN** sistema retorna 409 com mensagem exigindo reatribuir ou usar ?reassignTo=:otherId

### Requirement: Categorias padrão no cadastro
O sistema SHALL criar 8-12 categorias padrão (ex: Alimentação, Transporte, Moradia, Lazer) ao registrar novo usuário para acelerar onboarding.

#### Scenario: Novo usuário recebe categorias padrão
- **WHEN** usuário completa POST /auth/register com sucesso
- **THEN** sistema cria categorias padrão vinculadas ao novo userId antes de retornar 201

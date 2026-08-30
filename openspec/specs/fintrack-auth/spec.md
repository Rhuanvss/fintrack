# fintrack-auth Specification

## Purpose
Gerencia identidade e acesso do FinTrack, garantindo que cada usuário veja apenas seus dados financeiros através de autenticação JWT robusta e isolamento por usuário.

## Requirements

### Requirement: Cadastro de usuário
O sistema SHALL permitir cadastro com nome, email único e senha com validação de força, retornando tokens sem expor hash.

#### Scenario: Cadastro bem-sucedido
- **WHEN** cliente envia POST /auth/register com nome, email válido não cadastrado e senha >=8 caracteres com letra e número
- **THEN** sistema cria User, retorna 201 com id/nome/email e define refresh token em httpOnly cookie, sem retornar senha/hash

#### Scenario: Email duplicado
- **WHEN** cliente tenta cadastrar email já existente (case-insensitive)
- **THEN** sistema retorna 409 com mensagem de conflito

### Requirement: Login com JWT e refresh em httpOnly cookie
O sistema SHALL autenticar por email/senha, emitir access token curto (15m) e refresh token longo (7d) em cookie httpOnly.

#### Scenario: Login válido
- **WHEN** cliente envia POST /auth/login com email e senha corretos
- **THEN** sistema retorna 200 com accessToken e user, e seta cookie `refreshToken` httpOnly Secure SameSite

#### Scenario: Credenciais inválidas
- **WHEN** cliente envia senha incorreta
- **THEN** sistema retorna 401 sem indicar se email existe

### Requirement: Refresh e logout
O sistema SHALL permitir renovar access token via refresh cookie válido e invalidar refresh no logout.

#### Scenario: Refresh válido
- **WHEN** cliente envia POST /auth/refresh com cookie refreshToken válido e não expirado
- **THEN** sistema retorna novo accessToken 200

#### Scenario: Logout invalida sessão
- **WHEN** usuário autenticado envia POST /auth/logout
- **THEN** sistema invalida refresh armazenado e limpa cookie, retornando 204

### Requirement: Isolamento e RBAC
O sistema SHALL exigir JWT válido para rotas protegidas e isolar todos os recursos por `userId` do token; admin pode listar usuários.

#### Scenario: Acesso sem token é negado
- **WHEN** cliente chama GET /accounts sem Authorization Bearer
- **THEN** sistema retorna 401

#### Scenario: Usuário não acessa dados de outro
- **WHEN** usuário A tenta GET /transactions/:id pertencente a usuário B
- **THEN** sistema retorna 404 (não 403) para não vazar existência

# Proposal: fintrack

## Why

Construir um projeto fullstack de controle financeiro pessoal para portfólio que demonstre domínio equilibrado de `JavaScript/TypeScript` no frontend (`Next.js`) e principalmente no backend (`Node.js/NestJS`), alvo de 90% das vagas de estágio mapeadas. O projeto precisa ser memorável, deployado e com acabamento profissional em 6 semanas, diferenciando-se de CRUDs genéricos de tarefas.

## What Changes

- **Monorepo greenfield** `pnpm + Turborepo` com `apps/api` (NestJS) e `apps/web` (Next.js App Router) + `packages/shared` (DTOs, schemas Zod, tipos compartilhados) — `BREAKING` não aplicável (repo vazio).
- **Backend NestJS** modular: Auth (JWT access 15m + refresh 7d httpOnly cookie, RBAC user/admin), Accounts, Categories, Transactions, Budgets, Reports e Export.
- **Modelagem relacional** com Prisma + PostgreSQL: User 1—* Account 1—* Transaction *—1 Category, Budget por categoria/mês, RecurringRule opcional futuro.
- **API REST** com validação `class-validator`, paginação, filtros, ordenação, `Prisma $transaction` para transferências atômicas, Swagger em `/api/docs`.
- **Frontend Next.js** com Tailwind + shadcn/ui, TanStack Query, Server Components para leitura, Client Components para mutações, Recharts para dashboard, Zod para forms, estados de loading/erro.
- **Diferencial E — Export**: geração de relatório PDF e Excel (buffer/stream Node) por período/categoria a partir de `GET /reports/export?format=pdf|xlsx`.
- **Qualidade e Deploy**: ESLint/Prettier, Jest (unit + e2e Supertest), Docker + docker-compose, CI GitHub Actions, deploy API (Render/Fly) + Web (Vercel) + DB (Neon/Supabase), README com arquitetura, prints, decisões e demo gif.

Fora de escopo v1 (explicitamente não fazer em 6 semanas para manter foco): import CSV/OFX via streams, WebSocket real-time, multi-moeda, parcelamento/fatura de cartão, notificações, mobile nativo.

## Capabilities

### New Capabilities
- `fintrack-auth`: cadastro, login, refresh, logout, guards JWT e RBAC — base para isolar dados por usuário.
- `fintrack-accounts`: CRUD de contas/carteiras (banco, carteira, cartão) com saldo computado.
- `fintrack-categories`: CRUD de categorias hierárquicas (ex: Alimentação > Delivery) com cor/ícone.
- `fintrack-transactions`: CRUD de transações (INCOME/EXPENSE/TRANSFER), paginação, filtros por data/categoria/conta, transferências atômicas.
- `fintrack-budgets`: definição e consulta de orçamento mensal por categoria, com comparação realizado vs previsto.
- `fintrack-reports`: agregações para dashboard — saldo por conta, gasto por categoria, evolução mensal, status de budgets.
- `fintrack-export`: exportação de relatórios filtrados para PDF e XLSX (geração via buffer/stream Node).

### Modified Capabilities
- (nenhuma — repositório greenfield, sem specs prévias)

## Impact

- **Código**: novo monorepo, sem impacto em código existente; introduz dependências NestJS, Prisma, Next.js 15, Tailwind, shadcn, TanStack Query, Recharts, pdfkit/exceljs.
- **APIs**: novas rotas REST sob `/api` versionadas; contrato compartilhado via `packages/shared` quebra build se divergir.
- **Infra**: requer Postgres, Docker, variáveis de ambiente JWT; CI e deploys separados para api/web.
- **Docs**: novo README de portfólio, Swagger, ADRs leves no design.md.

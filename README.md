# FinTrack — Controle financeiro pessoal

Fullstack de controle financeiro: contas, transações, orçamentos, relatórios e
dashboard. Monorepo `pnpm + Turborepo` com `apps/api` (NestJS), `apps/web`
(Next.js) e `packages/shared` (tipos + schemas Zod compartilhados).

## Stack

| Camada    | Tecnologias                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| API       | NestJS 11, Prisma 6, PostgreSQL 16, JWT (access 15m + refresh 7d em cookie httpOnly), class-validator, Swagger |
| Web       | Next.js 15, React 19, Tailwind + shadcn/ui, TanStack Query v5, Recharts, Zod                                   |
| Qualidade | ESLint (0 warnings), `tsc --noEmit`, Jest + Supertest (API), Vitest + Testing Library (web)                    |

## Quickstart

Pré-requisitos: Node 18+, pnpm 9+, Docker.

```bash
cp .env.example apps/api/.env        # variáveis de ambiente
docker compose up -d                 # Postgres :5432
pnpm install                         # dependências do monorepo
pnpm --filter @fintrack/api exec prisma migrate dev  # migrations
pnpm dev                             # api (:3001) + web (:3000)
```

Abra `http://localhost:3000/register`, crie a conta e entre. Swagger em
`http://localhost:3001/api/docs` (JSON em `/api/docs-json`).

## Funcionalidades

**Contas** — CRUD, arquivar (`PATCH /accounts/:id/archive`, some da listagem padrão,
`?includeArchived=true` mostra tudo), saldo computado (`INCOME − EXPENSE ± TRANSFER`,
origem subtrai e destino soma, sem saldo desnormalizado).

**Categorias** — CRUD hierárquico com 1 nível, unicidade case-insensitive por nível,
categorias padrão criadas no registro, `DELETE` com `?reassignTo=` (409 se houver
transações vinculadas e sem reatribuição).

**Transações** — CRUD com paginação (`page/limit`, `total/hasNext`), ordenação
(`date desc, id desc`), filtros (`from/to`, `categoryId`, `accountId`, busca `q`) e
**transferência atômica** (`POST /transactions/transfer` cria o par com `transferId`
em `prisma.$transaction`; update/delete de TRANSFER bloqueados para não orfanar o par).

**Orçamentos** — `PUT /budgets` (upsert por usuário/categoria/mês/ano),
`GET /budgets?month&year` com `spent` (soma de EXPENSE do mês) e `percentUsed`.

**Relatórios** — `GET /reports/summary` (`totalIncome`, `totalExpense`, `balance`),
`/reports/by-category` (ranking `{total, percent}` desc, só EXPENSE),
`/reports/evolution` (série mensal com zeros), `/reports/balances` (saldo por conta);
intervalo limitado a 12 meses (400 se exceder).

**Frontend** — login/registro, guard de rota (redirect `/login`), header com navegação,
skeletons e estados vazio/erro; páginas de transações (filtros, criar com optimistic
update, excluir, paginação), contas (criar, arquivar), categorias (criar, excluir com
reatribuição) e dashboard (cards de saldo/resumo/orçamentos, pizza por categoria,
barras de evolução mensal, filtros de período com refetch).

**Isolamento** — todos os recursos filtrados por `userId` do token; recurso alheio
retorna **404** (sem vazar existência); rotas sem token retornam **401**.

## Scripts

| Comando                                             | O que faz                           |
| --------------------------------------------------- | ----------------------------------- |
| `pnpm dev`                                          | Sobe api + web com watch            |
| `pnpm build`                                        | Build shared → api, web             |
| `pnpm lint`                                         | ESLint `--max-warnings=0`           |
| `pnpm typecheck`                                    | `tsc --noEmit` na raiz              |
| `pnpm --filter @fintrack/api exec jest --runInBand` | Suite da API: 147 testes, 19 suites |
| `pnpm --filter @fintrack/shared test`               | Paridade DTO vs Zod: 16 testes      |
| `pnpm --filter @fintrack/web test`                  | Vitest: 18 testes                   |

## Variáveis de ambiente

| Var                                         | Onde | Padrão dev                                               |
| ------------------------------------------- | ---- | -------------------------------------------------------- |
| `DATABASE_URL`                              | api  | `postgresql://fintrack:fintrack@localhost:5432/fintrack` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET`         | api  | trocar em produção (mín. 32 chars)                       |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | api  | `15m` / `7d`                                             |
| `PORT` / `CORS_ORIGIN`                      | api  | `3001` / `http://localhost:3000`                         |
| `NEXT_PUBLIC_API_URL`                       | web  | `http://localhost:3001/api`                              |

## Estrutura

```
apps/api/src/{auth,accounts,categories,transactions,budgets,reports,prisma,common,swagger.ts,main.ts}
apps/web/src/{app/{(app)/dashboard|transactions|accounts|categories,login,register},components,lib}
packages/shared/src/{index.ts (tipos),schemas.ts (Zod)}
openspec/{specs (contratos),changes/archive/2026-09-09-fintrack (histórico)}
```

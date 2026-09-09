# Tasks: fintrack

## 1. Fundação Monorepo e Infra (Semana 1) — todas <500 LOC

- [x] 1.1 Scaffold monorepo pnpm workspaces + Turborepo com `apps/api`, `apps/web`, `packages/shared` e verificar `pnpm build` e `turbo run build` passam sem erros (~80 LOC config)
- [x] 1.2 Configurar ESLint + Prettier + tsconfig strict base compartilhado e verificar `pnpm lint` e `tsc --noEmit` passam em api/web/shared (~60 LOC)
- [x] 1.3 Inicializar NestJS em `apps/api` com AppModule vazio, `ConfigModule`, `PrismaService` placeholder e verificar `pnpm --filter api start:dev` sobe em :3001 (~250 LOC)
- [x] 1.4 Inicializar Prisma + Docker: `prisma init`, `docker-compose.yml` Postgres, `.env.example` e verificar `docker-compose up -d` e `prisma migrate dev --name init` executam (~180 LOC)
- [x] 1.5 Inicializar Next.js 15 App Router em `apps/web` com Tailwind + shadcn/ui init e verificar `pnpm --filter web dev` sobe em :3000 com página inicial (~350 LOC)
- [x] 1.6 Criar `packages/shared` v0 com tipos `User`, `Account` e helpers `Paginated<T>` e verificar import tipado em api e web quebra build se divergir (~150 LOC)
- [x] 1.7 Adicionar `ValidationPipe {whitelist, forbidNonWhitelisted, transform}`, `HttpExceptionFilter`, `LoggingInterceptor`, `ThrottlerGuard` rate-limit e verificar 400 em payload extra e logs aparecem em dev (~260 LOC) — movido de 6.5 para antes dos controllers

## 2. Auth e Modelagem Base (Semana 1-2) — fatiado para <500 LOC cada

- [x] 2.1 Modelar Prisma schema: `User`, `Account`, `Category` (self-relation parentId), `Transaction` (Decimal, transferId), `Budget` com índices `(userId,date)` e unique `@@unique([userId, categoryId, month, year])` e verificar `prisma migrate dev` e `prisma generate` geram client tipado (~220 LOC)
- [x] 2.2 Criar DTOs auth `RegisterDto`/`LoginDto` com `class-validator` e schemas Zod espelhados em `packages/shared` e verificar teste unitário de validação rejeita email inválido e senha <8 (~180 LOC)
- [x] 2.3 Implementar `AuthService` register/login: hash bcrypt, criação User, geração access 15m + refresh 7d e verificar unit test de hash e login com senha incorreta retorna 401 (~350 LOC)
- [x] 2.4 Implementar `JwtStrategy`, `JwtAuthGuard` global, decorador `@CurrentUser()` e `POST /auth/refresh` com cookie httpOnly e verificar e2e: `POST /auth/register` 201 seta cookie, `GET /accounts` sem token 401 (~380 LOC)
- [x] 2.5 Implementar `POST /auth/logout` com invalidação de refresh e teste de isolamento: usuário A não acessa recurso de B retorna 404 e verificar e2e logout limpa cookie e refresh subsequente 401 (~220 LOC)
- [x] 2.6 Seed categorias padrão no register (8-12 via `prisma createMany`) e verificar e2e `GET /categories` após register retorna árvore com `parentId` e cor/ícone (~150 LOC)
- [x] 2.7 Implementar `fintrack-accounts` service: CRUD + `computeBalance` (sum INCOME - EXPENSE + TRANSFER) e verificar unit test balance 170 com 2 incomes 100 e 1 expense 30 (~320 LOC)
- [x] 2.8 Implementar `fintrack-accounts` controller: `POST/GET/PATCH /accounts`, `PATCH /accounts/:id/archive` com `?includeArchived` e verificar e2e lista apenas contas do user e arquivada some da listagem padrão (~300 LOC)
- [x] 2.9 Implementar `fintrack-categories` service: CRUD hierárquico 1 nível, unicidade case-insensitive por `(userId, parentId, name)` e verificar unit 409 ao duplicar nome no mesmo parent (~300 LOC)
- [x] 2.10 Implementar `fintrack-categories` controller: `DELETE /categories/:id` com 409 se houver transações e `?reassignTo=` e verificar e2e 409 ao deletar em uso e 200 com reassign (~280 LOC)

## 3. Transações e Budgets (Semana 2-3) — fatiado para <500 LOC cada

- [x] 3.1 Criar `Transaction` DTOs (`CreateTransactionDto` com `type: INCOME|EXPENSE`, `amount` Decimal 2 casas, `date` ISO, `description`, `accountId`, `categoryId?`) com `class-validator` e verificar unit rejeita amount 3 casas e date futura >1d (~200 LOC)
- [x] 3.2 Implementar `TransactionsService` create/update/delete/list base com paginação `page/limit` e ordenação `date desc, id desc` e verificar unit paginação retorna `total/hasNext` correto (~380 LOC)
- [x] 3.3 Implementar filtros `TransactionsService` por `from/to`, `categoryId`, `accountId` e busca `q` em description (ilike) e verificar e2e `GET /transactions?from&to&categoryId&q=mercado` filtra correto e 404 se accountId de outro user (~350 LOC)
- [x] 3.4 Implementar `TransactionsController` `POST/GET/PATCH/DELETE /transactions` com `ValidationPipe` e isolamento `userId` e verificar e2e CRUD completo e 404 ao acessar id de outro user (~300 LOC)
- [x] 3.5 Implementar transferência atômica `TRANSFER`: service cria par com `transferId` em `prisma.$transaction` e verificar unit cria 2 linhas e rollback se falhar uma (~320 LOC)
- [x] 3.6 Implementar validação e endpoint TRANSFER no controller: `fromAccountId != toAccountId`, ambas contas do user, e verificar e2e 201 retorna par e 400 se mesma conta (~220 LOC)
- [x] 3.7 Criar DTOs `Budget` (`categoryId`, `month 1-12`, `year`, `amount`) e `UpsertBudget` com `class-validator` e verificar unit rejeita month 13 (~150 LOC)
- [x] 3.8 Implementar `BudgetsService` upsert `PUT /budgets` com `@@unique` e cálculo `spent` (sum EXPENSE do mês) + `percentUsed` e verificar unit spent soma apenas EXPENSE e percent 50% com budget 500 e gasto 250 (~340 LOC)
- [x] 3.9 Implementar `BudgetsController` `GET /budgets?month&year` com join Category e verificar e2e lista contém `spent` e `percentUsed` e 0 quando sem transações (~250 LOC)
- [x] 3.10 Espelhar schemas Zod Transaction/Budget em `packages/shared` e teste de paridade DTO vs Zod e verificar `pnpm --filter shared test` garante contrato api/web diverge quebra build (~180 LOC)

## 4. Dashboard Reports e Frontend (Semana 3-4) — fatiado para <500 LOC cada

- [x] 4.1 Implementar `ReportsService` `summary` (`totalIncome`, `totalExpense`, `balance`) com `aggregate` Prisma e validação intervalo max 12m e verificar unit summary 1000-400=600 para mês com seed (~280 LOC)
- [x] 4.2 Implementar `ReportsService` `byCategory` (`GET /reports/by-category` agrupado por categoria, `{total, percent}` desc) e verificar unit ranking ordena por total e soma apenas EXPENSE (~300 LOC)
- [x] 4.3 Implementar `ReportsService` `evolution` série mensal (`{month,year,income,expense,balance}` com zeros para meses vazios) via `groupBy` + preenchimento em TS e verificar unit retorna 8 meses para Jan-Ago com zeros (~340 LOC)
- [x] 4.4 Implementar `ReportsService` `balances` por conta e `ReportsController` com 4 rotas + DTOs `from/to` e verificar e2e 200 com balances e 400 se intervalo >12m (~280 LOC)
- [x] 4.5 Criar Next layout autenticado: `app/(app)/layout.tsx` com guard client (redirect /login se 401), header/nav, skeletons e estados empty/error e verificar navegação protege `/dashboard` sem token (~350 LOC)
- [x] 4.6 Criar página `/transactions` em Next com TanStack Query, Server Components lista inicial + Client mutações, filtros e optimistic update e verificar criar transação atualiza lista sem reload (~280 LOC) — quebrado de 4.6 original (transactions+accounts)
- [x] 4.7 Criar página `/accounts` em Next com TanStack Query, Server Components lista, mutações e archive, e verificar criar conta atualiza lista e arquivar some da listagem (~280 LOC) — quebrado de 4.6 original
- [x] 4.8 Criar páginas `/categories` e `/dashboard` shell com cards de saldo/budget e verificar `pnpm --filter web build` passa e Lighthouse local >=80 (~380 LOC)
- [x] 4.9 Integrar Recharts no dashboard: pizza por categoria, barras evolução mensal, cards com `percentUsed` e filtros `from/to` que atualizam query e verificar com mock gráfico renderiza e troca de mês refetch correto (~400 LOC)
- [x] 4.10 Adicionar Swagger `SwaggerModule` em `/api/docs` com decorators em todos os DTOs/controllers e verificar `GET /api/docs-json` retorna OpenAPI com 20+ rotas (~150 LOC)

## 5. Diferencial E — Export PDF/XLSX (Semana 4) — fatiado para <500 LOC cada

- [ ] 5.1 Implementar export PDF com `pdfkit`: service gera `Buffer` com cabeçalho + tabela (Data, Descrição, Conta, Categoria, Tipo, Valor) filtrada por `from/to/categoryId/accountId` e verificar unit PDF contém header e 3 linhas com seed (~320 LOC)
- [ ] 5.2 Implementar export XLSX com `exceljs`: service gera workbook com aba `Transações`, estilos cabeçalho, e verificar unit XLSX tem 1 aba e 4 colunas e cabeçalho quando sem dados (~340 LOC)
- [ ] 5.3 Implementar `ExportController` `GET /reports/export?format=pdf|xlsx` com validação `format`, `from<=to`, max 12m, headers `Content-Type` + `Content-Disposition: attachment; filename=fintrack-*.pdf` e verificar e2e 200 pdf/xlsx e 400 se format=csv (~300 LOC)
- [ ] 5.4 [OPCIONAL - STRETCH] Implementar streaming/chunked para export >5k linhas (paginar query em chunks, `StreamableFile`) e verificar com seed 5k resposta é `Transfer-Encoding: chunked` e não estoura heap (script Node/autocannon) (~280 LOC) — pode ser pulado se tempo curto, diferencial já provado em 5.1-5.3
- [ ] 5.5 Criar UI export no dashboard: botões Export PDF/Excel que herdam filtros atuais, fetch blob e download `fintrack-{from}_{to}.pdf/xlsx` e verificar clique baixa arquivo nomeado (~220 LOC)

## 6. Qualidade, Testes e Polimento (Semana 5) — fatiado para <500 LOC cada

- [ ] 6.1 Unit tests `accounts` + `categories` services com Jest cobrindo criação, unicidade, archive/reassign e verificar `pnpm --filter api test -- accounts categories` 90%+ linhas (~350 LOC teste)
- [ ] 6.2 Unit tests `transactions` (inclui TRANSFER) + `reports` (summary/byCategory/evolution) com mocks Prisma e verificar `pnpm test` cobre cálculos de balance e agregações (~420 LOC teste)
- [ ] 6.3 Unit tests `budgets` + `export` (pdf/xlsx geração) e pipes/guards e verificar `pnpm test` total >=70% coverage (~380 LOC teste)
- [ ] 6.4 E2E Supertest fluxo crítico: `register -> login -> create account/category/transaction -> reports -> export` e verificar `pnpm test:e2e` passa em CI com Postgres de teste (~450 LOC teste)
- [ ] 6.5 Revisar a11y + responsivo mobile 375px (labels, keyboard, contrast) e verificar Lighthouse `pnpm --filter web build && lighthouse` >=90 performance/a11y no dashboard (~0 LOC code, verificação)

## 7. Deploy e Portfólio (Semana 6) — todas <500 LOC

- [ ] 7.1 Configurar GitHub Actions CI `.github/workflows/ci.yml` (pnpm install, lint, test, build api/web) e verificar workflow verde em push para main (~120 LOC yaml)
- [ ] 7.2 Deploy DB Neon/Supabase + `prisma migrate deploy` e API Render/Fly com envs `JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGIN` e verificar `GET /api/health` 200 e `POST /auth/login` via produção (~150 LOC config)
- [ ] 7.3 Deploy Web Vercel com `NEXT_PUBLIC_API_URL` e `CORS credentials true` e verificar login em produção redireciona para `/dashboard` e dados carregam (~100 LOC config)
- [ ] 7.4 Escrever README portfólio com diagrama ASCII arquitetura, decisões (D1-D8 de design.md), prints/gif, `docker-compose up --build`, links live + Swagger e verificar clone limpo executa 3 comandos e sobe (~500 LOC markdown)
- [ ] 7.5 Gravar demo 60s (loom), publicar LinkedIn, coletar feedback de 2 pessoas e verificar checklist triagem estágio (README, live demo, testes, TS strict, commits semânticos) 100% (~0 LOC)

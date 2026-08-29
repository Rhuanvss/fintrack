# Design: fintrack

## Context

Repo greenfield (`crud-nodejs` vazio). Ver `proposal.md - Why` para motivação. Restrições: 6 semanas, 1 dev, foco em demonstrar domínio `JS/TS/Node` para triagem de estágio, sem equipe. Stack alvo já decidido: NestJS + Next.js + Prisma + Postgres. Precisa ser monorepo para compartilhar tipos e rodar com um comando, mas sem introduzir complexidade de microserviços.

## Goals / Non-Goals

**Goals:**
- Monorepo pnpm + Turborepo com contratos tipados compartilhados entre api/web que quebrem build em divergência.
- API Nest modular com separação clara controller/service/repository (Prisma) e ciclo de vida (Pipes/Guards/Interceptors/Filters).
- Dashboard com agregações SQL eficientes e frontend com estados reais (loading, error, empty, optimistic).
- Diferencial E (export PDF/XLSX) via geração Node com buffer/stream sem dependência externa pesada.
- Pronto para deploy e demonstração em <10 min de setup local (Docker).

**Non-Goals:**
- Import CSV/OFX via streams, WebSocket, multi-moeda, parcelamento/fatura, notificações push/email, i18n, testes de carga — ficam para v2.
- SSR com cache complexo ou ISR; dashboard usa Server Components para leitura inicial + TanStack Query para interatividade.
- Autenticação social (OAuth) ou 2FA.

## Decisions

### D1: Monorepo pnpm + Turborepo vs repos separados
- **Escolha**: pnpm workspaces + Turborepo, `apps/api`, `apps/web`, `packages/shared`.
- **Rationale**: um `git clone` demonstra organização profissional; `packages/shared` prova TS avançado (tipos/DTOs compartilhados). Turbo acelera CI.
- **Alternativas**: repos separados (mais simples, mas duplica tipos e enfraquece narrativa fullstack) — rejeitado.

### D2: NestJS vs Express puro
- **Escolha**: NestJS com módulos por domínio.
- **Rationale**: vagas pedem Node mas valorizam arquitetura; Nest mostra DI, modularização, guards/pipes — mapeia para conceitos de frameworks corporativos. Express exigiria reinventar estrutura.
- **Alternativa**: Express + arquitetura manual — mais leve, mas menos sinal de senioridade para estágio.

### D3: Prisma vs TypeORM/Sequelize
- **Escolha**: Prisma + PostgreSQL (Neon/Supabase).
- **Rationale**: tipagem total, migrations declarativas, `groupBy`/`aggregate` tipados para reports, `$transaction` para transferências atômicas. Excelente DX para demonstrar TS.
- **Alternativa**: TypeORM (decorators verbosos, tipagem mais fraca) — rejeitado. Drizzle considerado mas com menos material de portfolio.

### D4: Auth JWT access (15m) + refresh (7d) em httpOnly cookie
- **Escolha**: access em memória/header, refresh em `httpOnly, Secure, SameSite=Strict` cookie; `@nestjs/passport` + `jwt`.
- **Rationale**: demonstra segurança além de `localStorage`; permite Guard global + decorador `@CurrentUser()`. Refresh rotation simples (sem rotação complexa em v1).
- **Alternativa**: só Bearer localStorage — mais simples mas falha em demonstrar cookie/security.

### D5: Validação compartilhada Zod (web) + class-validator (api)
- **Escolha**: schemas Zod em `packages/shared` geram tipos; DTOs Nest com `class-validator` espelham contrato; teste de paridade em CI.
- **Rationale**: mostra domínio TS em duas camadas; Zod no front dá UX instantânea, class-validator no back garante defesa.
- **Alternativa**: só class-validator compartilhado — perde DX do front.

### D6: Export PDF/XLSX
- **Escolha**: `pdfkit` para PDF + `exceljs` para XLSX, geração via `Buffer`/`Stream` Node, endpoint `GET /reports/export?format=pdf|xlsx&from&to&categoryId&accountId`.
- **Rationale**: libs maduras, sem binário externo (ex: puppeteer), provam manipulação de `Buffer/Stream` Node — diferencial E com baixo esforço (1-2 dias).
- **Alternativa**: Puppeteer (gera PDF via Chrome headless) — pesado para deploy free tier; rejeitado.

### D7: Frontend state e charts
- **Escolha**: Next.js App Router, Tailwind + shadcn/ui, TanStack Query v5, Recharts.
- **Rationale**: Server Components para dados iniciais (SEO/perform), Query para cache/optimistic, Recharts simples para recrutador entender em 5s.
- **Alternativa**: SWR ou fetch puro — menos features de cache.

### D8: Modelo de dados
```
User 1--* Account 1--* Transaction *--1 Category
Category (self-relation parentId) para hierarquia
Budget (userId, categoryId, month, year, amount) unique(userId, categoryId, month, year)
Transaction { type: INCOME|EXPENSE|TRANSFER, amount Decimal, date, description, accountId, categoryId?, transferId? }
```
- **Rationale**: cobre caso real (transferência = 2 transações ligadas por `transferId` em transaction atômica); `Decimal` para dinheiro; índices em `(userId, date)` e `(userId, categoryId)`.

## Risks / Trade-offs

- **[Risco] Prisma raw vs groupBy limitado** → Mitigação: usar `groupBy` tipado onde possível, `queryRaw` tipado com `Prisma.sql` para evolução mensal com window functions; cobrir com testes.
- **[Risco] httpOnly cookie em dev vs prod (CORS)** → Mitigação: `credentials: true`, `CORS` configurado por env, `SameSite=Lax` em dev e `Strict` em prod; documentar no README.
- **[Risco] Geração PDF/XLSX consome memória em reports grandes** → Mitigação: paginar query em chunks, streamar resposta com `StreamableFile`, limitar por período (max 12 meses) com validação; testar com 10k linhas.
- **[Risco] Monorepo aumenta setup para avaliador** → Mitigação: `docker-compose up --build` único, seeds idempotentes, `pnpm dev` com `turbo run dev`, README com 3 comandos.
- **[Risco] Escopo estoura 6 semanas** → Mitigação: épicos fatiados por semana (ver tasks.md), feature flags simples, `Non-Goals` rígidos; cortar Budget se atrasar, manter Export.

## Migration Plan

1. Semana 1: scaffold monorepo, `prisma init`, `User/Account/Category` + Auth + Docker; deploy vazio para validar pipeline.
2. Semana 2-3: Transactions + Reports; migrations incrementais, sem breaking.
3. Semana 4: Export (novas rotas, sem alteração de schema).
4. Rollback: cada migration reversível; API e Web deployados separados (Vercel/Render) permitem rollback independente; feature `export` atrás de flag de rota.

## Open Questions

- **Q1**: Export deve incluir logo/marca do usuário no PDF? → Decisão adiada: v1 sem logo, apenas tabela e cabeçalho; customização é v2.
- **Q2**: Limite de linhas para XLSX no free tier? → A definir após spike de 10k linhas em S4; se >5MB, paginar em múltiplas abas.

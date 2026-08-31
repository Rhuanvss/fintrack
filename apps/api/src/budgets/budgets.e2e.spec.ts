import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Budgets E2E - task 3.9', () => {
  let app: INestApplication;
  let prismaMock: {
    user: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    category: { create: jest.Mock; createMany: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock; delete: jest.Mock };
    account: { create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    transaction: { create: jest.Mock; findMany: jest.Mock; count: jest.Mock; aggregate: jest.Mock; findFirst: jest.Mock; update: jest.Mock; delete: jest.Mock };
    budget: { upsert: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    $transaction: jest.Mock;
  };

  const users = new Map<string, { id: string; name: string; email: string; password: string; role: string; refreshToken: string | null; createdAt: Date; updatedAt: Date }>();
  const categories = new Map<string, { id: string; name: string; color: string | null; icon: string | null; parentId: string | null; userId: string; createdAt: Date; updatedAt: Date }>();
  const budgets = new Map<string, { id: string; userId: string; categoryId: string; month: number; year: number; amount: number; createdAt: Date; updatedAt: Date }>();
  const transactions = new Map<string, { id: string; type: string; amount: number; date: Date; description: string; accountId: string; categoryId: string | null; userId: string; transferId: string | null; createdAt: Date; updatedAt: Date }>();
  const accounts = new Map<string, unknown>();
  let userIdSeq = 1;
  let categoryIdSeq = 1;
  let budgetIdSeq = 1;
  let txIdSeq = 1;
  let accountIdSeq = 1;

  beforeAll(async () => {
    prismaMock = {
      user: {
        findFirst: jest.fn().mockImplementation(async ({ where }: { where: { email: { equals: string; mode: string } } }) => {
          const email = where.email.equals.toLowerCase();
          for (const u of users.values()) if (u.email.toLowerCase() === email) return u;
          return null;
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null),
        create: jest.fn().mockImplementation(async ({ data }: { data: { name: string; email: string; password: string } }) => {
          const id = `user_${userIdSeq++}`;
          const user = { id, name: data.name, email: data.email, password: data.password, role: 'USER', refreshToken: null, createdAt: new Date(), updatedAt: new Date() };
          users.set(id, user);
          return user;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: { refreshToken: string | null } }) => {
          const user = users.get(where.id);
          if (!user) return null;
          user.refreshToken = data.refreshToken as string | null;
          users.set(where.id, user);
          return user;
        }),
      },
      category: {
        create: jest.fn().mockImplementation(async ({ data }: { data: { name: string; color: string | null; icon: string | null; parentId: string | null; userId: string } }) => {
          const id = `cat_${categoryIdSeq++}`;
          const cat = { id, name: data.name, color: data.color ?? null, icon: data.icon ?? null, parentId: data.parentId ?? null, userId: data.userId, createdAt: new Date(), updatedAt: new Date() };
          categories.set(id, cat);
          return cat;
        }),
        createMany: jest.fn().mockImplementation(async ({ data }: { data: { name: string; color: string; icon: string; parentId: string | null; userId: string }[] }) => {
          for (const c of data) {
            const id = `cat_${categoryIdSeq++}`;
            categories.set(id, { id, name: c.name, color: c.color, icon: c.icon, parentId: c.parentId ?? null, userId: c.userId, createdAt: new Date(), updatedAt: new Date() });
          }
          return { count: data.length };
        }),
        findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id?: string; userId: string } }) => {
          if (where.id) return categories.get(where.id) && categories.get(where.id)!.userId === where.userId ? categories.get(where.id)! : null;
          return null;
        }),
        findMany: jest.fn().mockImplementation(async ({ where }: { where: { userId: string } }) => Array.from(categories.values()).filter((c) => c.userId === where.userId)),
        update: jest.fn(),
        delete: jest.fn(),
      },
      account: {
        create: jest.fn().mockImplementation(async ({ data }: { data: { name: string; type: string; color: string | null; userId: string } }) => {
          const id = `acc_${accountIdSeq++}`;
          const acc = { id, name: data.name, type: data.type, color: data.color ?? null, isArchived: false, userId: data.userId, createdAt: new Date(), updatedAt: new Date() };
          accounts.set(id, acc);
          return acc;
        }),
        findMany: jest.fn().mockImplementation(async ({ where }: { where: { userId: string } }) => Array.from(accounts.values()).filter((a) => (a as { userId: string }).userId === where.userId)),
        findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id: string; userId: string } }) => {
          const acc = accounts.get(where.id) as { userId: string } | undefined;
          if (!acc || (acc as { userId: string }).userId !== where.userId) return null;
          return acc as never;
        }),
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn().mockImplementation(async ({ data }: { data: { type: string; amount: number; date: Date; description: string; accountId: string; categoryId: string | null; userId: string } }) => {
          const id = `tx_${txIdSeq++}`;
          const tx = { id, type: data.type, amount: data.amount, date: data.date, description: data.description, accountId: data.accountId, categoryId: data.categoryId ?? null, userId: data.userId, transferId: null, createdAt: new Date(), updatedAt: new Date() };
          transactions.set(id, tx);
          return tx;
        }),
        findMany: jest.fn().mockImplementation(async () => []),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockImplementation(async ({ where }: { where: { userId: string; categoryId: string; type: string; date: { gte: Date; lt: Date } } }) => {
          let items = Array.from(transactions.values()).filter((t) => t.userId === where.userId && t.categoryId === where.categoryId && t.type === where.type);
          items = items.filter((t) => t.date >= where.date.gte && t.date < where.date.lt);
          const sum = items.reduce((acc, t) => acc + t.amount, 0);
          return { _sum: { amount: sum === 0 ? null : sum } };
        }),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      budget: {
        upsert: jest.fn().mockImplementation(async ({ where, create, update }: { where: { userId_categoryId_month_year: { userId: string; categoryId: string; month: number; year: number } }; create: { userId: string; categoryId: string; month: number; year: number; amount: number }; update: { amount: number } }) => {
          const key = `${where.userId_categoryId_month_year.userId}_${where.userId_categoryId_month_year.categoryId}_${where.userId_categoryId_month_year.month}_${where.userId_categoryId_month_year.year}`;
          const existing = budgets.get(key);
          if (existing) {
            existing.amount = update.amount;
            existing.updatedAt = new Date();
            budgets.set(key, existing);
            return existing;
          }
          const id = `bud_${budgetIdSeq++}`;
          const b = { id, userId: create.userId, categoryId: create.categoryId, month: create.month, year: create.year, amount: create.amount, createdAt: new Date(), updatedAt: new Date() };
          budgets.set(key, b);
          return b;
        }),
        findMany: jest.fn().mockImplementation(async ({ where, include }: { where: { userId: string; month: number; year: number }; include?: { category: boolean } }) => {
          const items = Array.from(budgets.values()).filter((b) => b.userId === where.userId && b.month === where.month && b.year === where.year);
          if (include?.category) {
            return items.map((b) => ({ ...b, category: categories.get(b.categoryId) ?? null }));
          }
          return items;
        }),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn().mockImplementation(async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock)),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    users.clear();
    categories.clear();
    budgets.clear();
    transactions.clear();
    accounts.clear();
    userIdSeq = 1;
    categoryIdSeq = 1;
    budgetIdSeq = 1;
    txIdSeq = 1;
    accountIdSeq = 1;
    jest.clearAllMocks();
    prismaMock.user.findFirst.mockImplementation(async ({ where }: { where: { email: { equals: string } } }) => {
      const email = where.email.equals.toLowerCase();
      for (const u of users.values()) if (u.email.toLowerCase() === email) return u;
      return null;
    });
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null);
    prismaMock.user.create.mockImplementation(async ({ data }: { data: { name: string; email: string; password: string } }) => {
      const id = `user_${userIdSeq++}`;
      const user = { id, name: data.name, email: data.email, password: data.password, role: 'USER', refreshToken: null, createdAt: new Date(), updatedAt: new Date() };
      users.set(id, user);
      return user;
    });
    prismaMock.user.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: { refreshToken: string | null } }) => {
      const user = users.get(where.id);
      if (!user) return null;
      user.refreshToken = data.refreshToken as string | null;
      users.set(where.id, user);
      return user;
    });
    prismaMock.category.create.mockImplementation(async ({ data }: { data: { name: string; color: string | null; icon: string | null; parentId: string | null; userId: string } }) => {
      const id = `cat_${categoryIdSeq++}`;
      const cat = { id, name: data.name, color: data.color ?? null, icon: data.icon ?? null, parentId: data.parentId ?? null, userId: data.userId, createdAt: new Date(), updatedAt: new Date() };
      categories.set(id, cat);
      return cat;
    });
    prismaMock.category.createMany.mockImplementation(async ({ data }: { data: { name: string; color: string; icon: string; parentId: string | null; userId: string }[] }) => {
      for (const c of data) {
        const id = `cat_${categoryIdSeq++}`;
        categories.set(id, { id, name: c.name, color: c.color, icon: c.icon, parentId: c.parentId ?? null, userId: c.userId, createdAt: new Date(), updatedAt: new Date() });
      }
      return { count: data.length };
    });
    prismaMock.category.findFirst.mockImplementation(async ({ where }: { where: { id?: string; userId: string } }) => {
      if (where.id) return categories.get(where.id) && categories.get(where.id)!.userId === where.userId ? categories.get(where.id)! : null;
      return null;
    });
    prismaMock.category.findMany.mockImplementation(async ({ where }: { where: { userId: string } }) => Array.from(categories.values()).filter((c) => c.userId === where.userId));
    prismaMock.account.create.mockImplementation(async ({ data }: { data: { name: string; type: string; color: string | null; userId: string } }) => {
      const id = `acc_${accountIdSeq++}`;
      const acc = { id, name: data.name, type: data.type, color: data.color ?? null, isArchived: false, userId: data.userId, createdAt: new Date(), updatedAt: new Date() };
      accounts.set(id, acc);
      return acc;
    });
    prismaMock.account.findMany.mockImplementation(async ({ where }: { where: { userId: string } }) => Array.from(accounts.values()).filter((a) => (a as { userId: string }).userId === where.userId));
    prismaMock.account.findFirst.mockImplementation(async ({ where }: { where: { id: string; userId: string } }) => {
      const acc = accounts.get(where.id) as { userId: string } | undefined;
      if (!acc || (acc as { userId: string }).userId !== where.userId) return null;
      return acc as never;
    });
    prismaMock.transaction.create.mockImplementation(async ({ data }: { data: { type: string; amount: number; date: Date; description: string; accountId: string; categoryId: string | null; userId: string } }) => {
      const id = `tx_${txIdSeq++}`;
      const tx = { id, type: data.type, amount: data.amount, date: data.date, description: data.description, accountId: data.accountId, categoryId: data.categoryId ?? null, userId: data.userId, transferId: null, createdAt: new Date(), updatedAt: new Date() };
      transactions.set(id, tx);
      return tx;
    });
    prismaMock.transaction.aggregate.mockImplementation(async ({ where }: { where: { userId: string; categoryId: string; type: string; date: { gte: Date; lt: Date } } }) => {
      let items = Array.from(transactions.values()).filter((t) => t.userId === where.userId && t.categoryId === where.categoryId && t.type === where.type);
      items = items.filter((t) => t.date >= where.date.gte && t.date < where.date.lt);
      const sum = items.reduce((acc, t) => acc + t.amount, 0);
      return { _sum: { amount: sum === 0 ? null : sum } };
    });
    prismaMock.budget.upsert.mockImplementation(async ({ where, create, update }: { where: { userId_categoryId_month_year: { userId: string; categoryId: string; month: number; year: number } }; create: { userId: string; categoryId: string; month: number; year: number; amount: number }; update: { amount: number } }) => {
      const key = `${where.userId_categoryId_month_year.userId}_${where.userId_categoryId_month_year.categoryId}_${where.userId_categoryId_month_year.month}_${where.userId_categoryId_month_year.year}`;
      const existing = budgets.get(key);
      if (existing) {
        existing.amount = update.amount;
        existing.updatedAt = new Date();
        budgets.set(key, existing);
        return existing;
      }
      const id = `bud_${budgetIdSeq++}`;
      const b = { id, userId: create.userId, categoryId: create.categoryId, month: create.month, year: create.year, amount: create.amount, createdAt: new Date(), updatedAt: new Date() };
      budgets.set(key, b);
      return b;
    });
    prismaMock.budget.findMany.mockImplementation(async ({ where, include }: { where: { userId: string; month: number; year: number }; include?: { category: boolean } }) => {
      const items = Array.from(budgets.values()).filter((b) => b.userId === where.userId && b.month === where.month && b.year === where.year);
      if (include?.category) return items.map((b) => ({ ...b, category: categories.get(b.categoryId) ?? null }));
      return items;
    });
    prismaMock.budget.count.mockResolvedValue(0);
    prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock));
  });

  it('PUT /api/budgets cria e GET /api/budgets?month&year retorna spent e percentUsed', async () => {
    const reg = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'BudUser', email: 'bud@example.com', password: 'Password123' }).expect(201);
    const token = reg.body.accessToken as string;

    const catRes = await request(app.getHttpServer()).post('/api/categories').set('Authorization', `Bearer ${token}`).send({ name: 'Alimentacao' }).expect(201);
    const categoryId = catRes.body.id as string;
    const accRes = await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({ name: 'Carteira', type: 'WALLET' }).expect(201);
    const accountId = accRes.body.id as string;

    const putRes = await request(app.getHttpServer()).put('/api/budgets').set('Authorization', `Bearer ${token}`).send({ categoryId, month: 8, year: 2026, amount: 500 }).expect(200);
    expect(putRes.body.categoryId).toBe(categoryId);
    expect(Number(putRes.body.amount)).toBe(500);

    // cria transacoes EXPENSE no mes 8/2026
    await request(app.getHttpServer()).post('/api/transactions').set('Authorization', `Bearer ${token}`).send({ type: 'EXPENSE', amount: 100, date: '2026-08-10T00:00:00.000Z', description: 'Gasto 1', accountId, categoryId }).expect(201);
    await request(app.getHttpServer()).post('/api/transactions').set('Authorization', `Bearer ${token}`).send({ type: 'EXPENSE', amount: 150, date: '2026-08-15T00:00:00.000Z', description: 'Gasto 2', accountId, categoryId }).expect(201);
    // INCOME nao deve contar para spent
    await request(app.getHttpServer()).post('/api/transactions').set('Authorization', `Bearer ${token}`).send({ type: 'INCOME', amount: 1000, date: '2026-08-20T00:00:00.000Z', description: 'Receita', accountId }).expect(201);

    const listRes = await request(app.getHttpServer()).get('/api/budgets?month=8&year=2026').set('Authorization', `Bearer ${token}`).expect(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body).toHaveLength(1);
    const bud = listRes.body[0] as { categoryId: string; amount: unknown; spent: number; percentUsed: number; category: { id: string } };
    expect(bud.categoryId).toBe(categoryId);
    expect(bud.spent).toBe(250);
    expect(bud.percentUsed).toBe(50);
    expect(bud.category).toBeDefined();
    expect(bud.category.id).toBe(categoryId);
  });

  it('GET /api/budgets?month&year retorna spent 0 e percent 0 quando sem transacoes', async () => {
    const reg = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'BudUser2', email: 'bud2@example.com', password: 'Password123' }).expect(201);
    const token = reg.body.accessToken as string;
    const catRes = await request(app.getHttpServer()).post('/api/categories').set('Authorization', `Bearer ${token}`).send({ name: 'Lazer' }).expect(201);
    const categoryId = catRes.body.id as string;

    await request(app.getHttpServer()).put('/api/budgets').set('Authorization', `Bearer ${token}`).send({ categoryId, month: 8, year: 2026, amount: 300 }).expect(200);

    const listRes = await request(app.getHttpServer()).get('/api/budgets?month=8&year=2026').set('Authorization', `Bearer ${token}`).expect(200);
    expect(listRes.body).toHaveLength(1);
    expect((listRes.body[0] as { spent: number; percentUsed: number }).spent).toBe(0);
    expect((listRes.body[0] as { spent: number; percentUsed: number }).percentUsed).toBe(0);
  });

  it('PUT /budgets upsert atualiza amount existente', async () => {
    const reg = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'BudUser3', email: 'bud3@example.com', password: 'Password123' }).expect(201);
    const token = reg.body.accessToken as string;
    const catRes = await request(app.getHttpServer()).post('/api/categories').set('Authorization', `Bearer ${token}`).send({ name: 'Transporte' }).expect(201);
    const categoryId = catRes.body.id as string;

    await request(app.getHttpServer()).put('/api/budgets').set('Authorization', `Bearer ${token}`).send({ categoryId, month: 8, year: 2026, amount: 500 }).expect(200);
    const second = await request(app.getHttpServer()).put('/api/budgets').set('Authorization', `Bearer ${token}`).send({ categoryId, month: 8, year: 2026, amount: 800 }).expect(200);
    expect(Number(second.body.amount)).toBe(800);

    const list = await request(app.getHttpServer()).get('/api/budgets?month=8&year=2026').set('Authorization', `Bearer ${token}`).expect(200);
    expect(list.body).toHaveLength(1);
    expect(Number((list.body[0] as { amount: unknown }).amount)).toBe(800);
  });
});

import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Reports E2E - task 4.4', () => {
  let app: INestApplication;
  let prismaMock: {
    user: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    category: { create: jest.Mock; createMany: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
    account: { create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };
    transaction: { create: jest.Mock; findMany: jest.Mock; aggregate: jest.Mock; groupBy: jest.Mock };
    budget: { count: jest.Mock };
    $transaction: jest.Mock;
  };

  const users = new Map<string, { id: string; name: string; email: string; password: string; role: string; refreshToken: string | null; createdAt: Date; updatedAt: Date }>();
  const accounts = new Map<string, { id: string; name: string; type: string; color: string | null; isArchived: boolean; userId: string; createdAt: Date; updatedAt: Date }>();
  const categories = new Map<string, { id: string; name: string; color: string | null; icon: string | null; parentId: string | null; userId: string; createdAt: Date; updatedAt: Date }>();
  const transactions = new Map<string, { id: string; type: string; amount: number; date: Date; description: string; accountId: string; categoryId: string | null; userId: string; transferId: string | null; createdAt: Date; updatedAt: Date }>();
  let userIdSeq = 1;
  let accountIdSeq = 1;
  let categoryIdSeq = 1;
  let txIdSeq = 1;

  function matchesTx(
    t: { userId: string; type: string; accountId: string; categoryId: string | null; date: Date },
    where: { userId?: string; type?: string | { in: string[] }; accountId?: string; categoryId?: string; date?: { gte?: Date; lt?: Date; lte?: Date } },
  ): boolean {
    if (where.userId && t.userId !== where.userId) return false;
    if (typeof where.type === 'string' && t.type !== where.type) return false;
    if (typeof where.type === 'object' && where.type.in && !where.type.in.includes(t.type)) return false;
    if (where.accountId && t.accountId !== where.accountId) return false;
    if (where.categoryId && t.categoryId !== where.categoryId) return false;
    if (where.date?.gte && t.date < where.date.gte) return false;
    if (where.date?.lt && t.date >= where.date.lt) return false;
    if (where.date?.lte && t.date > where.date.lte) return false;
    return true;
  }

  beforeAll(async () => {
    prismaMock = {
      user: {
        findFirst: jest.fn().mockImplementation(async ({ where }: { where: { email: { equals: string } } }) => {
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
        findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id?: string; userId: string; parentId?: string | null; name?: { equals: string } } }) => {
          if (where.id) {
            const c = categories.get(where.id);
            return c && c.userId === where.userId ? c : null;
          }
          if (where.name) {
            const name = where.name.equals.toLowerCase();
            for (const c of categories.values()) {
              if (c.userId === where.userId && (c.parentId ?? null) === (where.parentId ?? null) && c.name.toLowerCase() === name) return c;
            }
            return null;
          }
          return null;
        }),
        findMany: jest.fn().mockImplementation(async ({ where }: { where: { userId: string; id?: { in: string[] } } }) => {
          let items = Array.from(categories.values()).filter((c) => c.userId === where.userId);
          if (where.id?.in) items = items.filter((c) => where.id!.in.includes(c.id));
          return items;
        }),
      },
      account: {
        create: jest.fn().mockImplementation(async ({ data }: { data: { name: string; type: string; color: string | null; userId: string } }) => {
          const id = `acc_${accountIdSeq++}`;
          const acc = { id, name: data.name, type: data.type, color: data.color ?? null, isArchived: false, userId: data.userId, createdAt: new Date(), updatedAt: new Date() };
          accounts.set(id, acc);
          return acc;
        }),
        findMany: jest.fn().mockImplementation(async ({ where }: { where: { userId: string; isArchived?: boolean } }) => {
          const all = Array.from(accounts.values()).filter((a) => a.userId === where.userId);
          if (where.isArchived === false) return all.filter((a) => !a.isArchived);
          return all;
        }),
        findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id: string; userId: string } }) => {
          const acc = accounts.get(where.id);
          if (!acc || acc.userId !== where.userId) return null;
          return acc;
        }),
      },
      transaction: {
        create: jest.fn().mockImplementation(async ({ data }: { data: { type: string; amount: number; date: Date; description: string; accountId: string; categoryId: string | null; userId: string } }) => {
          const id = `tx_${txIdSeq++}`;
          const tx = { id, type: data.type, amount: data.amount, date: data.date, description: data.description, accountId: data.accountId, categoryId: data.categoryId ?? null, userId: data.userId, transferId: null, createdAt: new Date(), updatedAt: new Date() };
          transactions.set(id, tx);
          return tx;
        }),
        findMany: jest.fn().mockImplementation(async ({ where }: { where: { userId?: string; accountId?: string | { in: string[] } } }) => {
          let items = Array.from(transactions.values());
          if (where?.userId) items = items.filter((t) => t.userId === where.userId);
          if (typeof where?.accountId === 'string') items = items.filter((t) => t.accountId === where.accountId);
          if (typeof where?.accountId === 'object' && where.accountId.in) items = items.filter((t) => (where.accountId as { in: string[] }).in.includes(t.accountId));
          return items;
        }),
        aggregate: jest.fn().mockImplementation(async ({ where }: { where: Parameters<typeof matchesTx>[1] }) => {
          const items = Array.from(transactions.values()).filter((t) => matchesTx(t, where));
          const sum = items.reduce((acc, t) => acc + t.amount, 0);
          return { _sum: { amount: sum === 0 ? null : sum } };
        }),
        groupBy: jest.fn().mockImplementation(async ({ by, where }: { by: string[]; where: Parameters<typeof matchesTx>[1] }) => {
          const items = Array.from(transactions.values()).filter((t) => matchesTx(t, where));
          if (by.includes('categoryId')) {
            const map = new Map<string | null, number>();
            for (const t of items) map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
            return Array.from(map.entries()).map(([categoryId, total]) => ({ categoryId, _sum: { amount: total } }));
          }
          const map = new Map<string, number>();
          for (const t of items) map.set(t.type, (map.get(t.type) ?? 0) + t.amount);
          return Array.from(map.entries()).map(([type, total]) => ({ type, _sum: { amount: total } }));
        }),
      },
      budget: {
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
    accounts.clear();
    categories.clear();
    transactions.clear();
    userIdSeq = 1;
    accountIdSeq = 1;
    categoryIdSeq = 1;
    txIdSeq = 1;
    jest.clearAllMocks();
  });

  async function seedUserWithTransactions(): Promise<{ token: string; accountId: string; categoryId: string }> {
    const reg = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'RepUser', email: 'rep@example.com', password: 'Password123' }).expect(201);
    const token = reg.body.accessToken as string;

    const accRes = await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({ name: 'Carteira', type: 'WALLET' }).expect(201);
    const accountId = accRes.body.id as string;
    const catRes = await request(app.getHttpServer()).post('/api/categories').set('Authorization', `Bearer ${token}`).send({ name: 'Alimentacao' }).expect(201);
    const categoryId = catRes.body.id as string;

    await request(app.getHttpServer()).post('/api/transactions').set('Authorization', `Bearer ${token}`).send({ type: 'INCOME', amount: 1000, date: '2026-08-10T00:00:00.000Z', description: 'Salario', accountId }).expect(201);
    await request(app.getHttpServer()).post('/api/transactions').set('Authorization', `Bearer ${token}`).send({ type: 'EXPENSE', amount: 400, date: '2026-08-15T00:00:00.000Z', description: 'Mercado', accountId, categoryId }).expect(201);

    return { token, accountId, categoryId };
  }

  it('GET /api/reports/balances retorna 200 com balances por conta', async () => {
    const { token, accountId } = await seedUserWithTransactions();

    const res = await request(app.getHttpServer()).get('/api/reports/balances').set('Authorization', `Bearer ${token}`).expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    const item = res.body[0] as { accountId: string; accountName: string; balance: number };
    expect(item.accountId).toBe(accountId);
    expect(item.accountName).toBe('Carteira');
    expect(item.balance).toBe(600);
  });

  it('GET /api/reports/summary retorna 200 com totais e 400 se intervalo >12m', async () => {
    const { token } = await seedUserWithTransactions();

    const ok = await request(app.getHttpServer()).get('/api/reports/summary?from=2026-08-01&to=2026-08-31').set('Authorization', `Bearer ${token}`).expect(200);
    expect(ok.body).toEqual({ totalIncome: 1000, totalExpense: 400, balance: 600 });

    await request(app.getHttpServer()).get('/api/reports/summary?from=2025-01-01&to=2026-02-01').set('Authorization', `Bearer ${token}`).expect(400);
  });

  it('GET /api/reports/by-category e /api/reports/evolution retornam 200', async () => {
    const { token, categoryId } = await seedUserWithTransactions();

    const byCat = await request(app.getHttpServer()).get('/api/reports/by-category?from=2026-08-01&to=2026-08-31').set('Authorization', `Bearer ${token}`).expect(200);
    expect(byCat.body).toHaveLength(1);
    const row = byCat.body[0] as { categoryId: string; categoryName: string; total: number; percent: number };
    expect(row.categoryId).toBe(categoryId);
    expect(row.categoryName).toBe('Alimentacao');
    expect(row.total).toBe(400);
    expect(row.percent).toBe(100);

    const evo = await request(app.getHttpServer()).get('/api/reports/evolution?from=2026-08-01&to=2026-08-31').set('Authorization', `Bearer ${token}`).expect(200);
    expect(evo.body).toHaveLength(1);
    expect(evo.body[0]).toEqual({ month: 8, year: 2026, income: 1000, expense: 400, balance: 600 });
  });

  it('GET /api/reports sem token retorna 401', async () => {
    await request(app.getHttpServer()).get('/api/reports/balances').expect(401);
  });
});

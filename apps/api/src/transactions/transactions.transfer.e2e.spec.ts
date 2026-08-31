import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Transactions TRANSFER E2E - task 3.6', () => {
  let app: INestApplication;
  let prismaMock: {
    user: { findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    category: { create: jest.Mock; createMany: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock; delete: jest.Mock };
    account: { create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    transaction: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; count: jest.Mock; update: jest.Mock; delete: jest.Mock };
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
        findMany: jest.fn().mockImplementation(async ({ where }: { where: { userId: string } }) => Array.from(accounts.values()).filter((a) => a.userId === where.userId)),
        findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id: string; userId: string } }) => {
          const acc = accounts.get(where.id);
          if (!acc || acc.userId !== where.userId) return null;
          return acc;
        }),
        update: jest.fn(),
      },
      transaction: {
        create: jest.fn().mockImplementation(
          async ({
            data,
          }: {
            data: { type: string; amount: number; date: Date; description: string; accountId: string; categoryId: string | null; userId: string; transferId?: string | null };
          }) => {
            const id = `tx_${txIdSeq++}`;
            const tx = {
              id,
              type: data.type,
              amount: data.amount,
              date: data.date,
              description: data.description,
              accountId: data.accountId,
              categoryId: data.categoryId ?? null,
              userId: data.userId,
              transferId: (data as { transferId?: string | null }).transferId ?? null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            transactions.set(id, tx);
            return tx;
          },
        ),
        findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id: string; userId: string } }) => {
          const tx = transactions.get(where.id);
          if (!tx || tx.userId !== where.userId) return null;
          return tx;
        }),
        findMany: jest.fn().mockImplementation(async () => []),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
        delete: jest.fn(),
      },
      budget: { count: jest.fn().mockResolvedValue(0) },
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
    prismaMock.category.createMany.mockImplementation(async ({ data }: { data: { name: string; color: string; icon: string; parentId: string | null; userId: string }[] }) => {
      for (const c of data) {
        const id = `cat_${categoryIdSeq++}`;
        categories.set(id, { id, name: c.name, color: c.color, icon: c.icon, parentId: c.parentId ?? null, userId: c.userId, createdAt: new Date(), updatedAt: new Date() });
      }
      return { count: data.length };
    });
    prismaMock.category.findMany.mockImplementation(async ({ where }: { where: { userId: string } }) => Array.from(categories.values()).filter((c) => c.userId === where.userId));
    prismaMock.account.create.mockImplementation(async ({ data }: { data: { name: string; type: string; color: string | null; userId: string } }) => {
      const id = `acc_${accountIdSeq++}`;
      const acc = { id, name: data.name, type: data.type, color: data.color ?? null, isArchived: false, userId: data.userId, createdAt: new Date(), updatedAt: new Date() };
      accounts.set(id, acc);
      return acc;
    });
    prismaMock.account.findFirst.mockImplementation(async ({ where }: { where: { id: string; userId: string } }) => {
      const acc = accounts.get(where.id);
      if (!acc || acc.userId !== where.userId) return null;
      return acc;
    });
    prismaMock.transaction.create.mockImplementation(
      async ({
        data,
      }: {
        data: { type: string; amount: number; date: Date; description: string; accountId: string; categoryId: string | null; userId: string; transferId?: string | null };
      }) => {
        const id = `tx_${txIdSeq++}`;
        const tx = {
          id,
          type: data.type,
          amount: data.amount,
          date: data.date,
          description: data.description,
          accountId: data.accountId,
          categoryId: data.categoryId ?? null,
          userId: data.userId,
          transferId: (data as { transferId?: string | null }).transferId ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        transactions.set(id, tx);
        return tx;
      },
    );
    prismaMock.transaction.findMany.mockResolvedValue([]);
    prismaMock.transaction.count.mockResolvedValue(0);
    prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock));
  });

  it('POST /api/transactions/transfer 201 retorna par com mesmo transferId', async () => {
    const reg = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'TrUser', email: 'tr@example.com', password: 'Password123' }).expect(201);
    const token = reg.body.accessToken as string;

    const accFrom = await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({ name: 'Origem', type: 'WALLET' }).expect(201);
    const accTo = await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({ name: 'Destino', type: 'WALLET' }).expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 200, fromAccountId: accFrom.body.id, toAccountId: accTo.body.id, description: 'Transfer teste' })
      .expect(201);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    const [a, b] = res.body as { transferId: string; accountId: string; type: string; amount: number }[];
    expect(a.transferId).toBeDefined();
    expect(a.transferId).toBe(b.transferId);
    expect(a.type).toBe('TRANSFER');
    expect(b.type).toBe('TRANSFER');
    expect(a.amount).toBe(200);
    expect(b.amount).toBe(200);
    const ids = [a.accountId, b.accountId].sort();
    expect(ids).toEqual([accFrom.body.id, accTo.body.id].sort());
  });

  it('POST /api/transactions/transfer 400 se mesma conta', async () => {
    const reg = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'TrUser2', email: 'tr2@example.com', password: 'Password123' }).expect(201);
    const token = reg.body.accessToken as string;
    const acc = await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({ name: 'Unica', type: 'WALLET' }).expect(201);

    await request(app.getHttpServer())
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 100, fromAccountId: acc.body.id, toAccountId: acc.body.id })
      .expect(400);
  });

  it('POST /api/transactions/transfer 404 se conta de outro user', async () => {
    const regA = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'UA', email: 'ua_tr@example.com', password: 'Password123' }).expect(201);
    const tokenA = regA.body.accessToken as string;
    const regB = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'UB', email: 'ub_tr@example.com', password: 'Password123' }).expect(201);
    const tokenB = regB.body.accessToken as string;

    const accA = await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${tokenA}`).send({ name: 'Conta A', type: 'WALLET' }).expect(201);
    const accB = await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${tokenB}`).send({ name: 'Conta B', type: 'WALLET' }).expect(201);

    await request(app.getHttpServer())
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ amount: 50, fromAccountId: accA.body.id, toAccountId: accB.body.id })
      .expect(404);

    await request(app.getHttpServer())
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ amount: 50, fromAccountId: accB.body.id, toAccountId: accA.body.id })
      .expect(404);
  });

  it('POST /api/transactions/transfer 400 para amount invalido e 401 sem token', async () => {
    const reg = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'Val', email: 'val_tr@example.com', password: 'Password123' }).expect(201);
    const token = reg.body.accessToken as string;
    const acc1 = await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({ name: 'A1', type: 'WALLET' }).expect(201);
    const acc2 = await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({ name: 'A2', type: 'WALLET' }).expect(201);

    await request(app.getHttpServer())
      .post('/api/transactions/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10.123, fromAccountId: acc1.body.id, toAccountId: acc2.body.id })
      .expect(400);

    await request(app.getHttpServer()).post('/api/transactions/transfer').send({ amount: 100, fromAccountId: acc1.body.id, toAccountId: acc2.body.id }).expect(401);
  });
});

import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Transactions E2E - task 3.4', () => {
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
        update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const cat = categories.get(where.id);
          if (!cat) return null;
          const updated = { ...cat, ...data, updatedAt: new Date() } as typeof cat;
          categories.set(where.id, updated);
          return updated;
        }),
        delete: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
          const cat = categories.get(where.id);
          if (!cat) return null;
          categories.delete(where.id);
          return cat;
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
        update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const acc = accounts.get(where.id);
          if (!acc) return null;
          const updated = { ...acc, ...data, updatedAt: new Date() } as typeof acc;
          accounts.set(where.id, updated);
          return updated;
        }),
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
        findMany: jest.fn().mockImplementation(async ({ where, orderBy, skip, take }: { where: Record<string, unknown>; orderBy: { date: string; id: string }[]; skip: number; take: number }) => {
          let items = Array.from(transactions.values()).filter((t) => t.userId === (where.userId as string));
          if (where.accountId) items = items.filter((t) => t.accountId === where.accountId);
          if (where.categoryId) items = items.filter((t) => t.categoryId === where.categoryId);
          if (where.date) {
            const d = where.date as { gte?: Date; lte?: Date };
            if (d.gte) items = items.filter((t) => t.date >= d.gte!);
            if (d.lte) items = items.filter((t) => t.date <= d.lte!);
          }
          if (where.description) {
            const q = (where.description as { contains: string; mode: string }).contains.toLowerCase();
            items = items.filter((t) => t.description.toLowerCase().includes(q));
          }
          items.sort((a, b) => {
            const dateDiff = b.date.getTime() - a.date.getTime();
            if (dateDiff !== 0) return dateDiff;
            return b.id.localeCompare(a.id);
          });
          void orderBy;
          return items.slice(skip, skip + take);
        }),
        count: jest.fn().mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
          let items = Array.from(transactions.values()).filter((t) => t.userId === (where.userId as string));
          if (where.accountId) items = items.filter((t) => t.accountId === where.accountId);
          if (where.categoryId) items = items.filter((t) => t.categoryId === where.categoryId);
          if (where.date) {
            const d = where.date as { gte?: Date; lte?: Date };
            if (d.gte) items = items.filter((t) => t.date >= d.gte!);
            if (d.lte) items = items.filter((t) => t.date <= d.lte!);
          }
          if (where.description) {
            const q = (where.description as { contains: string; mode: string }).contains.toLowerCase();
            items = items.filter((t) => t.description.toLowerCase().includes(q));
          }
          return items.length;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const tx = transactions.get(where.id);
          if (!tx) return null;
          const updated = { ...tx, ...data, updatedAt: new Date() } as typeof tx;
          if (data.date) updated.date = data.date as Date;
          transactions.set(where.id, updated);
          return updated;
        }),
        delete: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
          const tx = transactions.get(where.id);
          if (!tx) return null;
          transactions.delete(where.id);
          return tx;
        }),
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
    prismaMock.account.findMany.mockImplementation(async ({ where }: { where: { userId: string; isArchived?: boolean } }) => Array.from(accounts.values()).filter((a) => a.userId === where.userId));
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
    prismaMock.transaction.findFirst.mockImplementation(async ({ where }: { where: { id: string; userId: string } }) => {
      const tx = transactions.get(where.id);
      if (!tx || tx.userId !== where.userId) return null;
      return tx;
    });
    prismaMock.transaction.findMany.mockImplementation(async ({ where, skip, take }: { where: Record<string, unknown>; skip: number; take: number }) => {
      let items = Array.from(transactions.values()).filter((t) => t.userId === (where.userId as string));
      if (where.accountId) items = items.filter((t) => t.accountId === where.accountId);
      if (where.categoryId) items = items.filter((t) => t.categoryId === where.categoryId);
      if (where.date) {
        const d = where.date as { gte?: Date; lte?: Date };
        if (d.gte) items = items.filter((t) => t.date >= d.gte!);
        if (d.lte) items = items.filter((t) => t.date <= d.lte!);
      }
      if (where.description) {
        const q = (where.description as { contains: string; mode: string }).contains.toLowerCase();
        items = items.filter((t) => t.description.toLowerCase().includes(q));
      }
      items.sort((a, b) => b.date.getTime() - a.date.getTime() || b.id.localeCompare(a.id));
      return items.slice(skip, skip + take);
    });
    prismaMock.transaction.count.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      let items = Array.from(transactions.values()).filter((t) => t.userId === (where.userId as string));
      if (where.accountId) items = items.filter((t) => t.accountId === where.accountId);
      if (where.categoryId) items = items.filter((t) => t.categoryId === where.categoryId);
      if (where.date) {
        const d = where.date as { gte?: Date; lte?: Date };
        if (d.gte) items = items.filter((t) => t.date >= d.gte!);
        if (d.lte) items = items.filter((t) => t.date <= d.lte!);
      }
      if (where.description) {
        const q = (where.description as { contains: string; mode: string }).contains.toLowerCase();
        items = items.filter((t) => t.description.toLowerCase().includes(q));
      }
      return items.length;
    });
    prismaMock.transaction.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const tx = transactions.get(where.id);
      if (!tx) return null;
      const updated = { ...tx, ...data, updatedAt: new Date() } as typeof tx;
      if (data.date) updated.date = data.date as Date;
      transactions.set(where.id, updated);
      return updated;
    });
    prismaMock.transaction.delete.mockImplementation(async ({ where }: { where: { id: string } }) => {
      const tx = transactions.get(where.id);
      if (!tx) return null;
      transactions.delete(where.id);
      return tx;
    });
    prismaMock.budget.count.mockResolvedValue(0);
    prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock));
  });

  it('CRUD completo: POST/CREATE -> GET/LIST -> PATCH/UPDATE -> DELETE', async () => {
    const reg = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'TxUser', email: 'tx@example.com', password: 'Password123' }).expect(201);
    const token = reg.body.accessToken as string;

    const accRes = await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({ name: 'Carteira', type: 'WALLET' }).expect(201);
    const accountId = accRes.body.id as string;
    const catRes = await request(app.getHttpServer()).post('/api/categories').set('Authorization', `Bearer ${token}`).send({ name: 'Alimentacao' }).expect(201);
    const categoryId = catRes.body.id as string;

    const createRes = await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'EXPENSE', amount: 49.9, date: new Date().toISOString(), description: 'Mercado', accountId, categoryId })
      .expect(201);
    expect(createRes.body).toHaveProperty('id');
    expect(createRes.body.description).toBe('Mercado');
    const txId = createRes.body.id as string;

    const getOne = await request(app.getHttpServer()).get(`/api/transactions/${txId}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(getOne.body.id).toBe(txId);

    const list = await request(app.getHttpServer()).get('/api/transactions?page=1&limit=20').set('Authorization', `Bearer ${token}`).expect(200);
    expect(list.body).toHaveProperty('items');
    expect(list.body).toHaveProperty('total', 1);
    expect(list.body).toHaveProperty('hasNext', false);
    expect((list.body.items as unknown[]).length).toBe(1);

    const patchRes = await request(app.getHttpServer()).patch(`/api/transactions/${txId}`).set('Authorization', `Bearer ${token}`).send({ description: 'Mercado Atualizado' }).expect(200);
    expect(patchRes.body.description).toBe('Mercado Atualizado');

    await request(app.getHttpServer()).delete(`/api/transactions/${txId}`).set('Authorization', `Bearer ${token}`).expect(200);

    const listAfter = await request(app.getHttpServer()).get('/api/transactions').set('Authorization', `Bearer ${token}`).expect(200);
    expect(listAfter.body.total).toBe(0);
  });

  it('404 ao acessar id de outro user (isolamento)', async () => {
    const regA = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'UA', email: 'ua_tx@example.com', password: 'Password123' }).expect(201);
    const tokenA = regA.body.accessToken as string;
    const regB = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'UB', email: 'ub_tx@example.com', password: 'Password123' }).expect(201);
    const tokenB = regB.body.accessToken as string;

    const accA = await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${tokenA}`).send({ name: 'Carteira A', type: 'WALLET' }).expect(201);
    const accountIdA = accA.body.id as string;

    const created = await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ type: 'EXPENSE', amount: 10, date: new Date().toISOString(), description: 'Privada', accountId: accountIdA })
      .expect(201);
    const txId = created.body.id as string;

    await request(app.getHttpServer()).get(`/api/transactions/${txId}`).set('Authorization', `Bearer ${tokenB}`).expect(404);
    await request(app.getHttpServer()).patch(`/api/transactions/${txId}`).set('Authorization', `Bearer ${tokenB}`).send({ description: 'Hack' }).expect(404);
    await request(app.getHttpServer()).delete(`/api/transactions/${txId}`).set('Authorization', `Bearer ${tokenB}`).expect(404);

    // criar com accountId de outro user também 404
    const accB = await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${tokenB}`).send({ name: 'Carteira B', type: 'WALLET' }).expect(201);
    await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ type: 'EXPENSE', amount: 10, date: new Date().toISOString(), description: 'Hack', accountId: accB.body.id as string })
      .expect(404);
  });

  it('validação 400 e isolamento 401/404', async () => {
    const reg = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'Val', email: 'val_tx@example.com', password: 'Password123' }).expect(201);
    const token = reg.body.accessToken as string;
    const acc = await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({ name: 'Carteira', type: 'WALLET' }).expect(201);
    const accountId = acc.body.id as string;

    // amount 3 casas -> 400
    await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'EXPENSE', amount: 10.123, date: new Date().toISOString(), description: 'Invalido', accountId })
      .expect(400);

    // date futura >1d -> 400
    const future2d = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'EXPENSE', amount: 10, date: future2d, description: 'Futuro', accountId })
      .expect(400);

    // sem token -> 401
    await request(app.getHttpServer()).get('/api/transactions').expect(401);

    // 404 para id inexistente
    await request(app.getHttpServer()).get('/api/transactions/tx_fake').set('Authorization', `Bearer ${token}`).expect(404);
  });
});

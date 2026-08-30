import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Accounts E2E - task 2.8', () => {
  let app: INestApplication;
  let prismaMock: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    category: {
      createMany: jest.Mock;
      findMany: jest.Mock;
    };
    account: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    transaction: {
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  const users = new Map<string, { id: string; name: string; email: string; password: string; role: string; refreshToken: string | null; createdAt: Date; updatedAt: Date }>();
  const categories = new Map<string, unknown[]>();
  const accounts = new Map<string, { id: string; name: string; type: string; color: string | null; isArchived: boolean; userId: string; createdAt: Date; updatedAt: Date }>();
  let userIdSeq = 1;
  let categoryIdSeq = 1;
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
        update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: { refreshToken: string } }) => {
          const user = users.get(where.id);
          if (!user) return null;
          user.refreshToken = data.refreshToken;
          user.updatedAt = new Date();
          users.set(where.id, user);
          return user;
        }),
      },
      category: {
        createMany: jest.fn().mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: (data as unknown[]).length })),
        findMany: jest.fn().mockImplementation(async () => []),
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
          if (where.isArchived === true) return all.filter((a) => a.isArchived);
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
          accounts.set(where.id, updated as never);
          return updated;
        }),
      },
      transaction: {
        findMany: jest.fn().mockImplementation(async () => []),
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
    accounts.clear();
    userIdSeq = 1;
    categoryIdSeq = 1;
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
    prismaMock.user.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: { refreshToken: string } }) => {
      const user = users.get(where.id);
      if (!user) return null;
      user.refreshToken = data.refreshToken;
      users.set(where.id, user);
      return user;
    });
    prismaMock.category.createMany.mockImplementation(async ({ data }: { data: unknown[] }) => {
      for (const c of data as { name: string; color: string; icon: string; parentId: string | null; userId: string }[]) {
        const list = categories.get(c.userId) ?? [];
        list.push({ id: `cat_${categoryIdSeq++}`, name: c.name, color: c.color, icon: c.icon, parentId: c.parentId ?? null, userId: c.userId, createdAt: new Date(), updatedAt: new Date() });
        categories.set(c.userId, list);
      }
      return { count: (data as unknown[]).length };
    });
    prismaMock.category.findMany.mockImplementation(async ({ where }: { where: { userId: string } }) => categories.get(where.userId) ?? []);
    prismaMock.account.create.mockImplementation(async ({ data }: { data: { name: string; type: string; color: string | null; userId: string } }) => {
      const id = `acc_${accountIdSeq++}`;
      const acc = { id, name: data.name, type: data.type, color: data.color ?? null, isArchived: false, userId: data.userId, createdAt: new Date(), updatedAt: new Date() };
      accounts.set(id, acc);
      return acc;
    });
    prismaMock.account.findMany.mockImplementation(async ({ where }: { where: { userId: string; isArchived?: boolean } }) => {
      const all = Array.from(accounts.values()).filter((a) => a.userId === where.userId);
      if (where.isArchived === false) return all.filter((a) => !a.isArchived);
      if (where.isArchived === true) return all.filter((a) => a.isArchived);
      return all;
    });
    prismaMock.account.findFirst.mockImplementation(async ({ where }: { where: { id: string; userId: string } }) => {
      const acc = accounts.get(where.id);
      if (!acc || acc.userId !== where.userId) return null;
      return acc;
    });
    prismaMock.account.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const acc = accounts.get(where.id);
      if (!acc) return null;
      const updated = { ...acc, ...data, updatedAt: new Date() } as typeof acc;
      accounts.set(where.id, updated);
      return updated;
    });
    prismaMock.transaction.findMany.mockImplementation(async () => []);
    prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock));
  });

  it('POST /api/accounts cria conta e retorna com balance', async () => {
    const reg = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'AccUser', email: 'acc@example.com', password: 'Password123' }).expect(201);
    const token = reg.body.accessToken as string;
    const res = await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({ name: 'Carteira', type: 'WALLET', color: '#FF6B6B' }).expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Carteira');
    expect(res.body.type).toBe('WALLET');
    expect(res.body).toHaveProperty('balance', 0);
    expect(res.body.userId).toBe(reg.body.user.id);
  });

  it('GET /api/accounts lista apenas contas do user', async () => {
    const regA = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'A', email: 'a_acc@example.com', password: 'Password123' }).expect(201);
    const tokenA = regA.body.accessToken as string;
    const regB = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'B', email: 'b_acc@example.com', password: 'Password123' }).expect(201);
    const tokenB = regB.body.accessToken as string;

    await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${tokenA}`).send({ name: 'Conta A1', type: 'WALLET' }).expect(201);
    await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${tokenA}`).send({ name: 'Conta A2', type: 'CHECKING' }).expect(201);
    await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${tokenB}`).send({ name: 'Conta B1', type: 'WALLET' }).expect(201);

    const resA = await request(app.getHttpServer()).get('/api/accounts').set('Authorization', `Bearer ${tokenA}`).expect(200);
    expect(Array.isArray(resA.body)).toBe(true);
    expect(resA.body).toHaveLength(2);
    for (const acc of resA.body as { userId: string }[]) expect(acc.userId).toBe(regA.body.user.id);

    const resB = await request(app.getHttpServer()).get('/api/accounts').set('Authorization', `Bearer ${tokenB}`).expect(200);
    expect(resB.body).toHaveLength(1);
  });

  it('PATCH /api/accounts/:id/archive arquiva e some da listagem padrão, mas aparece com includeArchived=true', async () => {
    const reg = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'ArchUser', email: 'arch@example.com', password: 'Password123' }).expect(201);
    const token = reg.body.accessToken as string;

    const created = await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({ name: 'Conta Arq', type: 'WALLET' }).expect(201);
    const id = created.body.id as string;

    const listBefore = await request(app.getHttpServer()).get('/api/accounts').set('Authorization', `Bearer ${token}`).expect(200);
    expect((listBefore.body as unknown[]).length).toBe(1);

    await request(app.getHttpServer()).patch(`/api/accounts/${id}/archive`).set('Authorization', `Bearer ${token}`).expect(200);

    const listAfter = await request(app.getHttpServer()).get('/api/accounts').set('Authorization', `Bearer ${token}`).expect(200);
    expect(listAfter.body).toHaveLength(0);

    const listWithArchived = await request(app.getHttpServer()).get('/api/accounts?includeArchived=true').set('Authorization', `Bearer ${token}`).expect(200);
    expect(listWithArchived.body).toHaveLength(1);
    expect((listWithArchived.body as { id: string; isArchived: boolean }[])[0]!.isArchived).toBe(true);

    // GET /accounts/:id ainda retorna a arquivada
    const getOne = await request(app.getHttpServer()).get(`/api/accounts/${id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(getOne.body.isArchived).toBe(true);
  });

  it('PATCH /api/accounts/:id atualiza nome e cor', async () => {
    const reg = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'PatchUser', email: 'patch@example.com', password: 'Password123' }).expect(201);
    const token = reg.body.accessToken as string;
    const created = await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${token}`).send({ name: 'Old', type: 'WALLET' }).expect(201);
    const id = created.body.id as string;

    const patched = await request(app.getHttpServer()).patch(`/api/accounts/${id}`).set('Authorization', `Bearer ${token}`).send({ name: 'New', color: '#00FF00' }).expect(200);
    expect(patched.body.name).toBe('New');
    expect(patched.body.color).toBe('#00FF00');
  });

  it('GET /api/accounts/:id 404 para conta de outro user e 401 sem token', async () => {
    const regA = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'UA', email: 'ua_acc2@example.com', password: 'Password123' }).expect(201);
    const tokenA = regA.body.accessToken as string;
    const regB = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'UB', email: 'ub_acc2@example.com', password: 'Password123' }).expect(201);
    const tokenB = regB.body.accessToken as string;

    const created = await request(app.getHttpServer()).post('/api/accounts').set('Authorization', `Bearer ${tokenA}`).send({ name: 'Privada', type: 'WALLET' }).expect(201);
    const id = created.body.id as string;

    await request(app.getHttpServer()).get(`/api/accounts/${id}`).set('Authorization', `Bearer ${tokenB}`).expect(404);
    await request(app.getHttpServer()).get(`/api/accounts/${id}`).expect(401);
  });
});

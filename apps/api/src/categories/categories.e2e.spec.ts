import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Categories E2E - task 2.10', () => {
  let app: INestApplication;
  let prismaMock: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    category: {
      create: jest.Mock;
      createMany: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    account: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    transaction: {
      findMany: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
    };
    budget: {
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  const users = new Map<string, { id: string; name: string; email: string; password: string; role: string; refreshToken: string | null; createdAt: Date; updatedAt: Date }>();
  const categories = new Map<string, { id: string; name: string; color: string | null; icon: string | null; parentId: string | null; userId: string; createdAt: Date; updatedAt: Date }>();
  const accounts = new Map<string, unknown>();
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
        findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id?: string; userId: string; parentId?: string | null; name?: { equals: string; mode: string }; NOT?: { id: string } } }) => {
          for (const c of categories.values()) {
            if (where.id && c.id !== where.id) continue;
            if (c.userId !== where.userId) continue;
            if (where.parentId !== undefined && c.parentId !== where.parentId) continue;
            if (where.name && typeof where.name === 'object' && 'equals' in where.name) {
              const target = (where.name as { equals: string }).equals.toLowerCase();
              if (c.name.toLowerCase() !== target) continue;
            }
            if (where.NOT && c.id === where.NOT.id) continue;
            return c;
          }
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
          const all = Array.from(accounts.values() as Iterable<{ userId: string; isArchived: boolean }[]>).filter((a) => (a as { userId: string }).userId === where.userId);
          if (where.isArchived === false) return (all as { isArchived: boolean }[]).filter((a) => !a.isArchived);
          if (where.isArchived === true) return (all as { isArchived: boolean }[]).filter((a) => a.isArchived);
          return all;
        }),
        findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id: string; userId: string } }) => {
          const acc = accounts.get(where.id) as { userId: string } | undefined;
          if (!acc || acc.userId !== where.userId) return null;
          return acc as never;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const acc = accounts.get(where.id);
          if (!acc) return null;
          const updated = { ...acc, ...data, updatedAt: new Date() };
          accounts.set(where.id, updated as never);
          return updated;
        }),
      },
      transaction: {
        findMany: jest.fn().mockImplementation(async () => []),
        count: jest.fn().mockImplementation(async ({ where }: { where: { categoryId: string } }) => {
          const cat = categories.get(where.categoryId);
          if (cat && cat.name === 'ComTransacao') return 2;
          return 0;
        }),
        updateMany: jest.fn().mockImplementation(async () => ({ count: 2 })),
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
    categories.clear();
    accounts.clear();
    userIdSeq = 1;
    categoryIdSeq = 1;
    accountIdSeq = 1;
    jest.clearAllMocks();
    // Re-setup mocks after clear
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
    prismaMock.category.findFirst.mockImplementation(async ({ where }: { where: { id?: string; userId: string; parentId?: string | null; name?: { equals: string; mode: string }; NOT?: { id: string } } }) => {
      for (const c of categories.values()) {
        if (where.id && c.id !== where.id) continue;
        if (c.userId !== where.userId) continue;
        if (where.parentId !== undefined && c.parentId !== where.parentId) continue;
        if (where.name && typeof where.name === 'object' && 'equals' in where.name) {
          const target = (where.name as { equals: string }).equals.toLowerCase();
          if (c.name.toLowerCase() !== target) continue;
        }
        if (where.NOT && c.id === where.NOT.id) continue;
        return c;
      }
      return null;
    });
    prismaMock.category.findMany.mockImplementation(async ({ where }: { where: { userId: string } }) => Array.from(categories.values()).filter((c) => c.userId === where.userId));
    prismaMock.category.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const cat = categories.get(where.id);
      if (!cat) return null;
      const updated = { ...cat, ...data, updatedAt: new Date() } as typeof cat;
      categories.set(where.id, updated);
      return updated;
    });
    prismaMock.category.delete.mockImplementation(async ({ where }: { where: { id: string } }) => {
      const cat = categories.get(where.id);
      if (!cat) return null;
      categories.delete(where.id);
      return cat;
    });
    prismaMock.account.create.mockImplementation(async ({ data }: { data: { name: string; type: string; color: string | null; userId: string } }) => {
      const id = `acc_${accountIdSeq++}`;
      const acc = { id, name: data.name, type: data.type, color: data.color ?? null, isArchived: false, userId: data.userId, createdAt: new Date(), updatedAt: new Date() };
      accounts.set(id, acc);
      return acc;
    });
    prismaMock.account.findMany.mockImplementation(async ({ where }: { where: { userId: string; isArchived?: boolean } }) => {
      const all = Array.from(accounts.values() as Iterable<{ userId: string; isArchived: boolean }[]>).filter((a) => (a as { userId: string }).userId === where.userId);
      if (where.isArchived === false) return (all as { isArchived: boolean }[]).filter((a) => !a.isArchived);
      if (where.isArchived === true) return (all as { isArchived: boolean }[]).filter((a) => a.isArchived);
      return all;
    });
    prismaMock.account.findFirst.mockImplementation(async ({ where }: { where: { id: string; userId: string } }) => {
      const acc = accounts.get(where.id) as { userId: string } | undefined;
      if (!acc || acc.userId !== where.userId) return null;
      return acc as never;
    });
    prismaMock.account.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const acc = accounts.get(where.id);
      if (!acc) return null;
      const updated = { ...acc, ...data, updatedAt: new Date() };
      accounts.set(where.id, updated as never);
      return updated;
    });
    prismaMock.transaction.findMany.mockImplementation(async () => []);
    prismaMock.transaction.count.mockImplementation(async ({ where }: { where: { categoryId: string } }) => {
      const cat = categories.get(where.categoryId);
      if (cat && cat.name === 'ComTransacao') return 2;
      return 0;
    });
    prismaMock.transaction.updateMany.mockImplementation(async () => ({ count: 2 }));
    prismaMock.budget.count.mockResolvedValue(0);
    prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock));
  });

  it('DELETE /api/categories/:id 409 quando tem transações sem reassignTo', async () => {
    const reg = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'DelUser', email: 'del@example.com', password: 'Password123' }).expect(201);
    const token = reg.body.accessToken as string;

    const created = await request(app.getHttpServer()).post('/api/categories').set('Authorization', `Bearer ${token}`).send({ name: 'ComTransacao' }).expect(201);
    const id = created.body.id as string;

    await request(app.getHttpServer()).delete(`/api/categories/${id}`).set('Authorization', `Bearer ${token}`).expect(409);
  });

  it('DELETE /api/categories/:id 200 com reassignTo reatribui e deleta', async () => {
    const reg = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'DelUser2', email: 'del2@example.com', password: 'Password123' }).expect(201);
    const token = reg.body.accessToken as string;

    const catA = await request(app.getHttpServer()).post('/api/categories').set('Authorization', `Bearer ${token}`).send({ name: 'ComTransacao' }).expect(201);
    const catB = await request(app.getHttpServer()).post('/api/categories').set('Authorization', `Bearer ${token}`).send({ name: 'Destino' }).expect(201);

    await request(app.getHttpServer()).delete(`/api/categories/${catA.body.id}?reassignTo=${catB.body.id}`).set('Authorization', `Bearer ${token}`).expect(200);

    const list = await request(app.getHttpServer()).get('/api/categories').set('Authorization', `Bearer ${token}`).expect(200);
    const ids = (list.body as { id: string }[]).map((c) => c.id);
    expect(ids).not.toContain(catA.body.id);
    expect(ids).toContain(catB.body.id);
  });

  it('DELETE /api/categories/:id 200 quando sem transações', async () => {
    const reg = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'DelUser3', email: 'del3@example.com', password: 'Password123' }).expect(201);
    const token = reg.body.accessToken as string;

    const created = await request(app.getHttpServer()).post('/api/categories').set('Authorization', `Bearer ${token}`).send({ name: 'SemTransacao' }).expect(201);
    await request(app.getHttpServer()).delete(`/api/categories/${created.body.id}`).set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('DELETE /api/categories/:id 401 sem token e 404 para outro user', async () => {
    const regA = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'UA', email: 'ua_cat@example.com', password: 'Password123' }).expect(201);
    const tokenA = regA.body.accessToken as string;
    const regB = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'UB', email: 'ub_cat@example.com', password: 'Password123' }).expect(201);
    const tokenB = regB.body.accessToken as string;

    const created = await request(app.getHttpServer()).post('/api/categories').set('Authorization', `Bearer ${tokenA}`).send({ name: 'Privada' }).expect(201);
    await request(app.getHttpServer()).delete(`/api/categories/${created.body.id}`).set('Authorization', `Bearer ${tokenB}`).expect(404);
    await request(app.getHttpServer()).delete(`/api/categories/${created.body.id}`).expect(401);
  });
});

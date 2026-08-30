import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { __resetAccountsStore } from '../accounts/accounts.controller';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

describe('Auth E2E - task 2.4', () => {
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
  const categories = new Map<string, { id: string; name: string; color: string | null; icon: string | null; parentId: string | null; userId: string; createdAt: Date; updatedAt: Date }[]>();
  const accounts = new Map<string, { id: string; name: string; type: string; color: string | null; isArchived: boolean; userId: string; createdAt: Date; updatedAt: Date }>();
  let userIdSeq = 1;
  let categoryIdSeq = 1;
  let accountIdSeq = 1;

  beforeAll(async () => {
    prismaMock = {
      user: {
        findFirst: jest.fn().mockImplementation(async ({ where }: { where: { email: { equals: string; mode: string } } }) => {
          const email = where.email.equals.toLowerCase();
          for (const u of users.values()) {
            if (u.email.toLowerCase() === email) return u;
          }
          return null;
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
          return users.get(where.id) ?? null;
        }),
        create: jest.fn().mockImplementation(async ({ data }: { data: { name: string; email: string; password: string } }) => {
          const id = `user_${userIdSeq++}`;
          const user = {
            id,
            name: data.name,
            email: data.email,
            password: data.password,
            role: 'USER',
            refreshToken: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
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
        createMany: jest.fn().mockImplementation(async ({ data }: { data: { name: string; color: string; icon: string; parentId: string | null; userId: string }[] }) => {
          for (const cat of data) {
            const id = `cat_${categoryIdSeq++}`;
            const entry = {
              id,
              name: cat.name,
              color: cat.color,
              icon: cat.icon,
              parentId: cat.parentId ?? null,
              userId: cat.userId,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            const list = categories.get(cat.userId) ?? [];
            list.push(entry);
            categories.set(cat.userId, list);
          }
          return { count: data.length };
        }),
        findMany: jest.fn().mockImplementation(async ({ where }: { where: { userId: string } }) => {
          return categories.get(where.userId) ?? [];
        }),
      },
      account: {
        create: jest.fn().mockImplementation(async ({ data }: { data: { name: string; type: string; color: string | null; userId: string } }) => {
          const id = `acc_${accountIdSeq++}`;
          const acc = {
            id,
            name: data.name,
            type: data.type,
            color: data.color ?? null,
            isArchived: false,
            userId: data.userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          accounts.set(id, acc);
          return acc;
        }),
        findMany: jest.fn().mockImplementation(async ({ where }: { where: { userId: string; isArchived?: boolean } }) => {
          const all = Array.from(accounts.values()).filter((a) => a.userId === where.userId);
          if (where.isArchived === false) {
            return all.filter((a) => !a.isArchived);
          }
          if (where.isArchived === true) {
            return all.filter((a) => a.isArchived);
          }
          return all;
        }),
        findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id: string; userId: string } }) => {
          const acc = accounts.get(where.id);
          if (!acc || acc.userId !== where.userId) return null;
          return acc;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: { isArchived?: boolean; name?: string; type?: string; color?: string | null } }) => {
          const acc = accounts.get(where.id);
          if (!acc) return null;
          const updated = { ...acc, ...data, updatedAt: new Date() } as typeof acc;
          accounts.set(where.id, updated);
          return updated;
        }),
      },
      transaction: {
        findMany: jest.fn().mockImplementation(async () => []),
      },
      $transaction: jest.fn().mockImplementation(async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock)),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
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
    __resetAccountsStore();
    jest.clearAllMocks();
    // keep mock implementations
    prismaMock.user.findFirst.mockImplementation(async ({ where }: { where: { email: { equals: string } } }) => {
      const email = where.email.equals.toLowerCase();
      for (const u of users.values()) {
        if (u.email.toLowerCase() === email) return u;
      }
      return null;
    });
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null);
    prismaMock.user.create.mockImplementation(async ({ data }: { data: { name: string; email: string; password: string } }) => {
      const id = `user_${userIdSeq++}`;
      const user = {
        id,
        name: data.name,
        email: data.email,
        password: data.password,
        role: 'USER',
        refreshToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
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
      for (const cat of data) {
        const id = `cat_${categoryIdSeq++}`;
        const entry = {
          id,
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          parentId: cat.parentId ?? null,
          userId: cat.userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const list = categories.get(cat.userId) ?? [];
        list.push(entry);
        categories.set(cat.userId, list);
      }
      return { count: data.length };
    });
    prismaMock.category.findMany.mockImplementation(async ({ where }: { where: { userId: string } }) => categories.get(where.userId) ?? []);
    prismaMock.account.create.mockImplementation(async ({ data }: { data: { name: string; type: string; color: string | null; userId: string } }) => {
      const id = `acc_${accountIdSeq++}`;
      const acc = {
        id,
        name: data.name,
        type: data.type,
        color: data.color ?? null,
        isArchived: false,
        userId: data.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
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
    prismaMock.account.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: { isArchived?: boolean; name?: string; type?: string; color?: string | null } }) => {
      const acc = accounts.get(where.id);
      if (!acc) return null;
      const updated = { ...acc, ...data, updatedAt: new Date() } as typeof acc;
      accounts.set(where.id, updated);
      return updated;
    });
    prismaMock.transaction.findMany.mockImplementation(async () => []);
    prismaMock.$transaction.mockImplementation(async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock));
  });

  it('POST /api/auth/register 201 sets httpOnly cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'John Doe', email: 'john@example.com', password: 'Password123' })
      .expect(201);

    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user.email).toBe('john@example.com');
    expect(res.body.user).not.toHaveProperty('password');

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    const refreshCookie = Array.isArray(cookies) ? cookies.find((c: string) => c.startsWith('refreshToken=')) : (cookies as string);
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
    // sameSite depends on NODE_ENV, dev is Lax
    expect(refreshCookie).toMatch(/SameSite=(Strict|Lax)/);
    expect(refreshCookie).toContain('Path=/');

    // verify password stored hashed
    const stored = users.get(res.body.user.id);
    expect(stored).toBeDefined();
    expect(stored?.password).not.toBe('Password123');
    expect(await bcrypt.compare('Password123', stored!.password)).toBe(true);
  });

  it('POST /api/auth/register duplicate email 409', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'A', email: 'dup@example.com', password: 'Password123' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'B', email: 'DUP@example.com', password: 'Password123' })
      .expect(409);
  });

  it('POST /api/auth/login 200 sets cookie and returns accessToken', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Jane', email: 'jane@example.com', password: 'Password123' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'jane@example.com', password: 'Password123' })
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    expect((Array.isArray(cookies) ? cookies.join(';') : (cookies as string))).toContain('refreshToken=');
  });

  it('POST /api/auth/login with wrong password 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'bob@example.com', password: 'Password123' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'bob@example.com', password: 'Wrong123' })
      .expect(401);
  });

  it('GET /api/accounts without token 401', async () => {
    await request(app.getHttpServer()).get('/api/accounts').expect(401);
  });

  it('GET /api/accounts with valid token 200 returns userId', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Alice', email: 'alice@example.com', password: 'Password123' })
      .expect(201);

    const token = reg.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it('POST /api/auth/refresh with httpOnly cookie returns new accessToken', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'RefreshUser', email: 'refresh@example.com', password: 'Password123' })
      .expect(201);

    const cookies = reg.headers['set-cookie'] as unknown as string[];
    const cookieHeader = Array.isArray(cookies)
      ? cookies.map((c: string) => c.split(';')[0]).join('; ')
      : ((cookies as unknown as string).split(';')[0] ?? '');

    const res = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookieHeader)
      .expect(200);

    expect(res.body).toHaveProperty('accessToken');
    expect(typeof res.body.accessToken).toBe('string');

    // should set new refresh cookie
    const newCookies = res.headers['set-cookie'] as unknown as string[];
    expect(newCookies).toBeDefined();
    expect((Array.isArray(newCookies) ? newCookies.join(';') : (newCookies as string))).toContain('refreshToken=');

    // new token should work for protected route
    await request(app.getHttpServer())
      .get('/api/accounts')
      .set('Authorization', `Bearer ${res.body.accessToken}`)
      .expect(200);
  });

  it('POST /api/auth/refresh without cookie 401', async () => {
    await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
  });

  it('CurrentUser decorator returns payload', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'Decorator', email: 'decorator@example.com', password: 'Password123' })
      .expect(201);

    const token = reg.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/auth/logout limpa cookie e invalida refresh subsequente 401', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'LogoutUser', email: 'logout@example.com', password: 'Password123' })
      .expect(201);

    const cookies = reg.headers['set-cookie'] as unknown as string[];
    const cookieHeader = Array.isArray(cookies)
      ? cookies.map((c: string) => c.split(';')[0]).join('; ')
      : ((cookies as unknown as string).split(';')[0] ?? '');
    const token = reg.body.accessToken as string;

    const logoutRes = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', cookieHeader)
      .expect(204);

    const logoutCookies = logoutRes.headers['set-cookie'] as unknown as string[];
    expect(logoutCookies).toBeDefined();
    const cleared = Array.isArray(logoutCookies)
      ? logoutCookies.join(';')
      : (logoutCookies as unknown as string);
    expect(cleared).toContain('refreshToken=');
    // cookie deve estar expirado/limpo (Max-Age 0 ou expires no passado)
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);

    // refresh com cookie antigo deve falhar 401 pois refreshToken foi invalidado no DB
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookieHeader)
      .expect(401);
  });

  it('POST /api/auth/logout sem token 401', async () => {
    await request(app.getHttpServer()).post('/api/auth/logout').expect(401);
  });

  it('Isolamento: usuário A não acessa recurso de B retorna 404', async () => {
    const regA = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'UserA', email: 'a_isolation@example.com', password: 'Password123' })
      .expect(201);
    const tokenA = regA.body.accessToken as string;

    const regB = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'UserB', email: 'b_isolation@example.com', password: 'Password123' })
      .expect(201);
    const tokenB = regB.body.accessToken as string;

    // A cria conta
    const accRes = await request(app.getHttpServer())
      .post('/api/accounts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Conta A', type: 'WALLET' })
      .expect(201);
    const accId = accRes.body.id as string;

    // B tenta acessar → 404, não 403, para não vazar existência
    await request(app.getHttpServer())
      .get(`/api/accounts/${accId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);

    // A acessa com sucesso
    await request(app.getHttpServer())
      .get(`/api/accounts/${accId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    // sem token também 401, não 404
    await request(app.getHttpServer()).get(`/api/accounts/${accId}`).expect(401);
  });

  it('GET /api/categories após register retorna categorias padrão com parentId/cor/ícone', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'CatUser', email: 'cat@example.com', password: 'Password123' })
      .expect(201);

    const token = reg.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(8);
    expect(res.body.length).toBeLessThanOrEqual(12);
    for (const cat of res.body as { id: string; name: string; color: string; icon: string; parentId: string | null; userId: string }[]) {
      expect(cat).toHaveProperty('id');
      expect(cat).toHaveProperty('name');
      expect(cat).toHaveProperty('color');
      expect(cat).toHaveProperty('icon');
      expect(cat).toHaveProperty('parentId');
      expect(cat).toHaveProperty('userId', reg.body.user.id);
      expect(typeof cat.color).toBe('string');
      expect(typeof cat.icon).toBe('string');
    }
    const reg2 = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: 'CatUser2', email: 'cat2@example.com', password: 'Password123' })
      .expect(201);
    const token2 = reg2.body.accessToken as string;
    const res2 = await request(app.getHttpServer())
      .get('/api/categories')
      .set('Authorization', `Bearer ${token2}`)
      .expect(200);
    expect(res2.body.length).toBeGreaterThanOrEqual(8);
    expect((res.body as { userId: string }[])[0]!.userId).not.toBe((res2.body as { userId: string }[])[0]!.userId);
  });

  it('GET /api/categories sem token 401', async () => {
    await request(app.getHttpServer()).get('/api/categories').expect(401);
  });
});

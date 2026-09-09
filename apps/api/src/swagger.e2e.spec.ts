import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { setupSwagger } from './swagger';

describe('Swagger - task 4.10', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/docs-json retorna OpenAPI com 20+ rotas', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    const paths = res.body.paths as Record<string, Record<string, unknown>>;
    const names = Object.keys(paths);
    const operations = Object.values(paths).reduce((acc, p) => acc + Object.keys(p).length, 0);
    expect(operations).toBeGreaterThanOrEqual(20);
    expect(names).toContain('/api/auth/login');
    expect(names).toContain('/api/transactions/transfer');
    expect(names).toContain('/api/reports/summary');
    expect(names).toContain('/api/budgets');
    expect(res.body.components?.schemas?.CreateTransactionDto).toBeDefined();
  });

  it('GET /api/docs serve o Swagger UI', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });
});

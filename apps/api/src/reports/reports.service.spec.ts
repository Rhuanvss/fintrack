import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AccountsService } from '../accounts/accounts.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService - task 4.1 summary', () => {
  let service: ReportsService;
  let prisma: {
    transaction: { aggregate: jest.Mock; groupBy: jest.Mock };
    category: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      transaction: { aggregate: jest.fn(), groupBy: jest.fn() },
      category: { findMany: jest.fn() },
    };
    const mod = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccountsService, useValue: { findAll: jest.fn() } },
      ],
    }).compile();
    service = mod.get<ReportsService>(ReportsService);
  });

  it('summary retorna totalIncome 1000, totalExpense 400 e balance 600 para o mes', async () => {
    prisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 1000 } } as never)
      .mockResolvedValueOnce({ _sum: { amount: 400 } } as never);

    const res = await service.summary('user_1', { from: '2026-08-01', to: '2026-08-31' });

    expect(res).toEqual({ totalIncome: 1000, totalExpense: 400, balance: 600 });
    expect(prisma.transaction.aggregate).toHaveBeenCalledTimes(2);
    expect(prisma.transaction.aggregate).toHaveBeenNthCalledWith(1, {
      where: {
        userId: 'user_1',
        type: 'INCOME',
        date: { gte: new Date('2026-08-01'), lte: new Date('2026-08-31') },
      },
      _sum: { amount: true },
    });
    expect(prisma.transaction.aggregate).toHaveBeenNthCalledWith(2, {
      where: {
        userId: 'user_1',
        type: 'EXPENSE',
        date: { gte: new Date('2026-08-01'), lte: new Date('2026-08-31') },
      },
      _sum: { amount: true },
    });
  });

  it('summary retorna zeros quando sem transacoes no periodo', async () => {
    prisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: null } } as never)
      .mockResolvedValueOnce({ _sum: { amount: null } } as never);

    const res = await service.summary('user_1', { from: '2026-08-01', to: '2026-08-31' });

    expect(res).toEqual({ totalIncome: 0, totalExpense: 0, balance: 0 });
  });

  it('summary rejeita intervalo maior que 12 meses', async () => {
    await expect(service.summary('user_1', { from: '2025-01-01', to: '2026-02-01' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
  });

  it('summary aceita intervalo de exatamente 12 meses', async () => {
    prisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 10 } } as never)
      .mockResolvedValueOnce({ _sum: { amount: 4 } } as never);

    const res = await service.summary('user_1', { from: '2026-01-01', to: '2027-01-01' });

    expect(res.balance).toBe(6);
  });

  it('summary rejeita from maior que to', async () => {
    await expect(service.summary('user_1', { from: '2026-08-31', to: '2026-08-01' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
  });

  it('summary rejeita datas invalidas', async () => {
    await expect(service.summary('user_1', { from: 'not-a-date', to: '2026-08-31' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
  });
});

describe('ReportsService - task 4.2 byCategory', () => {
  let service: ReportsService;
  let prisma: {
    transaction: { aggregate: jest.Mock; groupBy: jest.Mock };
    category: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      transaction: { aggregate: jest.fn(), groupBy: jest.fn() },
      category: { findMany: jest.fn() },
    };
    const mod = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccountsService, useValue: { findAll: jest.fn() } },
      ],
    }).compile();
    service = mod.get<ReportsService>(ReportsService);
  });

  it('byCategory retorna ranking ordenado por total desc com percent', async () => {
    prisma.transaction.groupBy.mockResolvedValue([
      { categoryId: 'cat_food', _sum: { amount: 150 } },
      { categoryId: 'cat_fun', _sum: { amount: 300 } },
      { categoryId: 'cat_home', _sum: { amount: 50 } },
    ] as never);
    prisma.category.findMany.mockResolvedValue([
      { id: 'cat_food', name: 'Alimentacao' },
      { id: 'cat_fun', name: 'Lazer' },
      { id: 'cat_home', name: 'Moradia' },
    ] as never);

    const res = await service.byCategory('user_1', { from: '2026-08-01', to: '2026-08-31' });

    expect(res.map((r) => r.categoryId)).toEqual(['cat_fun', 'cat_food', 'cat_home']);
    expect(res.map((r) => r.total)).toEqual([300, 150, 50]);
    expect(res[0]).toEqual({ categoryId: 'cat_fun', categoryName: 'Lazer', total: 300, percent: 60 });
    expect(res[1]!.percent).toBe(30);
    expect(res[2]!.percent).toBe(10);
    expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ['categoryId'],
      where: {
        userId: 'user_1',
        type: 'EXPENSE',
        date: { gte: new Date('2026-08-01'), lte: new Date('2026-08-31') },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    });
  });

  it('byCategory soma apenas EXPENSE (INCOME e TRANSFER fora do where)', async () => {
    prisma.transaction.groupBy.mockResolvedValue([{ categoryId: 'cat_1', _sum: { amount: 200 } }] as never);
    prisma.category.findMany.mockResolvedValue([{ id: 'cat_1', name: 'Alimentacao' }] as never);

    const res = await service.byCategory('user_1', { from: '2026-08-01', to: '2026-08-31' });

    const where = prisma.transaction.groupBy.mock.calls[0]![0].where as Record<string, unknown>;
    expect(where.type).toBe('EXPENSE');
    expect(res).toHaveLength(1);
    expect(res[0]!.total).toBe(200);
    expect(res[0]!.percent).toBe(100);
  });

  it('byCategory aplica filtros accountId e categoryId', async () => {
    prisma.transaction.groupBy.mockResolvedValue([] as never);

    const res = await service.byCategory('user_1', {
      from: '2026-08-01',
      to: '2026-08-31',
      accountId: 'acc_1',
      categoryId: 'cat_1',
    });

    expect(res).toEqual([]);
    expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ['categoryId'],
      where: {
        userId: 'user_1',
        type: 'EXPENSE',
        date: { gte: new Date('2026-08-01'), lte: new Date('2026-08-31') },
        accountId: 'acc_1',
        categoryId: 'cat_1',
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    });
    expect(prisma.category.findMany).not.toHaveBeenCalled();
  });

  it('byCategory retorna vazio quando sem gastos e rejeita intervalo >12m', async () => {
    prisma.transaction.groupBy.mockResolvedValue([] as never);

    const res = await service.byCategory('user_1', { from: '2026-08-01', to: '2026-08-31' });
    expect(res).toEqual([]);

    await expect(service.byCategory('user_1', { from: '2025-01-01', to: '2026-02-01' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('byCategory rotula grupo sem categoria como Sem categoria', async () => {
    prisma.transaction.groupBy.mockResolvedValue([{ categoryId: null, _sum: { amount: 80 } }] as never);

    const res = await service.byCategory('user_1', { from: '2026-08-01', to: '2026-08-31' });

    expect(res).toEqual([{ categoryId: null, categoryName: 'Sem categoria', total: 80, percent: 100 }]);
    expect(prisma.category.findMany).not.toHaveBeenCalled();
  });
});

describe('ReportsService - task 4.3 evolution', () => {
  let service: ReportsService;
  let prisma: {
    transaction: { aggregate: jest.Mock; groupBy: jest.Mock };
    category: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      transaction: { aggregate: jest.fn(), groupBy: jest.fn() },
      category: { findMany: jest.fn() },
    };
    const mod = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccountsService, useValue: { findAll: jest.fn() } },
      ],
    }).compile();
    service = mod.get<ReportsService>(ReportsService);
  });

  function seedJanAug2026(): void {
    const fixtures: Record<string, Array<{ type: string; _sum: { amount: number } }>> = {
      '2026-0': [
        { type: 'INCOME', _sum: { amount: 1000 } },
        { type: 'EXPENSE', _sum: { amount: 400 } },
      ],
      '2026-2': [{ type: 'EXPENSE', _sum: { amount: 250 } }],
      '2026-6': [
        { type: 'INCOME', _sum: { amount: 500 } },
        { type: 'EXPENSE', _sum: { amount: 500 } },
      ],
    };
    prisma.transaction.groupBy.mockImplementation((args: unknown) => {
      const where = (args as { where: { date: { gte: Date } } }).where;
      const gte = where.date.gte;
      const key = `${gte.getUTCFullYear()}-${gte.getUTCMonth()}`;
      return Promise.resolve((fixtures[key] ?? []) as never);
    });
  }

  it('evolution retorna 8 meses Jan-Ago com zeros nos meses vazios', async () => {
    seedJanAug2026();

    const res = await service.evolution('user_1', { from: '2026-01-01', to: '2026-08-31' });

    expect(res).toHaveLength(8);
    expect(res.map((r) => [r.month, r.year])).toEqual([
      [1, 2026],
      [2, 2026],
      [3, 2026],
      [4, 2026],
      [5, 2026],
      [6, 2026],
      [7, 2026],
      [8, 2026],
    ]);
    expect(res[0]).toEqual({ month: 1, year: 2026, income: 1000, expense: 400, balance: 600 });
    expect(res[1]).toEqual({ month: 2, year: 2026, income: 0, expense: 0, balance: 0 });
    expect(res[2]).toEqual({ month: 3, year: 2026, income: 0, expense: 250, balance: -250 });
    expect(res[6]).toEqual({ month: 7, year: 2026, income: 500, expense: 500, balance: 0 });
    expect(res[7]).toEqual({ month: 8, year: 2026, income: 0, expense: 0, balance: 0 });
    expect(prisma.transaction.groupBy).toHaveBeenCalledTimes(8);
  });

  it('evolution agrupa por tipo somando apenas INCOME e EXPENSE', async () => {
    seedJanAug2026();

    await service.evolution('user_1', { from: '2026-01-01', to: '2026-01-31' });

    expect(prisma.transaction.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
      by: ['type'],
      where: {
        userId: 'user_1',
        type: { in: ['INCOME', 'EXPENSE'] },
        date: { gte: new Date(Date.UTC(2026, 0, 1)), lt: new Date(Date.UTC(2026, 1, 1)) },
      },
      _sum: { amount: true },
    });
  });

  it('evolution aplica filtros accountId e categoryId', async () => {
    prisma.transaction.groupBy.mockResolvedValue([] as never);

    const res = await service.evolution('user_1', {
      from: '2026-01-01',
      to: '2026-02-28',
      accountId: 'acc_1',
      categoryId: 'cat_1',
    });

    expect(res).toHaveLength(2);
    const where = prisma.transaction.groupBy.mock.calls[0]![0].where as Record<string, unknown>;
    expect(where).toMatchObject({ userId: 'user_1', accountId: 'acc_1', categoryId: 'cat_1' });
  });

  it('evolution rejeita intervalo maior que 12 meses e from maior que to', async () => {
    await expect(service.evolution('user_1', { from: '2025-01-01', to: '2026-02-01' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.evolution('user_1', { from: '2026-08-31', to: '2026-08-01' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.transaction.groupBy).not.toHaveBeenCalled();
  });
});

describe('ReportsService - task 4.4 balances', () => {
  let service: ReportsService;
  let accounts: { findAll: jest.Mock };

  beforeEach(async () => {
    accounts = { findAll: jest.fn() };
    const mod = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: { transaction: {}, category: {} } },
        { provide: AccountsService, useValue: accounts },
      ],
    }).compile();
    service = mod.get<ReportsService>(ReportsService);
  });

  it('balances mapeia contas para accountId/accountName/balance', async () => {
    accounts.findAll.mockResolvedValue([
      { id: 'acc_1', name: 'Carteira', balance: 600 },
      { id: 'acc_2', name: 'Banco', balance: 0 },
    ] as never);

    const res = await service.balances('user_1');

    expect(res).toEqual([
      { accountId: 'acc_1', accountName: 'Carteira', balance: 600 },
      { accountId: 'acc_2', accountName: 'Banco', balance: 0 },
    ]);
    expect(accounts.findAll).toHaveBeenCalledWith('user_1');
  });

  it('balances retorna vazio quando usuario sem contas', async () => {
    accounts.findAll.mockResolvedValue([] as never);

    const res = await service.balances('user_1');

    expect(res).toEqual([]);
  });
});

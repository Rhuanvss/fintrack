import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetsService } from './budgets.service';

describe('BudgetsService - task 3.8', () => {
  let service: BudgetsService;
  let prisma: {
    budget: { upsert: jest.Mock; findMany: jest.Mock };
    category: { findFirst: jest.Mock };
    transaction: { aggregate: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      budget: { upsert: jest.fn(), findMany: jest.fn() },
      category: { findFirst: jest.fn() },
      transaction: { aggregate: jest.fn() },
    };
    const mod = await Test.createTestingModule({
      providers: [BudgetsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get<BudgetsService>(BudgetsService);
  });

  it('upsert cria ou atualiza via unique userId_categoryId_month_year', async () => {
    prisma.category.findFirst.mockResolvedValue({ id: 'cat_1', userId: 'user_1' } as never);
    const budget = { id: 'bud_1', userId: 'user_1', categoryId: 'cat_1', month: 8, year: 2026, amount: 500, createdAt: new Date(), updatedAt: new Date() };
    prisma.budget.upsert.mockResolvedValue(budget as never);

    const res = await service.upsert('user_1', { categoryId: 'cat_1', month: 8, year: 2026, amount: 500 });
    expect(res.id).toBe('bud_1');
    expect(prisma.budget.upsert).toHaveBeenCalledWith({
      where: { userId_categoryId_month_year: { userId: 'user_1', categoryId: 'cat_1', month: 8, year: 2026 } },
      create: { userId: 'user_1', categoryId: 'cat_1', month: 8, year: 2026, amount: 500 },
      update: { amount: 500 },
    });
  });

  it('upsert 404 se category de outro user', async () => {
    prisma.category.findFirst.mockResolvedValue(null as never);
    await expect(service.upsert('user_1', { categoryId: 'cat_other', month: 8, year: 2026, amount: 100 })).rejects.toThrow(NotFoundException);
  });

  it('list calcula spent soma apenas EXPENSE e percent 50% com budget 500 e gasto 250', async () => {
    const cat = { id: 'cat_1', name: 'Alimentacao', color: null, icon: null, parentId: null, userId: 'user_1', createdAt: new Date(), updatedAt: new Date() };
    const budget = { id: 'bud_1', userId: 'user_1', categoryId: 'cat_1', month: 8, year: 2026, amount: 500, createdAt: new Date(), updatedAt: new Date(), category: cat };
    prisma.budget.findMany.mockResolvedValue([budget] as never);
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 250 } } as never);

    const res = await service.list('user_1', { month: 8, year: 2026 });
    expect(res).toHaveLength(1);
    expect(res[0]!.spent).toBe(250);
    expect(res[0]!.percentUsed).toBe(50);
    expect(res[0]!.category?.name).toBe('Alimentacao');
    expect(prisma.transaction.aggregate).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        categoryId: 'cat_1',
        type: 'EXPENSE',
        date: { gte: new Date(Date.UTC(2026, 7, 1)), lt: new Date(Date.UTC(2026, 8, 1)) },
      },
      _sum: { amount: true },
    });
  });

  it('list spent soma apenas EXPENSE ignora INCOME e TRANSFER', async () => {
    const cat = { id: 'cat_2', name: 'Transporte', color: null, icon: null, parentId: null, userId: 'user_1', createdAt: new Date(), updatedAt: new Date() };
    const budget = { id: 'bud_2', userId: 'user_1', categoryId: 'cat_2', month: 8, year: 2026, amount: 1000, createdAt: new Date(), updatedAt: new Date(), category: cat };
    prisma.budget.findMany.mockResolvedValue([budget] as never);
    // Simulate aggregate returning sum of EXPENSE only (INCOME/TRANSFER not counted by where type:EXPENSE)
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 100 } } as never);

    const res = await service.list('user_1', { month: 8, year: 2026 });
    expect(res[0]!.spent).toBe(100);
    expect(res[0]!.percentUsed).toBe(10);
  });

  it('list spent 0 e percent 0 quando sem transacoes', async () => {
    const cat = { id: 'cat_1', name: 'Lazer', color: null, icon: null, parentId: null, userId: 'user_1', createdAt: new Date(), updatedAt: new Date() };
    const budget = { id: 'bud_1', userId: 'user_1', categoryId: 'cat_1', month: 8, year: 2026, amount: 300, createdAt: new Date(), updatedAt: new Date(), category: cat };
    prisma.budget.findMany.mockResolvedValue([budget] as never);
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: null } } as never);

    const res = await service.list('user_1', { month: 8, year: 2026 });
    expect(res[0]!.spent).toBe(0);
    expect(res[0]!.percentUsed).toBe(0);
  });

  it('list retorna vazio quando sem budgets', async () => {
    prisma.budget.findMany.mockResolvedValue([] as never);
    const res = await service.list('user_1', { month: 8, year: 2026 });
    expect(res).toHaveLength(0);
    expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
  });

  it('list calcula percent corretamente para amount zero', async () => {
    const cat = { id: 'cat_1', name: 'Teste', color: null, icon: null, parentId: null, userId: 'user_1', createdAt: new Date(), updatedAt: new Date() };
    const budget = { id: 'bud_1', userId: 'user_1', categoryId: 'cat_1', month: 8, year: 2026, amount: 0, createdAt: new Date(), updatedAt: new Date(), category: cat };
    prisma.budget.findMany.mockResolvedValue([budget] as never);
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 100 } } as never);

    const res = await service.list('user_1', { month: 8, year: 2026 });
    expect(res[0]!.percentUsed).toBe(0);
  });
});

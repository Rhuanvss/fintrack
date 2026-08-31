import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';

describe('TransactionsService - task 3.3 filtros', () => {
  let service: TransactionsService;
  let prisma: {
    transaction: { findMany: jest.Mock; count: jest.Mock; create: jest.Mock; findFirst: jest.Mock; update: jest.Mock; delete: jest.Mock };
    account: { findFirst: jest.Mock };
    category: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      transaction: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
      account: { findFirst: jest.fn().mockResolvedValue({ id: 'acc_1', userId: 'user_1' } as never) },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 'cat_1', userId: 'user_1' } as never) },
    };
    const mod = await Test.createTestingModule({
      providers: [TransactionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get<TransactionsService>(TransactionsService);
  });

  it('filtra por from/to (date gte/lte)', async () => {
    await service.list('user_1', { from: '2026-01-01', to: '2026-01-31' });
    expect(prisma.transaction.count).toHaveBeenCalledWith({
      where: { userId: 'user_1', date: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') } },
    });
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_1', date: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') } },
      }),
    );
  });

  it('filtra por categoryId e accountId', async () => {
    await service.list('user_1', { categoryId: 'cat_1', accountId: 'acc_1' });
    expect(prisma.transaction.count).toHaveBeenCalledWith({
      where: { userId: 'user_1', categoryId: 'cat_1', accountId: 'acc_1' },
    });
    expect(prisma.account.findFirst).toHaveBeenCalledWith({ where: { id: 'acc_1', userId: 'user_1' } });
    expect(prisma.category.findFirst).toHaveBeenCalledWith({ where: { id: 'cat_1', userId: 'user_1' } });
  });

  it('filtra por q em description case-insensitive (ilike)', async () => {
    await service.list('user_1', { q: 'mercado' });
    expect(prisma.transaction.count).toHaveBeenCalledWith({
      where: { userId: 'user_1', description: { contains: 'mercado', mode: 'insensitive' } },
    });
    await service.list('user_1', { q: 'MERCADO' });
    expect(prisma.transaction.count).toHaveBeenLastCalledWith({
      where: { userId: 'user_1', description: { contains: 'MERCADO', mode: 'insensitive' } },
    });
  });

  it('combina from/to + categoryId + q corretamente', async () => {
    await service.list('user_1', { from: '2026-01-01', to: '2026-01-31', categoryId: 'cat_1', q: 'mercado' });
    expect(prisma.transaction.count).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        date: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') },
        categoryId: 'cat_1',
        description: { contains: 'mercado', mode: 'insensitive' },
      },
    });
  });

  it('filtra completo from/to + categoryId + accountId + q', async () => {
    await service.list('user_1', { from: '2026-01-01', to: '2026-01-31', categoryId: 'cat_1', accountId: 'acc_1', q: 'mercado' });
    const expectedWhere = {
      userId: 'user_1',
      date: { gte: new Date('2026-01-01'), lte: new Date('2026-01-31') },
      categoryId: 'cat_1',
      accountId: 'acc_1',
      description: { contains: 'mercado', mode: 'insensitive' },
    };
    expect(prisma.transaction.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }));
  });

  it('retorna 404 se accountId de outro user', async () => {
    prisma.account.findFirst.mockResolvedValue(null as never);
    await expect(service.list('user_1', { accountId: 'acc_other' })).rejects.toThrow(NotFoundException);
    expect(prisma.transaction.count).not.toHaveBeenCalled();
  });

  it('retorna 404 se categoryId de outro user', async () => {
    prisma.category.findFirst.mockResolvedValue(null as never);
    await expect(service.list('user_1', { categoryId: 'cat_other' })).rejects.toThrow(NotFoundException);
  });

  it('mantem paginacao e ordenacao com filtros', async () => {
    prisma.transaction.count.mockResolvedValue(3 as never);
    prisma.transaction.findMany.mockResolvedValue([] as never);
    const res = await service.list('user_1', { page: 2, limit: 2, q: 'mercado' });
    expect(res.page).toBe(2);
    expect(res.limit).toBe(2);
    expect(res.hasNext).toBe(false);
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        skip: 2,
        take: 2,
      }),
    );
  });
});

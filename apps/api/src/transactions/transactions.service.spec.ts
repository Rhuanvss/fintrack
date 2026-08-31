import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';

describe('TransactionsService - task 3.2', () => {
  let service: TransactionsService;
  let prisma: {
    transaction: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; count: jest.Mock; update: jest.Mock; delete: jest.Mock };
    account: { findFirst: jest.Mock };
    category: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      transaction: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), delete: jest.fn() },
      account: { findFirst: jest.fn() },
      category: { findFirst: jest.fn() },
    };
    const mod = await Test.createTestingModule({
      providers: [TransactionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get<TransactionsService>(TransactionsService);
  });

  it('create valida account e category e persiste', async () => {
    prisma.account.findFirst.mockResolvedValue({ id: 'acc_1', userId: 'user_1' } as never);
    prisma.category.findFirst.mockResolvedValue({ id: 'cat_1', userId: 'user_1' } as never);
    const created = { id: 'tx_1', type: 'EXPENSE', amount: 49.9, date: new Date(), description: 'Mercado', accountId: 'acc_1', categoryId: 'cat_1', userId: 'user_1', transferId: null, createdAt: new Date(), updatedAt: new Date() };
    prisma.transaction.create.mockResolvedValue(created as never);

    const res = await service.create('user_1', {
      type: 'EXPENSE',
      amount: 49.9,
      date: new Date().toISOString(),
      description: 'Mercado',
      accountId: 'acc_1',
      categoryId: 'cat_1',
    });

    expect(res.id).toBe('tx_1');
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'EXPENSE', accountId: 'acc_1', categoryId: 'cat_1', userId: 'user_1' }),
    });
  });

  it('create 404 se account de outro user', async () => {
    prisma.account.findFirst.mockResolvedValue(null as never);
    await expect(
      service.create('user_1', {
        type: 'EXPENSE',
        amount: 10,
        date: new Date().toISOString(),
        description: 'X',
        accountId: 'acc_other',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('list paginacao retorna total/hasNext correto', async () => {
    const mk = (id: string, date: string) => ({ id, type: 'EXPENSE', amount: 10, date: new Date(date), description: 'D', accountId: 'acc_1', categoryId: null, userId: 'user_1', transferId: null, createdAt: new Date(), updatedAt: new Date() });

    // total 5, limit 2
    prisma.transaction.count.mockResolvedValue(5 as never);
    prisma.transaction.findMany.mockResolvedValue([mk('5', '2026-03-03'), mk('4', '2026-03-02')] as never);
    const p1 = await service.list('user_1', { page: 1, limit: 2 });
    expect(p1.total).toBe(5);
    expect(p1.page).toBe(1);
    expect(p1.limit).toBe(2);
    expect(p1.hasNext).toBe(true);
    expect(prisma.transaction.findMany).toHaveBeenCalledWith({ where: { userId: 'user_1' }, orderBy: [{ date: 'desc' }, { id: 'desc' }], skip: 0, take: 2 });
    expect(prisma.transaction.count).toHaveBeenCalledWith({ where: { userId: 'user_1' } });

    prisma.transaction.findMany.mockResolvedValue([mk('3', '2026-03-01'), mk('2', '2026-02-28')] as never);
    const p2 = await service.list('user_1', { page: 2, limit: 2 });
    expect(p2.hasNext).toBe(true);
    expect(p2.items).toHaveLength(2);

    prisma.transaction.findMany.mockResolvedValue([mk('1', '2026-02-27')] as never);
    const p3 = await service.list('user_1', { page: 3, limit: 2 });
    expect(p3.hasNext).toBe(false);
    expect(p3.items).toHaveLength(1);

    // page 1 limit 10 total 5 => hasNext false
    prisma.transaction.count.mockResolvedValue(5 as never);
    prisma.transaction.findMany.mockResolvedValue([mk('5', '2026-03-03'), mk('4', '2026-03-02'), mk('3', '2026-03-01'), mk('2', '2026-02-28'), mk('1', '2026-02-27')] as never);
    const pAll = await service.list('user_1', { page: 1, limit: 10 });
    expect(pAll.hasNext).toBe(false);
    expect(pAll.total).toBe(5);
  });

  it('list ordenacao date desc id desc e isolamento por user', async () => {
    prisma.transaction.count.mockResolvedValue(0 as never);
    prisma.transaction.findMany.mockResolvedValue([] as never);
    await service.list('user_1', {});
    expect(prisma.transaction.count).toHaveBeenCalledWith({ where: { userId: 'user_1' } });
    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 20,
    });
  });

  it('list defaults page 1 limit 20 e clamp', async () => {
    prisma.transaction.count.mockResolvedValue(0 as never);
    prisma.transaction.findMany.mockResolvedValue([] as never);
    await service.list('user_1', { page: 0, limit: 100 });
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 50 }));
  });

  it('update/delete 404 se de outro user', async () => {
    prisma.transaction.findFirst.mockResolvedValue(null as never);
    await expect(service.update('tx_1', 'user_1', { description: 'Novo' })).rejects.toThrow(NotFoundException);
    await expect(service.remove('tx_1', 'user_1')).rejects.toThrow(NotFoundException);
  });

  it('update valida nova account/category', async () => {
    prisma.transaction.findFirst.mockResolvedValue({ id: 'tx_1', userId: 'user_1', accountId: 'acc_1' } as never);
    prisma.account.findFirst.mockResolvedValue(null as never);
    await expect(service.update('tx_1', 'user_1', { accountId: 'acc_other' })).rejects.toThrow(NotFoundException);

    prisma.account.findFirst.mockResolvedValue({ id: 'acc_1', userId: 'user_1' } as never);
    prisma.category.findFirst.mockResolvedValue(null as never);
    await expect(service.update('tx_1', 'user_1', { categoryId: 'cat_other' })).rejects.toThrow(NotFoundException);
  });
});

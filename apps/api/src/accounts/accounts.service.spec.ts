import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from './accounts.service';

describe('AccountsService - task 2.7', () => {
  let service: AccountsService;
  let prisma: {
    account: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    transaction: {
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      account: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        findMany: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  it('computeBalance 170 with 2 incomes 100 and 1 expense 30', async () => {
    const accountId = 'acc_1';
    const userId = 'user_1';
    prisma.account.findFirst.mockResolvedValue({ id: accountId, userId } as never);
    prisma.transaction.findMany.mockResolvedValue([
      { amount: 100 as unknown as never, type: 'INCOME', transferId: null },
      { amount: 100 as unknown as never, type: 'INCOME', transferId: null },
      { amount: 30 as unknown as never, type: 'EXPENSE', transferId: null },
    ] as never);

    const balance = await service.computeBalance(accountId, userId);
    expect(balance).toBe(170);
    expect(prisma.account.findFirst).toHaveBeenCalledWith({ where: { id: accountId, userId } });
    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: { accountId, userId },
      select: { amount: true, type: true, transferId: true },
    });
  });

  it('computeBalance throws 404 if account not found or not owned', async () => {
    prisma.account.findFirst.mockResolvedValue(null as never);
    await expect(service.computeBalance('acc_x', 'user_1')).rejects.toThrow(NotFoundException);
  });

  it('computeBalance handles TRANSFER direction correctly', async () => {
    const accountId = 'acc_src';
    const userId = 'user_1';
    prisma.account.findFirst.mockResolvedValue({ id: accountId, userId } as never);
    prisma.transaction.findMany
      .mockResolvedValueOnce([
        { amount: 100 as unknown as never, type: 'INCOME', transferId: null },
        { amount: 50 as unknown as never, type: 'TRANSFER', transferId: 'tx_1' },
        { amount: 30 as unknown as never, type: 'TRANSFER', transferId: 'tx_2' },
      ] as never)
      .mockResolvedValueOnce([
        { transferId: 'tx_1', accountId: 'acc_dst' },
        { transferId: 'tx_2', accountId: accountId },
      ] as never);

    const balance = await service.computeBalance(accountId, userId);
    expect(balance).toBe(80);
  });

  it('create delegates to prisma.account.create and returns with balance', async () => {
    const userId = 'user_1';
    const dto = { name: 'Carteira', type: 'WALLET' as const, color: '#FF6B6B' };
    const created = {
      id: 'acc_1',
      name: 'Carteira',
      type: 'WALLET',
      color: '#FF6B6B',
      isArchived: false,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.account.create.mockResolvedValue(created as never);
    prisma.account.findFirst.mockResolvedValue(created as never);
    prisma.transaction.findMany.mockResolvedValue([] as never);

    const result = await service.create(userId, dto as never);
    expect(prisma.account.create).toHaveBeenCalledWith({
      data: { name: 'Carteira', type: 'WALLET', color: '#FF6B6B', userId },
    });
    expect(result).toEqual({ ...created, balance: 0 });
  });

  it('findAll filters isArchived false by default', async () => {
    const userId = 'user_1';
    const acc1 = { id: '1', name: 'A', type: 'WALLET', color: null, isArchived: false, userId, createdAt: new Date(), updatedAt: new Date() };
    const acc2 = { id: '2', name: 'B', type: 'WALLET', color: null, isArchived: true, userId, createdAt: new Date(), updatedAt: new Date() };
    prisma.account.findMany.mockResolvedValue([acc1] as never);
    prisma.account.findFirst.mockResolvedValue(acc1 as never);
    prisma.transaction.findMany.mockResolvedValue([] as never);

    const result = await service.findAll(userId);
    expect(prisma.account.findMany).toHaveBeenCalledWith({ where: { userId, isArchived: false }, orderBy: { createdAt: 'asc' } });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('1');

    prisma.account.findMany.mockResolvedValue([acc1, acc2] as never);
    const withArchived = await service.findAll(userId, true);
    expect(prisma.account.findMany).toHaveBeenCalledWith({ where: { userId }, orderBy: { createdAt: 'asc' } });
    expect(withArchived).toHaveLength(2);
  });

  it('archive sets isArchived true', async () => {
    const userId = 'user_1';
    const acc = { id: 'acc_1', name: 'A', type: 'WALLET', color: null, isArchived: false, userId, createdAt: new Date(), updatedAt: new Date() };
    prisma.account.findFirst.mockResolvedValue(acc as never);
    const archived = { ...acc, isArchived: true };
    prisma.account.update.mockResolvedValue(archived as never);
    prisma.transaction.findMany.mockResolvedValue([] as never);

    const result = await service.archive('acc_1', userId);
    expect(prisma.account.update).toHaveBeenCalledWith({ where: { id: 'acc_1' }, data: { isArchived: true } });
    expect(result.isArchived).toBe(true);
  });
});

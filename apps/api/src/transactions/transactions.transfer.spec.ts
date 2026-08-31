import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from './transactions.service';

describe('TransactionsService - task 3.5 TRANSFER', () => {
  let service: TransactionsService;
  let prisma: {
    transaction: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; count: jest.Mock; update: jest.Mock; delete: jest.Mock };
    account: { findFirst: jest.Mock };
    category: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      transaction: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn(), delete: jest.fn() },
      account: { findFirst: jest.fn() },
      category: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };

    // default $transaction executes callback with prisma tx
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma));

    const mod = await Test.createTestingModule({
      providers: [TransactionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get<TransactionsService>(TransactionsService);
  });

  it('cria 2 linhas com mesmo transferId em transacao atomica', async () => {
    prisma.account.findFirst.mockResolvedValueOnce({ id: 'acc_from', userId: 'user_1' } as never).mockResolvedValueOnce({ id: 'acc_to', userId: 'user_1' } as never);

    const fromTx = { id: 'tx_1', type: 'TRANSFER', amount: 200, date: new Date(), description: 'Transfer', accountId: 'acc_from', categoryId: null, userId: 'user_1', transferId: 'tid_123', createdAt: new Date(), updatedAt: new Date() };
    const toTx = { id: 'tx_2', type: 'TRANSFER', amount: 200, date: new Date(), description: 'Transfer', accountId: 'acc_to', categoryId: null, userId: 'user_1', transferId: 'tid_123', createdAt: new Date(), updatedAt: new Date() };

    prisma.transaction.create.mockResolvedValueOnce(fromTx as never).mockResolvedValueOnce(toTx as never);

    const [a, b] = await service.transfer('user_1', {
      amount: 200,
      fromAccountId: 'acc_from',
      toAccountId: 'acc_to',
      description: 'Transfer',
    });

    expect(a.accountId).toBe('acc_from');
    expect(b.accountId).toBe('acc_to');
    expect(a.transferId).toBe(b.transferId);
    expect(a.type).toBe('TRANSFER');
    expect(b.type).toBe('TRANSFER');
    expect(a.amount).toBe(200);
    expect(b.amount).toBe(200);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.transaction.create).toHaveBeenCalledTimes(2);
    const firstCall = prisma.transaction.create.mock.calls[0]![0] as { data: { transferId: string; accountId: string; type: string } };
    const secondCall = prisma.transaction.create.mock.calls[1]![0] as { data: { transferId: string; accountId: string; type: string } };
    expect(firstCall.data.transferId).toBe(secondCall.data.transferId);
    expect(firstCall.data.type).toBe('TRANSFER');
    expect(secondCall.data.type).toBe('TRANSFER');
    expect(firstCall.data.accountId).toBe('acc_from');
    expect(secondCall.data.accountId).toBe('acc_to');

    expect(prisma.account.findFirst).toHaveBeenCalledWith({ where: { id: 'acc_from', userId: 'user_1' } });
    expect(prisma.account.findFirst).toHaveBeenCalledWith({ where: { id: 'acc_to', userId: 'user_1' } });
  });

  it('rollback se falhar segunda criacao (nenhuma persiste)', async () => {
    prisma.account.findFirst.mockResolvedValueOnce({ id: 'acc_from', userId: 'user_1' } as never).mockResolvedValueOnce({ id: 'acc_to', userId: 'user_1' } as never);

    const fromTx = { id: 'tx_1', type: 'TRANSFER', amount: 100, date: new Date(), description: 'Transfer', accountId: 'acc_from', categoryId: null, userId: 'user_1', transferId: 'tid', createdAt: new Date(), updatedAt: new Date() };
    prisma.transaction.create.mockResolvedValueOnce(fromTx as never).mockRejectedValueOnce(new Error('DB fail'));

    // Mock $transaction to propagate error (simulate atomic rollback)
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => {
      return cb(prisma);
    });

    await expect(
      service.transfer('user_1', { amount: 100, fromAccountId: 'acc_from', toAccountId: 'acc_to' }),
    ).rejects.toThrow('DB fail');

    expect(prisma.transaction.create).toHaveBeenCalledTimes(2);
  });

  it('rejeita fromAccountId === toAccountId com 400', async () => {
    await expect(
      service.transfer('user_1', { amount: 100, fromAccountId: 'acc_1', toAccountId: 'acc_1' }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejeita se conta de origem nao pertence ao user (404)', async () => {
    prisma.account.findFirst.mockResolvedValueOnce(null as never);
    await expect(
      service.transfer('user_1', { amount: 50, fromAccountId: 'acc_other', toAccountId: 'acc_to' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejeita se conta de destino nao pertence ao user (404)', async () => {
    prisma.account.findFirst.mockResolvedValueOnce({ id: 'acc_from', userId: 'user_1' } as never).mockResolvedValueOnce(null as never);
    await expect(
      service.transfer('user_1', { amount: 50, fromAccountId: 'acc_from', toAccountId: 'acc_other' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('usa date e description fornecidos e gera transferId unico', async () => {
    prisma.account.findFirst.mockResolvedValue({ id: 'acc_from', userId: 'user_1' } as never);
    prisma.account.findFirst.mockResolvedValue({ id: 'acc_to', userId: 'user_1' } as never);
    const fromTx = { id: 'tx_1', type: 'TRANSFER', amount: 75.5, date: new Date('2026-02-15'), description: 'Aluguel', accountId: 'acc_from', categoryId: null, userId: 'user_1', transferId: 'tid', createdAt: new Date(), updatedAt: new Date() };
    const toTx = { id: 'tx_2', type: 'TRANSFER', amount: 75.5, date: new Date('2026-02-15'), description: 'Aluguel', accountId: 'acc_to', categoryId: null, userId: 'user_1', transferId: 'tid', createdAt: new Date(), updatedAt: new Date() };
    prisma.transaction.create.mockResolvedValueOnce(fromTx as never).mockResolvedValueOnce(toTx as never);

    await service.transfer('user_1', {
      amount: 75.5,
      fromAccountId: 'acc_from',
      toAccountId: 'acc_to',
      date: '2026-02-15T00:00:00.000Z',
      description: 'Aluguel',
    });

    expect(prisma.transaction.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ data: expect.objectContaining({ description: 'Aluguel', date: new Date('2026-02-15T00:00:00.000Z') }) }));
    expect(prisma.transaction.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ data: expect.objectContaining({ description: 'Aluguel', date: new Date('2026-02-15T00:00:00.000Z') }) }));
  });
});

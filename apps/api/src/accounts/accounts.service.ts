import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateAccountDto } from './dto/create-account.dto';
import type { UpdateAccountDto } from './dto/update-account.dto';

export interface AccountWithBalance {
  id: string;
  name: string;
  type: string;
  color: string | null;
  isArchived: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  balance: number;
}

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAccountDto): Promise<AccountWithBalance> {
    const account = await this.prisma.account.create({
      data: {
        name: dto.name,
        type: dto.type,
        color: dto.color ?? null,
        userId,
      },
    });
    const balance = await this.computeBalance(account.id, userId);
    return { ...account, balance };
  }

  async findAll(userId: string, includeArchived = false): Promise<AccountWithBalance[]> {
    const where = includeArchived ? { userId } : { userId, isArchived: false };
    const accounts = await this.prisma.account.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    if (accounts.length === 0) return [];

    const accountIds = accounts.map((a) => a.id);
    const transactions = await this.prisma.transaction.findMany({
      where: { accountId: { in: accountIds }, userId },
      select: { id: true, amount: true, type: true, transferId: true, accountId: true, createdAt: true },
    });

    const transferIds = [...new Set(transactions.filter((tx) => tx.type === 'TRANSFER' && tx.transferId).map((tx) => tx.transferId!))];
    const sourceMap = new Map<string, string>();
    if (transferIds.length > 0) {
      const paired = await this.prisma.transaction.findMany({
        where: { transferId: { in: transferIds } },
        select: { transferId: true, accountId: true, createdAt: true, id: true },
        orderBy: { createdAt: 'asc' },
      });
      for (const tid of transferIds) {
        const group = paired.filter((p) => p.transferId === tid).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
        if (group.length > 0) sourceMap.set(tid, group[0]!.accountId);
      }
    }

    const byAccount = new Map<string, typeof transactions>();
    for (const tx of transactions) {
      const arr = byAccount.get(tx.accountId) ?? [];
      arr.push(tx);
      byAccount.set(tx.accountId, arr);
    }

    return accounts.map((acc) => {
      const txs = byAccount.get(acc.id) ?? [];
      let balance = 0;
      for (const tx of txs) {
        const amount = Number(tx.amount);
        if (tx.type === 'INCOME') balance += amount;
        else if (tx.type === 'EXPENSE') balance -= amount;
        else if (tx.type === 'TRANSFER') {
          if (!tx.transferId) {
            balance += amount;
            continue;
          }
          const src = sourceMap.get(tx.transferId);
          balance += src === acc.id ? -amount : amount;
        }
      }
      return { ...acc, balance };
    });
  }

  async findOne(id: string, userId: string): Promise<AccountWithBalance> {
    const account = await this.prisma.account.findFirst({
      where: { id, userId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    const balance = await this.computeBalance(account.id, userId);
    return { ...account, balance };
  }

  async update(id: string, userId: string, dto: UpdateAccountDto): Promise<AccountWithBalance> {
    const existing = await this.prisma.account.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Account not found');
    }
    const data: Prisma.AccountUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.color !== undefined) data.color = dto.color;
    const updated = await this.prisma.account.update({
      where: { id },
      data,
    });
    const balance = await this.computeBalance(updated.id, userId);
    return { ...updated, balance };
  }

  async archive(id: string, userId: string): Promise<AccountWithBalance> {
    const existing = await this.prisma.account.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException('Account not found');
    }
    const archived = await this.prisma.account.update({
      where: { id },
      data: { isArchived: true },
    });
    const balance = await this.computeBalance(archived.id, userId);
    return { ...archived, balance };
  }

  async computeBalance(accountId: string, userId: string): Promise<number> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    const transactions = await this.prisma.transaction.findMany({
      where: { accountId, userId },
      select: { id: true, amount: true, type: true, transferId: true, createdAt: true },
    });

    const transferIds = [...new Set(transactions.filter((tx) => tx.type === 'TRANSFER' && tx.transferId).map((tx) => tx.transferId!))];
    const sourceMap = new Map<string, string>();
    if (transferIds.length > 0) {
      const paired = await this.prisma.transaction.findMany({
        where: { transferId: { in: transferIds } },
        select: { transferId: true, accountId: true, createdAt: true, id: true },
        orderBy: { createdAt: 'asc' },
      });
      for (const tid of transferIds) {
        const group = paired.filter((p) => p.transferId === tid).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
        if (group.length > 0) sourceMap.set(tid, group[0]!.accountId);
      }
    }

    let balance = 0;
    for (const tx of transactions) {
      const amount = Number(tx.amount);
      if (tx.type === 'INCOME') {
        balance += amount;
      } else if (tx.type === 'EXPENSE') {
        balance -= amount;
      } else if (tx.type === 'TRANSFER') {
        if (!tx.transferId) {
          balance += amount;
          continue;
        }
        const sourceAccountId = sourceMap.get(tx.transferId);
        balance += sourceAccountId === accountId ? -amount : amount;
      }
    }
    return balance;
  }
}

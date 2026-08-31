import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTransactionDto } from './dto/create-transaction.dto';
import type { CreateTransferDto } from './dto/create-transfer.dto';
import type { UpdateTransactionDto } from './dto/update-transaction.dto';

export interface PaginatedTransactions {
  items: {
    id: string;
    type: string;
    amount: unknown;
    date: Date;
    description: string;
    accountId: string;
    categoryId: string | null;
    userId: string;
    transferId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertAccount(userId: string, accountId: string): Promise<void> {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new NotFoundException('Account not found');
  }

  private async assertCategory(userId: string, categoryId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) throw new NotFoundException('Category not found');
  }

  async create(userId: string, dto: CreateTransactionDto): Promise<{
    id: string;
    type: string;
    amount: unknown;
    date: Date;
    description: string;
    accountId: string;
    categoryId: string | null;
    userId: string;
    transferId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> {
    await this.assertAccount(userId, dto.accountId);
    if (dto.categoryId) await this.assertCategory(userId, dto.categoryId);

    return this.prisma.transaction.create({
      data: {
        type: dto.type as never,
        amount: dto.amount as never,
        date: new Date(dto.date),
        description: dto.description,
        accountId: dto.accountId,
        categoryId: dto.categoryId ?? null,
        userId,
      },
    });
  }

  async transfer(
    userId: string,
    dto: CreateTransferDto,
  ): Promise<
    [
      {
        id: string;
        type: string;
        amount: unknown;
        date: Date;
        description: string;
        accountId: string;
        categoryId: string | null;
        userId: string;
        transferId: string | null;
        createdAt: Date;
        updatedAt: Date;
      },
      {
        id: string;
        type: string;
        amount: unknown;
        date: Date;
        description: string;
        accountId: string;
        categoryId: string | null;
        userId: string;
        transferId: string | null;
        createdAt: Date;
        updatedAt: Date;
      },
    ]
  > {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('fromAccountId must be different from toAccountId');
    }

    await this.assertAccount(userId, dto.fromAccountId);
    await this.assertAccount(userId, dto.toAccountId);

    const transferId = randomUUID();
    const date = dto.date ? new Date(dto.date) : new Date();
    const description = dto.description ?? 'Transfer';

    const [fromTx, toTx] = await this.prisma.$transaction(async (tx) => {
      const a = await tx.transaction.create({
        data: {
          type: 'TRANSFER' as never,
          amount: dto.amount as never,
          date,
          description,
          accountId: dto.fromAccountId,
          categoryId: null,
          userId,
          transferId,
        },
      });
      const b = await tx.transaction.create({
        data: {
          type: 'TRANSFER' as never,
          amount: dto.amount as never,
          date,
          description,
          accountId: dto.toAccountId,
          categoryId: null,
          userId,
          transferId,
        },
      });
      return [a, b] as const;
    });

    return [fromTx, toTx] as never;
  }

  async update(id: string, userId: string, dto: UpdateTransactionDto): Promise<{
    id: string;
    type: string;
    amount: unknown;
    date: Date;
    description: string;
    accountId: string;
    categoryId: string | null;
    userId: string;
    transferId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const existing = await this.prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Transaction not found');
    if (existing.transferId) {
      throw new BadRequestException('TRANSFER cannot be updated via single transaction route');
    }

    if (dto.accountId !== undefined && dto.accountId !== null && dto.accountId !== '') {
      await this.assertAccount(userId, dto.accountId);
    }
    if (dto.categoryId !== undefined && dto.categoryId !== null && dto.categoryId !== '') {
      await this.assertCategory(userId, dto.categoryId);
    }

    const data: Record<string, unknown> = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.date !== undefined) data.date = new Date(dto.date);
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.accountId !== undefined) data.accountId = dto.accountId;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;

    return this.prisma.transaction.update({ where: { id }, data: data as never });
  }

  async findOne(id: string, userId: string): Promise<{
    id: string;
    type: string;
    amount: unknown;
    date: Date;
    description: string;
    accountId: string;
    categoryId: string | null;
    userId: string;
    transferId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> {
    const tx = await this.prisma.transaction.findFirst({ where: { id, userId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    return tx;
  }

  async remove(id: string, userId: string): Promise<{ id: string }> {
    const existing = await this.prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Transaction not found');
    if (existing.transferId) {
      throw new BadRequestException('TRANSFER must be deleted via transfer endpoint');
    }
    await this.prisma.transaction.delete({ where: { id } });
    return { id };
  }

  async list(
    userId: string,
    params: {
      page?: number;
      limit?: number;
      from?: string;
      to?: string;
      categoryId?: string;
      accountId?: string;
      q?: string;
    } = {},
  ): Promise<PaginatedTransactions> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const accountId = params.accountId?.trim();
    const categoryId = params.categoryId?.trim();
    const q = params.q?.trim();

    if (accountId) await this.assertAccount(userId, accountId);
    if (categoryId) await this.assertCategory(userId, categoryId);

    const where: Record<string, unknown> = { userId };

    if (params.from || params.to) {
      const date: Record<string, Date> = {};
      if (params.from) date.gte = new Date(params.from);
      if (params.to) date.lte = new Date(params.to);
      where.date = date;
    }

    if (categoryId) where.categoryId = categoryId;
    if (accountId) where.accountId = accountId;
    if (q) {
      where.description = { contains: q, mode: 'insensitive' };
    }

    const orderBy = [{ date: 'desc' as const }, { id: 'desc' as const }];

    const [total, items] = await Promise.all([
      this.prisma.transaction.count({ where: where as never }),
      this.prisma.transaction.findMany({ where: where as never, orderBy, skip, take: limit }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      hasNext: page * limit < total,
    };
  }
}

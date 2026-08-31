import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UpsertBudgetDto } from './dto/upsert-budget.dto';

export interface BudgetWithProgress {
  id: string;
  userId: string;
  categoryId: string;
  month: number;
  year: number;
  amount: unknown;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string; color: string | null; icon: string | null; parentId: string | null; userId: string; createdAt: Date; updatedAt: Date } | null;
  spent: number;
  percentUsed: number;
}

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertCategory(userId: string, categoryId: string): Promise<void> {
    const cat = await this.prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!cat) throw new NotFoundException('Category not found');
  }

  async upsert(userId: string, dto: UpsertBudgetDto): Promise<{
    id: string;
    userId: string;
    categoryId: string;
    month: number;
    year: number;
    amount: unknown;
    createdAt: Date;
    updatedAt: Date;
  }> {
    await this.assertCategory(userId, dto.categoryId);

    return this.prisma.budget.upsert({
      where: {
        userId_categoryId_month_year: {
          userId,
          categoryId: dto.categoryId,
          month: dto.month,
          year: dto.year,
        },
      },
      create: {
        userId,
        categoryId: dto.categoryId,
        month: dto.month,
        year: dto.year,
        amount: dto.amount as never,
      },
      update: {
        amount: dto.amount as never,
      },
    });
  }

  async list(userId: string, params: { month: number; year: number }): Promise<BudgetWithProgress[]> {
    const budgets = await this.prisma.budget.findMany({
      where: { userId, month: params.month, year: params.year },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    });

    if (budgets.length === 0) return [];

    const start = new Date(Date.UTC(params.year, params.month - 1, 1));
    const end = new Date(Date.UTC(params.year, params.month, 1));

    const results: BudgetWithProgress[] = [];

    for (const b of budgets) {
      const agg = await this.prisma.transaction.aggregate({
        where: {
          userId,
          categoryId: b.categoryId,
          type: 'EXPENSE',
          date: { gte: start, lt: end },
        },
        _sum: { amount: true },
      });
      const spent = Number(agg._sum.amount ?? 0);
      const amountNum = Number(b.amount);
      const percentUsed = amountNum > 0 ? (spent / amountNum) * 100 : 0;

      results.push({
        ...b,
        category: b.category,
        spent,
        percentUsed,
      });
    }

    return results;
  }
}

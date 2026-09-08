import { BadRequestException, Injectable } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ByCategoryReportsDto } from './dto/by-category-reports.dto';
import type { EvolutionReportsDto } from './dto/evolution-reports.dto';
import type { SummaryReportsDto } from './dto/summary-reports.dto';

export interface ReportsSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface MonthlyEvolution {
  month: number;
  year: number;
  income: number;
  expense: number;
  balance: number;
}

export interface CategoryExpense {
  categoryId: string | null;
  categoryName: string;
  total: number;
  percent: number;
}

export interface AccountBalance {
  accountId: string;
  accountName: string;
  balance: number;
}

const MAX_RANGE_MONTHS = 12;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountsService: AccountsService,
  ) {}

  private parseRange(dto: { from: string; to: string }): { from: Date; to: Date } {
    const from = new Date(dto.from);
    const to = new Date(dto.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('from and to must be valid ISO 8601 dates');
    }
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('from must be less than or equal to to');
    }
    const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    if (months > MAX_RANGE_MONTHS) {
      throw new BadRequestException('date range must not exceed 12 months');
    }
    return { from, to };
  }

  async summary(userId: string, dto: SummaryReportsDto): Promise<ReportsSummary> {
    const { from, to } = this.parseRange(dto);
    const date = { gte: from, lte: to };

    const [incomeAgg, expenseAgg] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { userId, type: 'INCOME', date },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { userId, type: 'EXPENSE', date },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = Number(incomeAgg._sum.amount ?? 0);
    const totalExpense = Number(expenseAgg._sum.amount ?? 0);

    return { totalIncome, totalExpense, balance: totalIncome - totalExpense };
  }

  async byCategory(userId: string, dto: ByCategoryReportsDto): Promise<CategoryExpense[]> {
    const { from, to } = this.parseRange(dto);
    const accountId = dto.accountId?.trim();
    const categoryId = dto.categoryId?.trim();

    const groups = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: from, lte: to },
        ...(accountId ? { accountId } : {}),
        ...(categoryId ? { categoryId } : {}),
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    if (groups.length === 0) return [];

    const ids = groups.map((g) => g.categoryId).filter((id): id is string => id !== null);
    const categories =
      ids.length > 0
        ? await this.prisma.category.findMany({ where: { id: { in: ids }, userId } })
        : [];
    const names = new Map(categories.map((c) => [c.id, c.name]));

    const grandTotal = groups.reduce((acc, g) => acc + Number(g._sum.amount ?? 0), 0);

    return groups
      .map((g) => {
        const total = Number(g._sum.amount ?? 0);
        return {
          categoryId: g.categoryId,
          categoryName: g.categoryId === null ? 'Sem categoria' : (names.get(g.categoryId) ?? 'Sem categoria'),
          total,
          percent: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  async evolution(userId: string, dto: EvolutionReportsDto): Promise<MonthlyEvolution[]> {
    const { from, to } = this.parseRange(dto);
    const accountId = dto.accountId?.trim();
    const categoryId = dto.categoryId?.trim();

    const months: { month: number; year: number }[] = [];
    const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
    const last = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
    while (cursor.getTime() <= last.getTime()) {
      months.push({ month: cursor.getUTCMonth() + 1, year: cursor.getUTCFullYear() });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    const series = await Promise.all(
      months.map(async ({ month, year }) => {
        const start = new Date(Date.UTC(year, month - 1, 1));
        const end = new Date(Date.UTC(year, month, 1));
        const groups = await this.prisma.transaction.groupBy({
          by: ['type'],
          where: {
            userId,
            type: { in: ['INCOME', 'EXPENSE'] },
            date: { gte: start, lt: end },
            ...(accountId ? { accountId } : {}),
            ...(categoryId ? { categoryId } : {}),
          },
          _sum: { amount: true },
        });

        let income = 0;
        let expense = 0;
        for (const g of groups) {
          if (g.type === 'INCOME') income = Number(g._sum.amount ?? 0);
          if (g.type === 'EXPENSE') expense = Number(g._sum.amount ?? 0);
        }
        return { month, year, income, expense, balance: income - expense };
      }),
    );

    return series;
  }

  async balances(userId: string): Promise<AccountBalance[]> {
    const accounts = await this.accountsService.findAll(userId);
    return accounts.map((a) => ({ accountId: a.id, accountName: a.name, balance: a.balance }));
  }
}

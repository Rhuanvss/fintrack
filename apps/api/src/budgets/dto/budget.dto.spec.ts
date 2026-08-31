import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpsertBudgetDto } from './upsert-budget.dto';

function validPayload(overrides: Partial<Record<keyof UpsertBudgetDto, unknown>> = {}): Record<string, unknown> {
  return {
    categoryId: 'cat_123',
    month: 8,
    year: 2026,
    amount: 500,
    ...overrides,
  };
}

describe('UpsertBudgetDto - class-validator', () => {
  it('should reject month 13 and 0', async () => {
    const dto13 = plainToInstance(UpsertBudgetDto, validPayload({ month: 13 }));
    expect((await validate(dto13)).some((e) => e.property === 'month')).toBe(true);

    const dto0 = plainToInstance(UpsertBudgetDto, validPayload({ month: 0 }));
    expect((await validate(dto0)).some((e) => e.property === 'month')).toBe(true);

    const dtoNeg = plainToInstance(UpsertBudgetDto, validPayload({ month: -1 }));
    expect((await validate(dtoNeg)).some((e) => e.property === 'month')).toBe(true);
  });

  it('should accept month 1-12', async () => {
    for (const month of [1, 6, 12]) {
      const dto = plainToInstance(UpsertBudgetDto, validPayload({ month }));
      expect(await validate(dto)).toHaveLength(0);
    }
  });

  it('should reject year out of range and amount negative', async () => {
    const dtoYearLow = plainToInstance(UpsertBudgetDto, validPayload({ year: 1999 }));
    expect((await validate(dtoYearLow)).some((e) => e.property === 'year')).toBe(true);

    const dtoYearHigh = plainToInstance(UpsertBudgetDto, validPayload({ year: 2101 }));
    expect((await validate(dtoYearHigh)).some((e) => e.property === 'year')).toBe(true);

    const dtoNegAmount = plainToInstance(UpsertBudgetDto, validPayload({ amount: -1 }));
    expect((await validate(dtoNegAmount)).some((e) => e.property === 'amount')).toBe(true);
  });

  it('should reject amount with 3 decimal places', async () => {
    const dto = plainToInstance(UpsertBudgetDto, validPayload({ amount: 100.123 }));
    expect((await validate(dto)).some((e) => e.property === 'amount')).toBe(true);

    const dto2 = plainToInstance(UpsertBudgetDto, validPayload({ amount: 0.001 }));
    expect((await validate(dto2)).some((e) => e.property === 'amount')).toBe(true);
  });

  it('should accept amount 0 and positive with 2 decimals', async () => {
    const dtoZero = plainToInstance(UpsertBudgetDto, validPayload({ amount: 0 }));
    expect(await validate(dtoZero)).toHaveLength(0);

    const dto2 = plainToInstance(UpsertBudgetDto, validPayload({ amount: 0.5 }));
    expect(await validate(dto2)).toHaveLength(0);

    const dto3 = plainToInstance(UpsertBudgetDto, validPayload({ amount: 500.5 }));
    expect(await validate(dto3)).toHaveLength(0);

    const dto4 = plainToInstance(UpsertBudgetDto, validPayload({ amount: 100.99 }));
    expect(await validate(dto4)).toHaveLength(0);
  });

  it('should reject missing categoryId', async () => {
    const dto = plainToInstance(UpsertBudgetDto, { month: 8, year: 2026, amount: 500 });
    expect((await validate(dto)).some((e) => e.property === 'categoryId')).toBe(true);

    const dtoEmpty = plainToInstance(UpsertBudgetDto, validPayload({ categoryId: '' }));
    expect((await validate(dtoEmpty)).some((e) => e.property === 'categoryId')).toBe(true);
  });

  it('should accept valid payload', async () => {
    const dto = plainToInstance(UpsertBudgetDto, validPayload());
    expect(await validate(dto)).toHaveLength(0);
  });

  it('should coerce string month/year/amount via Type', async () => {
    const dto = plainToInstance(UpsertBudgetDto, { categoryId: 'cat_123', month: '8' as unknown as number, year: '2026' as unknown as number, amount: '500.50' as unknown as number });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.month).toBe(8);
    expect(dto.year).toBe(2026);
    expect(dto.amount).toBe(500.5);
  });
});

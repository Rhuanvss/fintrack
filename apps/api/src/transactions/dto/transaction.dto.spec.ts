import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTransactionDto } from './create-transaction.dto';
import { UpdateTransactionDto } from './update-transaction.dto';

function validPayload(overrides: Partial<Record<keyof CreateTransactionDto, unknown>> = {}): Record<string, unknown> {
  return {
    type: 'EXPENSE',
    amount: 49.9,
    date: new Date().toISOString(),
    description: 'Mercado',
    accountId: 'acc_123',
    categoryId: 'cat_123',
    ...overrides,
  };
}

describe('CreateTransactionDto - class-validator', () => {
  it('should reject amount with 3 decimal places', async () => {
    const dto = plainToInstance(CreateTransactionDto, validPayload({ amount: 10.123 }));
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
    const amountErrors = errors.find((e) => e.property === 'amount');
    expect(amountErrors?.constraints).toBeDefined();
  });

  it('should reject amount with 3 decimal places even when string coerced', async () => {
    // ValidationPipe with transform would coerce "10.123" -> 10.123, still should fail
    const dto = plainToInstance(CreateTransactionDto, validPayload({ amount: '10.123' as unknown as number }));
    const errors = await validate(dto);
    // If transform not applied in plainToInstance without @Type, it stays string and fails IsNumber
    // But with @Type(() => Number), it becomes number; both cases should be invalid
    expect(errors.some((e) => e.property === 'amount')).toBe(true);
  });

  it('should accept amount with 2 decimal places', async () => {
    const dto = plainToInstance(CreateTransactionDto, validPayload({ amount: 49.9 }));
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);

    const dto2 = plainToInstance(CreateTransactionDto, validPayload({ amount: 49.9 }));
    expect(await validate(dto2)).toHaveLength(0);

    const dto3 = plainToInstance(CreateTransactionDto, validPayload({ amount: 100 }));
    expect(await validate(dto3)).toHaveLength(0);

    const dto4 = plainToInstance(CreateTransactionDto, validPayload({ amount: 0.01 }));
    expect(await validate(dto4)).toHaveLength(0);

    const dto5 = plainToInstance(CreateTransactionDto, validPayload({ amount: 100.0 }));
    expect(await validate(dto5)).toHaveLength(0);
  });

  it('should accept amount with exactly 2 decimal places via number', async () => {
    const dto = plainToInstance(CreateTransactionDto, validPayload({ amount: 49.99 }));
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject amount negative or zero', async () => {
    const dtoZero = plainToInstance(CreateTransactionDto, validPayload({ amount: 0 }));
    expect((await validate(dtoZero)).some((e) => e.property === 'amount')).toBe(true);

    const dtoNeg = plainToInstance(CreateTransactionDto, validPayload({ amount: -10 }));
    expect((await validate(dtoNeg)).some((e) => e.property === 'amount')).toBe(true);

    const dtoNegSmall = plainToInstance(CreateTransactionDto, validPayload({ amount: -0.01 }));
    expect((await validate(dtoNegSmall)).some((e) => e.property === 'amount')).toBe(true);
  });

  it('should reject date future >1 day', async () => {
    const future2d = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const dto = plainToInstance(CreateTransactionDto, validPayload({ date: future2d }));
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'date')).toBe(true);

    const future3d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const dto2 = plainToInstance(CreateTransactionDto, validPayload({ date: future3d }));
    expect((await validate(dto2)).some((e) => e.property === 'date')).toBe(true);
  });

  it('should accept date today, past, and up to 1 day future', async () => {
    const now = new Date().toISOString();
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const yesterday = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const future12h = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const future23h = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();

    for (const date of [now, past, yesterday, future12h, future23h]) {
      const dto = plainToInstance(CreateTransactionDto, validPayload({ date }));
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'date')).toBe(false);
    }
  });

  it('should reject invalid date ISO', async () => {
    const dto = plainToInstance(CreateTransactionDto, validPayload({ date: 'not-a-date' }));
    expect((await validate(dto)).some((e) => e.property === 'date')).toBe(true);

    const dto2 = plainToInstance(CreateTransactionDto, validPayload({ date: '2026-13-01' }));
    expect((await validate(dto2)).some((e) => e.property === 'date')).toBe(true);
  });

  it('should reject invalid type', async () => {
    const dto = plainToInstance(CreateTransactionDto, validPayload({ type: 'TRANSFER' as unknown as 'INCOME' }));
    expect((await validate(dto)).some((e) => e.property === 'type')).toBe(true);

    const dto2 = plainToInstance(CreateTransactionDto, validPayload({ type: 'INVALID' as unknown as 'INCOME' }));
    expect((await validate(dto2)).some((e) => e.property === 'type')).toBe(true);
  });

  it('should accept valid INCOME and EXPENSE types', async () => {
    const inc = plainToInstance(CreateTransactionDto, validPayload({ type: 'INCOME' }));
    expect(await validate(inc)).toHaveLength(0);

    const exp = plainToInstance(CreateTransactionDto, validPayload({ type: 'EXPENSE' }));
    expect(await validate(exp)).toHaveLength(0);
  });

  it('should reject missing required fields', async () => {
    const dto = plainToInstance(CreateTransactionDto, {
      // empty
    });
    const errors = await validate(dto);
    const props = errors.map((e) => e.property);
    expect(props).toContain('type');
    expect(props).toContain('amount');
    expect(props).toContain('date');
    expect(props).toContain('description');
    expect(props).toContain('accountId');
  });

  it('should reject description empty or too long', async () => {
    const empty = plainToInstance(CreateTransactionDto, validPayload({ description: '' }));
    expect((await validate(empty)).some((e) => e.property === 'description')).toBe(true);

    const long = plainToInstance(CreateTransactionDto, validPayload({ description: 'a'.repeat(256) }));
    expect((await validate(long)).some((e) => e.property === 'description')).toBe(true);

    const ok = plainToInstance(CreateTransactionDto, validPayload({ description: 'a'.repeat(255) }));
    expect((await validate(ok)).some((e) => e.property === 'description')).toBe(false);
  });

  it('should accept without categoryId (optional)', async () => {
    const without = validPayload({});
    delete (without as { categoryId?: string }).categoryId;
    const dto = plainToInstance(CreateTransactionDto, without);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject amount with more than 2 decimal places edge 1.001', async () => {
    const dto = plainToInstance(CreateTransactionDto, validPayload({ amount: 1.001 }));
    expect((await validate(dto)).some((e) => e.property === 'amount')).toBe(true);
  });
});

describe('UpdateTransactionDto - class-validator', () => {
  it('should accept empty payload (all optional)', async () => {
    const dto = plainToInstance(UpdateTransactionDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid amount 3 decimals on update', async () => {
    const dto = plainToInstance(UpdateTransactionDto, { amount: 10.123 });
    expect((await validate(dto)).some((e) => e.property === 'amount')).toBe(true);
  });

  it('should reject future date >1d on update', async () => {
    const future2d = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const dto = plainToInstance(UpdateTransactionDto, { date: future2d });
    expect((await validate(dto)).some((e) => e.property === 'date')).toBe(true);
  });

  it('should accept valid partial update', async () => {
    const dto = plainToInstance(UpdateTransactionDto, { description: 'Atualizado', amount: 20.5 });
    expect(await validate(dto)).toHaveLength(0);
  });
});

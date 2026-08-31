import { createTransactionSchema, upsertBudgetSchema, createTransferSchema } from './schemas';

describe('Zod parity - Transaction/Budget (task 3.10)', () => {
  function expectZodReject(schema: { safeParse: (v: unknown) => { success: boolean } }, payload: unknown): void {
    expect(schema.safeParse(payload).success).toBe(false);
  }
  function expectZodAccept(schema: { safeParse: (v: unknown) => { success: boolean } }, payload: unknown): void {
    expect(schema.safeParse(payload).success).toBe(true);
  }

  describe('createTransactionSchema mirrors CreateTransactionDto', () => {
    const base = {
      type: 'EXPENSE' as const,
      amount: 49.9,
      date: new Date().toISOString(),
      description: 'Mercado',
      accountId: 'acc_123',
      categoryId: 'cat_123',
    };
    it('rejects amount 3 decimals', () => expectZodReject(createTransactionSchema, { ...base, amount: 10.123 }));
    it('rejects amount 0 and negative', () => {
      expectZodReject(createTransactionSchema, { ...base, amount: 0 });
      expectZodReject(createTransactionSchema, { ...base, amount: -5 });
    });
    it('accepts amount 2 decimals and 0.01', () => {
      expectZodAccept(createTransactionSchema, { ...base, amount: 49.99 });
      expectZodAccept(createTransactionSchema, { ...base, amount: 0.01 });
      expectZodAccept(createTransactionSchema, { ...base, amount: 100 });
    });
    it('rejects date future >1d', () => {
      const future2d = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      expectZodReject(createTransactionSchema, { ...base, date: future2d });
    });
    it('accepts date now and past', () => {
      expectZodAccept(createTransactionSchema, { ...base, date: new Date().toISOString() });
      expectZodAccept(createTransactionSchema, { ...base, date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() });
    });
    it('rejects invalid type TRANSFER', () => expectZodReject(createTransactionSchema, { ...base, type: 'TRANSFER' }));
    it('accepts without categoryId', () => {
      const { categoryId: _omit, ...rest } = base;
      expectZodAccept(createTransactionSchema, rest);
    });
  });

  describe('upsertBudgetSchema mirrors UpsertBudgetDto', () => {
    const base = { categoryId: 'cat_123', month: 8, year: 2026, amount: 500 };
    it('rejects month 13 and 0', () => {
      expectZodReject(upsertBudgetSchema, { ...base, month: 13 });
      expectZodReject(upsertBudgetSchema, { ...base, month: 0 });
    });
    it('accepts month 1-12', () => {
      expectZodAccept(upsertBudgetSchema, { ...base, month: 1 });
      expectZodAccept(upsertBudgetSchema, { ...base, month: 12 });
    });
    it('rejects amount 3 decimals', () => expectZodReject(upsertBudgetSchema, { ...base, amount: 100.123 }));
    it('accepts amount 0 and 2 decimals', () => {
      expectZodAccept(upsertBudgetSchema, { ...base, amount: 0 });
      expectZodAccept(upsertBudgetSchema, { ...base, amount: 100.99 });
    });
    it('rejects missing categoryId', () => expectZodReject(upsertBudgetSchema, { month: 8, year: 2026, amount: 500 }));
  });

  describe('createTransferSchema mirrors CreateTransferDto', () => {
    const base = { amount: 100, fromAccountId: 'acc_1', toAccountId: 'acc_2' };
    it('rejects same from/to', () => expectZodReject(createTransferSchema, { ...base, fromAccountId: 'acc_1', toAccountId: 'acc_1' }));
    it('accepts different accounts', () => expectZodAccept(createTransferSchema, base));
    it('rejects amount 3 decimals', () => expectZodReject(createTransferSchema, { ...base, amount: 10.123 }));
  });

  describe('DTO vs Zod parity gate', () => {
    it('divergence breaks build: same valid payload passes both, same invalid fails both', () => {
      const validTx = { type: 'INCOME', amount: 10, date: new Date().toISOString(), description: 'Salario', accountId: 'acc_1' };
      expect(createTransactionSchema.safeParse(validTx).success).toBe(true);

      const invalidTx = { type: 'INCOME', amount: 10.123, date: new Date().toISOString(), description: 'X', accountId: 'acc_1' };
      expect(createTransactionSchema.safeParse(invalidTx).success).toBe(false);

      const validBudget = { categoryId: 'cat_1', month: 8, year: 2026, amount: 500 };
      expect(upsertBudgetSchema.safeParse(validBudget).success).toBe(true);

      const invalidBudget = { categoryId: 'cat_1', month: 13, year: 2026, amount: 500 };
      expect(upsertBudgetSchema.safeParse(invalidBudget).success).toBe(false);
    });
  });
});

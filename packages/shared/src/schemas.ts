import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[a-zA-Z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

// --- Transaction ---
function isValidAmountWithMax2Decimals(value: number): boolean {
  if (typeof value !== 'number' || !isFinite(value)) return false;
  const str = value.toString();
  if (!str.includes('.')) return true;
  const decimals = str.split('.')[1] ?? '';
  // handle scientific notation like 1e-7
  if (decimals.includes('e') || decimals.includes('E')) return false;
  return decimals.length <= 2;
}

function isDateNotMoreThan1DayFuture(value: string): boolean {
  const date = new Date(value);
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  const max = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 60 * 1000);
  return date.getTime() <= max.getTime();
}

export const createTransactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE'], { errorMap: () => ({ message: 'type must be INCOME or EXPENSE' }) }),
  amount: z
    .number({ invalid_type_error: 'amount must be a number' })
    .min(0.01, 'amount must be positive')
    .refine(isValidAmountWithMax2Decimals, 'amount must have at most 2 decimal places'),
  date: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), 'date must be ISO 8601')
    .refine(isDateNotMoreThan1DayFuture, 'date must not be more than 1 day in the future'),
  description: z.string().min(1, 'description is required').max(255, 'description must be at most 255 characters'),
  accountId: z.string().min(1, 'accountId is required'),
  categoryId: z.string().min(1).optional(),
});

export const updateTransactionSchema = z
  .object({
    type: z.enum(['INCOME', 'EXPENSE']).optional(),
    amount: z
      .number()
      .min(0.01, 'amount must be positive')
      .refine(isValidAmountWithMax2Decimals, 'amount must have at most 2 decimal places')
      .optional(),
    date: z
      .string()
      .refine((v) => !isNaN(Date.parse(v)), 'date must be ISO 8601')
      .refine(isDateNotMoreThan1DayFuture, 'date must not be more than 1 day in the future')
      .optional(),
    description: z.string().min(1, 'description must not be empty').max(255).optional(),
    accountId: z.string().min(1, 'accountId must not be empty').optional(),
    categoryId: z.string().min(1, 'categoryId must not be empty').nullable().optional(),
  })
  .strict();

export const createTransferSchema = z
  .object({
    amount: z
      .number()
      .min(0.01, 'amount must be positive')
      .refine(isValidAmountWithMax2Decimals, 'amount must have at most 2 decimal places'),
    fromAccountId: z.string().min(1, 'fromAccountId is required'),
    toAccountId: z.string().min(1, 'toAccountId is required'),
    date: z
      .string()
      .refine((v) => !isNaN(Date.parse(v)), 'date must be ISO 8601')
      .refine(isDateNotMoreThan1DayFuture, 'date must not be more than 1 day in the future')
      .optional(),
    description: z.string().max(255, 'description must be at most 255 characters').optional(),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: 'fromAccountId must be different from toAccountId',
    path: ['toAccountId'],
  });

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type CreateTransferInput = z.infer<typeof createTransferSchema>;

// --- Budget ---
export const upsertBudgetSchema = z.object({
  categoryId: z.string().min(1, 'categoryId is required'),
  month: z.number().int('month must be an integer').min(1, 'month must be at least 1').max(12, 'month must be at most 12'),
  year: z.number().int('year must be an integer').min(2000, 'year must be at least 2000').max(2100, 'year must be at most 2100'),
  amount: z
    .number()
    .min(0, 'amount must be non-negative')
    .refine(isValidAmountWithMax2Decimals, 'amount must have at most 2 decimal places'),
});

export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>;

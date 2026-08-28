import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { registerSchema, loginSchema } from '@fintrack/shared';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';

describe('Auth DTOs - class-validator', () => {
  it('should reject invalid email and short password for RegisterDto', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'Test',
      email: 'invalid-email',
      password: '123',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const fields = errors.map((e) => e.property);
    expect(fields).toContain('email');
    expect(fields).toContain('password');
  });

  it('should reject password without letter or number', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'Test',
      email: 'test@example.com',
      password: 'abcdefgh', // no number
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'password')).toBe(true);

    const dto2 = plainToInstance(RegisterDto, {
      name: 'Test',
      email: 'test@example.com',
      password: '12345678', // no letter
    });
    const errors2 = await validate(dto2);
    expect(errors2.some((e) => e.property === 'password')).toBe(true);
  });

  it('should accept valid RegisterDto', async () => {
    const dto = plainToInstance(RegisterDto, {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password123',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid login email', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'not-an-email',
      password: 'whatever',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });
});

describe('Auth Zod schemas - packages/shared', () => {
  it('should reject invalid email and short password via Zod', () => {
    const result = registerSchema.safeParse({
      name: 'Test',
      email: 'invalid-email',
      password: '123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain('email');
      expect(fields).toContain('password');
    }
  });

  it('should accept valid data via Zod', () => {
    const result = registerSchema.safeParse({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Password123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid login via Zod', () => {
    const result = loginSchema.safeParse({
      email: 'invalid',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

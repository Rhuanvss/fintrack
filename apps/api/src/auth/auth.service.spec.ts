/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let jwtService: { sign: jest.Mock };
  let configService: { get: jest.Mock };

  const mockUser = {
    id: 'user_123',
    name: 'John Doe',
    email: 'john@example.com',
    password: '',
    role: 'USER' as const,
    refreshToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma)),
    };

    jwtService = {
      sign: jest.fn().mockImplementation((payload: unknown, opts: { expiresIn: string }) => {
        if (opts.expiresIn === '15m') return 'access-token-mocked';
        if (opts.expiresIn === '7d') return 'refresh-token-mocked';
        return 'token-mocked';
      }),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        const map: Record<string, string> = {
          JWT_SECRET: 'test-jwt-secret-32-chars-minimum-length',
          JWT_REFRESH_SECRET: 'test-refresh-secret-32-chars-minimum',
          JWT_EXPIRES_IN: '15m',
          JWT_REFRESH_EXPIRES_IN: '7d',
        };
        return map[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Prepare a hashed password for mockUser
    mockUser.password = await bcrypt.hash('Password123', 10);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hashing', () => {
    it('should hash password and not store plain', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockImplementation(async ({ data }: { data: { password: string } }) => ({
        ...mockUser,
        id: 'new_user',
        name: data.password ? 'Test' : 'Test',
        email: 'test@example.com',
        password: data.password,
      }));
      prisma.user.update.mockResolvedValue({});

      const result = await service.register({
        name: 'Test',
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(prisma.user.create).toHaveBeenCalled();
      const createdData = prisma.user.create.mock.calls[0][0].data;
      expect(createdData.password).not.toBe('Password123');
      const matches = await bcrypt.compare('Password123', createdData.password);
      expect(matches).toBe(true);
      expect(result.user).not.toHaveProperty('password');
    });
  });

  describe('register', () => {
    it('should create user and return tokens', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        ...mockUser,
        id: 'new_id',
        email: 'new@example.com',
        name: 'New User',
        password: await bcrypt.hash('Password123', 10),
      });
      prisma.user.update.mockResolvedValue({});

      const result = await service.register({
        name: 'New User',
        email: 'new@example.com',
        password: 'Password123',
      });

      expect(result.accessToken).toBe('access-token-mocked');
      expect(result.refreshToken).toBe('refresh-token-mocked');
      expect(result.user.email).toBe('new@example.com');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'new_id' }),
        expect.objectContaining({ expiresIn: '15m' }),
      );
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'new_id' }),
        expect.objectContaining({ expiresIn: '7d' }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'new_id' } }),
      );
      // refreshToken stored hashed (sha256 + bcrypt), not plain
      const storedRefresh = prisma.user.update.mock.calls[0][0].data.refreshToken;
      expect(storedRefresh).not.toBe('refresh-token-mocked');
      const digest = createHash('sha256').update('refresh-token-mocked').digest('hex');
      const refreshMatches = await bcrypt.compare(digest, storedRefresh);
      expect(refreshMatches).toBe(true);
    });

    it('should throw ConflictException if email already exists (case-insensitive)', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.register({
          name: 'Dup',
          email: 'JOHN@example.com',
          password: 'Password123',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: 'john@example.com', mode: 'insensitive' } },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({});

      const result = await service.login({
        email: 'john@example.com',
        password: 'Password123',
      });

      expect(result.accessToken).toBe('access-token-mocked');
      expect(result.refreshToken).toBe('refresh-token-mocked');
      expect(result.user.id).toBe(mockUser.id);
    });

    it('should throw 401 if user not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ email: 'notfound@example.com', password: 'Password123' }),
      ).rejects.toThrow(UnauthorizedException);

      try {
        await service.login({ email: 'notfound@example.com', password: 'Password123' });
      } catch (e) {
        expect((e as UnauthorizedException).getStatus()).toBe(401);
        expect((e as Error).message).toBe('Invalid credentials');
      }
    });

    it('should throw 401 if password is incorrect', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        service.login({ email: 'john@example.com', password: 'WrongPass123' }),
      ).rejects.toThrow(UnauthorizedException);

      try {
        await service.login({ email: 'john@example.com', password: 'WrongPass123' });
      } catch (e) {
        expect((e as UnauthorizedException).getStatus()).toBe(401);
      }

      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should be case-insensitive for email on login', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({});

      await service.login({ email: 'JOHN@EXAMPLE.COM', password: 'Password123' });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: 'john@example.com', mode: 'insensitive' } },
      });
    });

    it('should hash refresh token before storing', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({});

      await service.login({ email: 'john@example.com', password: 'Password123' });

      const stored = prisma.user.update.mock.calls[0][0].data.refreshToken;
      expect(stored).not.toBe('refresh-token-mocked');
      const digest = createHash('sha256').update('refresh-token-mocked').digest('hex');
      expect(await bcrypt.compare(digest, stored)).toBe(true);
    });
  });

  describe('token generation', () => {
    it('should use configured secrets and expirations', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        ...mockUser,
        id: 'id2',
        email: 'a@example.com',
        password: await bcrypt.hash('Password123', 10),
      });
      prisma.user.update.mockResolvedValue({});

      await service.register({
        name: 'A',
        email: 'a@example.com',
        password: 'Password123',
      });

      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
      expect(configService.get).toHaveBeenCalledWith('JWT_REFRESH_SECRET');
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ email: 'a@example.com' }),
        expect.objectContaining({ secret: 'test-jwt-secret-32-chars-minimum-length', expiresIn: '15m' }),
      );
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ email: 'a@example.com' }),
        expect.objectContaining({ secret: 'test-refresh-secret-32-chars-minimum', expiresIn: '7d' }),
      );
    });
  });

  describe('logout', () => {
    it('should clear refreshToken', async () => {
      prisma.user.update.mockResolvedValue({});

      await service.logout('user_123');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_123' },
        data: { refreshToken: null },
      });
    });
  });
});

import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { DEFAULT_CATEGORIES } from '../categories/default-categories';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
  };
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  private hashRefreshToken(token: string): Promise<string> {
    const digest = createHash('sha256').update(token).digest('hex');
    return bcrypt.hash(digest, 10);
  }

  private compareRefreshToken(token: string, hash: string): Promise<boolean> {
    const digest = createHash('sha256').update(token).digest('hex');
    return bcrypt.compare(digest, hash);
  }

  async register(dto: RegisterDto): Promise<AuthResult> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    let user: { id: string; name: string; email: string; role: string; createdAt: Date; updatedAt: Date };
    try {
      user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: normalizedEmail,
          password: hashedPassword,
        },
      });
    } catch (error) {
      if (
        error !== null &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }

    const tokens = this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const hashedRefresh = await this.hashRefreshToken(tokens.refreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefresh },
    });

    try {
      await this.prisma.category.createMany({
        data: DEFAULT_CATEGORIES.map((cat) => ({
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          parentId: cat.parentId ?? null,
          userId: user.id,
        })),
        skipDuplicates: true,
      });
    } catch {
      // Seed de categorias não deve bloquear registro — log e segue
      console.warn(`[AuthService] Failed to seed default categories for user ${user.id}`);
    }

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    const hashedRefresh = await this.hashRefreshToken(tokens.refreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefresh },
    });

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  private getSecretOrThrow(key: 'JWT_SECRET' | 'JWT_REFRESH_SECRET', fallbackDev: string): string {
    const secret = this.configService.get<string>(key);
    if (secret) return secret;
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      throw new Error(`${key} must be set in production`);
    }
    return fallbackDev;
  }

  private generateTokens(payloadUser: {
    id: string;
    email: string;
    role: string;
  }): AuthTokens {
    const payload = {
      sub: payloadUser.id,
      email: payloadUser.email,
      role: payloadUser.role,
    };

    const accessSecret = this.getSecretOrThrow('JWT_SECRET', 'fallback-jwt-secret-dev-only');
    const refreshSecret = this.getSecretOrThrow(
      'JWT_REFRESH_SECRET',
      'fallback-refresh-secret-dev-only',
    );
    const accessExpiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') ?? '15m';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const accessToken = this.jwtService.sign(payload, {
      secret: accessSecret,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      expiresIn: accessExpiresIn as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      expiresIn: refreshExpiresIn as any,
    });

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const refreshSecret = this.getSecretOrThrow(
      'JWT_REFRESH_SECRET',
      'fallback-refresh-secret-dev-only',
    );

    let payload: { sub: string; email: string; role: string };
    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      payload = this.jwtService.verify(refreshToken, {
        secret: refreshSecret,
      }) as { sub: string; email: string; role: string };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Transação serializa validações paralelas e reduz janela de race;
    // em Postgres, o findUnique dentro da transação interativa adquire lock implícito na linha
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const isRefreshValid = await this.compareRefreshToken(refreshToken, user.refreshToken);

      if (!isRefreshValid) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = this.generateTokens({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      const hashedRefresh = await this.hashRefreshToken(tokens.refreshToken);
      await tx.user.update({
        where: { id: user.id },
        data: { refreshToken: hashedRefresh },
      });

      return {
        user: this.sanitizeUser(user),
        ...tokens,
      };
    });
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  private sanitizeUser(user: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
    password?: string;
    refreshToken?: string | null;
  }): AuthResult['user'] {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

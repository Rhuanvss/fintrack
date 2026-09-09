import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private getRefreshCookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'strict' | 'lax';
    path: string;
    maxAge: number;
  } {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    // Deriva maxAge do JWT_REFRESH_EXPIRES_IN quando possível; fallback 7d
    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    let maxAge = 7 * 24 * 60 * 60 * 1000;
    if (expiresIn.endsWith('d')) {
      const days = Number.parseInt(expiresIn.slice(0, -1), 10);
      if (!Number.isNaN(days)) maxAge = days * 24 * 60 * 60 * 1000;
    } else if (expiresIn.endsWith('h')) {
      const hours = Number.parseInt(expiresIn.slice(0, -1), 10);
      if (!Number.isNaN(hours)) maxAge = hours * 60 * 60 * 1000;
    }
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      path: '/',
      maxAge,
    };
  }

  @Public()
  @ApiOperation({ summary: 'Cadastrar novo usuário' })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: { id: string; name: string; email: string; role: string }; accessToken: string }> {
    const result = await this.authService.register(dto);

    res.cookie('refreshToken', result.refreshToken, this.getRefreshCookieOptions());

    return {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
      accessToken: result.accessToken,
    };
  }

  @Public()
  @ApiOperation({ summary: 'Autenticar e emitir tokens' })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: { id: string; name: string; email: string; role: string }; accessToken: string }> {
    const result = await this.authService.login(dto);

    res.cookie('refreshToken', result.refreshToken, this.getRefreshCookieOptions());

    return {
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
      accessToken: result.accessToken,
    };
  }

  @Public()
  @ApiOperation({ summary: 'Renovar access token via refresh cookie' })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const token = (req.cookies as Record<string, string> | undefined)?.['refreshToken'];

    if (!token) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const result = await this.authService.refresh(token);

    res.cookie('refreshToken', result.refreshToken, this.getRefreshCookieOptions());

    return { accessToken: result.accessToken };
  }

  @ApiOperation({ summary: 'Encerrar sessão e limpar refresh cookie' })
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    // user vem do JwtAuthGuard via request.user
    const user = (req as Request & { user?: { sub: string } }).user;
    if (user?.sub) {
      await this.authService.logout(user.sub);
    }
    const opts = this.getRefreshCookieOptions();
    res.clearCookie('refreshToken', {
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      path: opts.path,
    });
  }
}

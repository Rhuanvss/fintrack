import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    const user = request.user;

    if (!user) return null;
    // Retorna null apenas se guard falhou; controller tipa JwtPayload e deve validar
    return data ? user[data] : user;
  },
);

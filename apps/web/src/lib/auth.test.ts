import { describe, expect, it } from 'vitest';
import { parseJwtPayload } from './auth';

function token(segment: string): string {
  return `header.${segment}.sig`;
}

describe('parseJwtPayload', () => {
  it('decodifica base64url com -/_ e sem padding', () => {
    // Segmento real gerado via Buffer.toString('base64url'); contém '_' (forma padrão teria '/').
    const segment =
      'eyJzdWIiOiJ1MSIsIm5hbWUiOiLDv8O_w78iLCJlbWFpbCI6ImFAYi5jIiwicm9sZSI6IlVTRVIiLCJleHAiOjQxMDI0NDQ4MDB9';
    expect(parseJwtPayload(token(segment))).toEqual({
      id: 'u1',
      name: 'a',
      email: 'a@b.c',
      role: 'USER',
    });
  });

  it('aceita base64 padrão', () => {
    const payload = { sub: 'u9', email: 'x@y.zz', role: 'ADMIN', exp: 4102444800 };
    const segment = Buffer.from(JSON.stringify(payload)).toString('base64');
    expect(parseJwtPayload(token(segment))).toEqual({ id: 'u9', name: 'x', email: 'x@y.zz', role: 'ADMIN' });
  });

  it('rejeita token expirado', () => {
    const payload = { sub: 'u1', email: 'a@b.c', exp: 1000 };
    const segment = Buffer.from(JSON.stringify(payload)).toString('base64url');
    expect(parseJwtPayload(token(segment))).toBeNull();
  });

  it('rejeita token malformado ou sem sub/email', () => {
    expect(parseJwtPayload('not-a-jwt')).toBeNull();
    const empty = Buffer.from(JSON.stringify({})).toString('base64url');
    expect(parseJwtPayload(token(empty))).toBeNull();
  });
});

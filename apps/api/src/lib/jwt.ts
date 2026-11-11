// Created by Haihs on 11/11/2026
// JWT sign/verify (HS256 only, payload {id, tv}); port of server/config/jwt.js.
import jwt from 'jsonwebtoken';
import { loadEnv } from './env';

export function signToken(user: { id: string; tokenVersion: number }): string {
  const env = loadEnv();
  // tv lets logout-all revoke older tokens; expiresIn comes from env (default 7d)
  return jwt.sign({ id: user.id, tv: user.tokenVersion }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

/** Throws on any invalid token. algorithms is pinned so `alg:none` / HS512 / key-confusion tokens never verify. */
export function verifyToken(token: string): { id: string; tv: number } {
  const p = jwt.verify(token, loadEnv().jwtSecret, { algorithms: ['HS256'] });
  if (typeof p === 'string') throw new Error('Invalid token payload');
  const { id, tv } = p;
  if (typeof id !== 'string' || !id || typeof tv !== 'number' || !Number.isInteger(tv)) {
    throw new Error('Invalid token payload');
  }
  return { id, tv };
}

// Created by Haihs on 11/11/2026
// Tests for the security header config exported by next.config.ts.
import { describe, expect, it } from 'vitest';
import config from '../next.config';

describe('next.config headers', () => {
  it('nosniff on /api/*, no-store on /api/auth/*', async () => {
    const h = await config.headers!();
    const find = (source: string) => h.find((x) => x.source === source)?.headers;
    expect(find('/api/:path*')).toContainEqual({ key: 'X-Content-Type-Options', value: 'nosniff' });
    expect(find('/api/auth/:path*')).toContainEqual({ key: 'Cache-Control', value: 'no-store' });
  });
});

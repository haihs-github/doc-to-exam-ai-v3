// Created by Haihs on 11/11/2026
// Next config: transpile the source-only contract package.
import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@doc-to-exam/contract'],
  // Haihs: header bảo mật cho API - start
  async headers() {
    return [
      { source: '/api/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }] },
      { source: '/api/auth/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
  // Haihs: header bảo mật cho API - end
};

export default config;

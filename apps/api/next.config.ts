// Created by Haihs on 11/11/2026
// Next config: transpile the source-only contract package.
import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@doc-to-exam/contract'],
};

export default config;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Transpile workspace packages — shared types/constants live there.
  transpilePackages: ['@styleme/shared'],

  // We will tighten this in Phase 0 when CSP and security headers land.
  reactStrictMode: true,
};

export default nextConfig;

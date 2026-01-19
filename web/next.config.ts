import type { NextConfig } from 'next';

// API server URL (defaults to localhost for local development)
const API_URL = process.env.API_URL || 'http://localhost:3001';

const nextConfig: NextConfig = {
  // Allow requests to the METAMORPH API server
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
  // Output standalone build for Railway deployment
  output: 'standalone',
  // Webpack config for face-api.js (browser-only, ignore Node.js modules)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ignore Node.js modules that face-api.js tries to import but doesn't need in browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
};

export default nextConfig;

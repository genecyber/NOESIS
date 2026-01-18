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
};

export default nextConfig;

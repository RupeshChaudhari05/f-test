/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Skip type-checking and linting during Docker/CI builds — run these separately
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    // Only used in local dev (when NEXT_PUBLIC_API_URL is not set).
    // In production Docker, api.ts uses NEXT_PUBLIC_API_URL directly (baked at build time).
    if (process.env.NEXT_PUBLIC_API_URL) return [];
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;

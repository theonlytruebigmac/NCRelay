/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove standalone output for now - using standard build
  // output: 'standalone', // Enable standalone output for Docker
  // outputFileTracing: true, // Enable file tracing for better module resolution
  typescript: {
    // During development, you can set this to true to ignore errors
    // But for production, we want to catch all type errors
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  experimental: {
    // Enable module support
    esmExternals: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  generateEtags: true,
  // In production, we want more aggressive caching
  onDemandEntries: {
    // Number of pages that should be kept simultaneously in memory
    maxInactiveAge: 60 * 1000, // 1 minute
    // Number of pages that should be kept in memory
    pagesBufferLength: 5,
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self';",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

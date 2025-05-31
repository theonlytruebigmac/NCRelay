import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
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
    // Only allow specific origins in production
    allowedDevOrigins: process.env.NODE_ENV === 'production' 
      ? ['ncrelay.syschimp.com', 'https://ncrelay.syschimp.com']
      : ['localhost:9003', '172.16.103.88:9003'],
  },
  eslint: {
    ignoreDuringBuilds: true,
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
};

export default nextConfig;

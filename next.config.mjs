/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_TEST_DIST_DIR || '.next',
  typescript: { tsconfigPath: process.env.NEXT_TEST_TSCONFIG || 'tsconfig.json' },
  reactStrictMode: true,
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
      },
    ],
  },
};

export default nextConfig;

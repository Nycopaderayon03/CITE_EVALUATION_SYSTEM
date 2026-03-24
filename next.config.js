/** @type {import('next').NextConfig} */
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: false, // Explicitly enable PWA even in development so the user can see the install prompt easily
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = withPWA(nextConfig);

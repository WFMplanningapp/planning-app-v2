/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  env: {
    NEXT_PUBLIC_APP_ENV: process.env.APP_ENV,
  },
};

module.exports = nextConfig;

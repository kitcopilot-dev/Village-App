/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/js/script.js',
        destination: 'https://plausible.exe.xyz/js/script.js',
      },
      {
        source: '/api/event',
        destination: 'https://plausible.exe.xyz/api/event',
      },
    ];
  },
};

module.exports = nextConfig;

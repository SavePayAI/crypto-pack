/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      // Show the shop at the root address instead of /shop.html
      beforeFiles: [
        { source: '/', destination: '/shop.html' },
        { source: '/admin', destination: '/admin.html' },
        { source: '/demo', destination: '/demo.html' },
      ],
    };
  },
};

module.exports = nextConfig;

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/app.html' },
      ],
      afterFiles: [],
      fallback: [],
    }
  },
}

export default nextConfig

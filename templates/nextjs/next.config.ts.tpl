import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Set a custom header to identify the server framework.
  // Remove or change this if you prefer not to expose the tech stack.
  poweredByHeader: false,

  // Disable the "X-Powered-By" header and set caching/security headers.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },

  // Allow remote image sources (e.g., CDN, user avatars, CMS).
  // Replace the placeholder patterns with your actual image domains.
  images: {
    remotePatterns: [
      // {
      //   protocol: 'https',
      //   hostname: '**.example.com',
      // },
    ],
  },

  // Optional: configure experimental features.
  // experimental: {
  //   serverActions: true, // enabled by default in Next.js 14
  // },
}

export default nextConfig

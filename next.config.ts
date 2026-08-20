import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  turbopack: {
    root: process.cwd()
  },
  async headers() {
    const shared = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "on" }
    ];

    const protectedFrameHeaders = [
      ...shared,
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none';" }
    ];

    return [
      {
        source: "/:path*",
        headers: shared
      },
      {
        source: "/dashboard/:path*",
        headers: protectedFrameHeaders
      },
      {
        source: "/admin/:path*",
        headers: protectedFrameHeaders
      },
      {
        source: "/login",
        headers: protectedFrameHeaders
      },
      {
        source: "/signup",
        headers: protectedFrameHeaders
      },
      {
        source: "/forgot-password",
        headers: protectedFrameHeaders
      },
      {
        source: "/reset-password",
        headers: protectedFrameHeaders
      }
    ];
  }
};

export default nextConfig;

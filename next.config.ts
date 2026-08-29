import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ['127.0.0.1'],
  // Turbopack: keep problematic transitive deps external so they don't get
  // bundled (esbuild ships a README.md that turbopack can't parse; remotion
  // compositor-* binaries are platform-specific .node files).
  serverExternalPackages: [
    '@esbuild/linux-x64',
    '@remotion/renderer',
    '@remotion/bundler',
    '@remotion/compositor-linux-x64-gnu',
    '@remotion/compositor-linux-x64-musl',
    '@remotion/compositor-darwin-x64',
    '@remotion/compositor-darwin-arm64',
    'z-ai-web-dev-sdk',
  ],
};

export default nextConfig;

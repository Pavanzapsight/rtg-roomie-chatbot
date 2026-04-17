import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Data files (Excel, SYSTEM_PROMPT.md, skills/) are resolved via
  // import.meta.url in src/lib/ so the bundler traces them automatically.
  // No manual outputFileTracingIncludes needed.
  async headers() {
    return [
      {
        source: "/embed",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

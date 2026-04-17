import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the Excel catalog, system prompt, and skill files are bundled
  // into the serverless function. readFileSync at runtime is invisible to
  // the bundler — without this, the files are missing in /var/task/ and
  // the API returns 500.
  outputFileTracingIncludes: {
    "/api/chat": [
      "updated rtg.xlsx",
      "SYSTEM_PROMPT.md",
      "skills/*",
    ],
  },
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

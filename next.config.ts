import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Data files are included via vercel.json includeFiles.
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

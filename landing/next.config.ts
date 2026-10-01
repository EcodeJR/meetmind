import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Keep Turbopack scoped to this application in the multi-app repository.
    root: __dirname,
  },
};

export default nextConfig;

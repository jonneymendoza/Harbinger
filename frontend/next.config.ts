import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NODE_ENV === "production"
        ? "http://backend-api:5000"
        : "http://localhost:5000",
  },
};

export default nextConfig;

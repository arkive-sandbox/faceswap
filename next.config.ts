import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.1.38',
    '192.168.1.38:3000',
    'localhost',
    '127.0.0.1',
  ],
};

export default nextConfig;

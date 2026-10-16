import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs", "ioredis", "bullmq"],
  allowedDevOrigins: ['01ea-197-218-61-188.ngrok-free.app'],
};

export default nextConfig;

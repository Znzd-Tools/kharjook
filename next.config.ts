import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
	allowedDevOrigins: ['192.168.1.149'],
  // The dev badge sits on top of the bottom tab bar on phones.
  devIndicators: false,
};

export default nextConfig;

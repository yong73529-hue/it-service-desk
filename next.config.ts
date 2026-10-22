import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ticket screenshots are served through an authenticated dynamic route.
  // Browser-direct loading preserves the user's session cookie.
  images: { unoptimized: true },
};

export default nextConfig;

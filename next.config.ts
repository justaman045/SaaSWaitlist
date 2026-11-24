import type { NextConfig } from "next";
import { ALLOWED_IMAGE_HOSTS } from "./lib/images";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: ALLOWED_IMAGE_HOSTS.map((hostname) => ({
      protocol: 'https',
      hostname,
      pathname: '**',
    })),
  },
};

export default nextConfig;

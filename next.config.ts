import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp is a native module; keep it out of the server bundle.
  serverExternalPackages: ["sharp", "passkit-generator"],
  // Tours and standalone events became campaigns; keep old links working.
  async redirects() {
    return [
      { source: "/admin/tours", destination: "/admin", permanent: false },
      { source: "/admin/tours/:path*", destination: "/admin/campaigns/:path*", permanent: false },
      { source: "/admin/events/:path*", destination: "/admin/campaigns/:path*", permanent: false },
    ];
  },
  experimental: {
    // Uploads (CSV reports up to 20 MB, images up to 10 MB) go through server actions.
    serverActions: { bodySizeLimit: "25mb" },
    proxyClientMaxBodySize: "25mb",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

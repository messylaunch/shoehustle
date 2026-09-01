/** @type {import('next').NextConfig} */
const nextConfig = {
  // Item photos are stored under public/uploads by the local uploader, so no
  // remote image hosts are configured. Add them here if you move to S3 or R2.
  images: {
    remotePatterns: [],
  },
  experimental: {
    // Shoe photos are big; the default 1MB action limit rejects them.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Prevent Turbopack from bundling packages that reference node:worker_threads
  serverExternalPackages: ['isomorphic-dompurify'],
}

export default nextConfig

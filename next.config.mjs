/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep local artifacts isolated in Dropbox workspaces, but preserve
  // Vercel's expected output directory during cloud builds.
  distDir: process.env.VERCEL === "1" ? ".next" : ".next-local",
};

export default nextConfig;
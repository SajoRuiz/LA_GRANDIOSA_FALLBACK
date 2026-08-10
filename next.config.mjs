/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep local artifacts isolated in Dropbox workspaces, but preserve
  // Vercel's expected output directory during cloud builds.
  // Some local `.env.local` files include `VERCEL=1`; requiring CI avoids
  // routing local builds into the cloud output directory.
  distDir:
    process.env.CI === "true" && process.env.VERCEL === "1"
      ? ".next"
      : ".next-local",
};

export default nextConfig;
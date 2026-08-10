/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel's Next.js builder expects the default build output at `.next`.
  // A custom `distDir` caused successful builds to be emitted elsewhere,
  // then deployment packaging failed while looking for `.next/routes-manifest.json`.
  distDir: ".next",
};

export default nextConfig;

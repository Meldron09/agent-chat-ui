/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;

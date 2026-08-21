import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  turbopack: {
    root: __dirname,
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  basePath: isGithubPages ? "/StudyOverflowTeste" : undefined,
  assetPrefix: isGithubPages ? "/StudyOverflowTeste/" : undefined,
};

export default nextConfig;

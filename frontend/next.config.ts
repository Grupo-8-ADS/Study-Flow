import type { NextConfig } from "next";
import path from "path";

const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  basePath: isGithubPages ? "/StudyOverflowTeste" : undefined,
  assetPrefix: isGithubPages ? "/StudyOverflowTeste/" : undefined,
};

export default nextConfig;

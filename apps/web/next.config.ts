import type { NextConfig } from "next";
import path from "node:path";
const config: NextConfig = { transpilePackages: ["@groweasy/shared"], outputFileTracingRoot: path.join(__dirname, "../..") };
export default config;

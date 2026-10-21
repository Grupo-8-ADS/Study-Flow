import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    fileParallelism: false, // arquivos compartilham o mesmo banco efêmero
    environment: "node",
    include: ["tests/integration/**/*.integration.test.ts"],
    globalSetup: ["./tests/integration/setup/testcontainers-global.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    alias: {
      "@studyflow/shared": path.resolve(__dirname, "./packages/shared/src"),
      "@": path.resolve(__dirname, "./frontend/src"),
    },
  },
});

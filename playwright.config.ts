import { defineConfig, devices } from "@playwright/test";

/**
 * Testes E2E (ponta a ponta) do Study Flow Web.
 *
 * - Black-box: interação apenas via papéis ARIA, labels e textos visíveis.
 * - Backend real: Supabase (Auth + PostgREST). Cada teste cria um usuário efêmero
 *   com e-mail único (domínio studyflow-e2e.dev) para evitar colisões.
 * - Telemetria: trace, vídeo e screenshot retidos apenas em falhas.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.results",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "e2e/.report", open: "never" }],
    ["junit", { outputFile: "e2e/.results/junit.xml" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // Build de produção: o servidor de dev compila rotas sob demanda e gera
        // latência variável (flakiness). E2E_DEV=1 usa `next dev` para depuração local.
        // Em CI o build é feito em etapa anterior do workflow.
        command: process.env.E2E_DEV
          ? `npm --workspace=frontend run dev -- -p ${PORT}`
          : isCI
            ? `npm --workspace=frontend run start -- -p ${PORT}`
            : `npm run build:web && npm --workspace=frontend run start -- -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !isCI,
        timeout: 300_000,
      },
});

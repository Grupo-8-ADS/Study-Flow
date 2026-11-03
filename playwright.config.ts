import { defineConfig, devices } from "@playwright/test";

/**
 * Testes E2E (ponta a ponta) do Study Flow Web.
 *
 * - Black-box: interação apenas via papéis ARIA, labels e textos visíveis.
 * - Backend real: Supabase (Auth + PostgREST). Cada teste cria um usuário efêmero
 *   com e-mail único (domínio studyflow-e2e.dev) para evitar colisões.
 * - Telemetria: trace, vídeo e screenshot retidos apenas em falhas.
 */
// Localmente, lê o frontend/.env.local (ex.: SUPABASE_SERVICE_ROLE_KEY para o fluxo 3); na CI vem dos secrets.
try {
  process.loadEnvFile("frontend/.env.local");
} catch {
  // arquivo opcional
}

const PORT = Number(process.env.E2E_PORT ?? 3000);
const isCI = !!process.env.CI;
const GOOGLE_MOCK_PORT = Number(process.env.GOOGLE_MOCK_PORT ?? 4010);
// Data da prova do e-mail falso (fluxo 3), calculada uma vez e compartilhada com o mock e os testes.
process.env.E2E_DATA_PROVA ??= new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString("sv-SE", {
  timeZone: "America/Sao_Paulo",
});

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
    : [
      {
        // Google falso (OAuth + Gmail API) para o fluxo 3 (RF012).
        command: `node e2e/support/google-mock.mjs`,
        url: `http://127.0.0.1:${GOOGLE_MOCK_PORT}`,
        env: { GOOGLE_MOCK_PORT: String(GOOGLE_MOCK_PORT), E2E_DATA_PROVA: process.env.E2E_DATA_PROVA },
        reuseExistingServer: !isCI,
      },
      {
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
        // O Next fala com o Google falso; o service role (quando houver) vem do ambiente.
        env: {
          GOOGLE_CLIENT_ID: "studyflow-e2e",
          GOOGLE_CLIENT_SECRET: "studyflow-e2e-segredo",
          GOOGLE_OAUTH_URL: `http://127.0.0.1:${GOOGLE_MOCK_PORT}/auth`,
          GOOGLE_TOKEN_URL: `http://127.0.0.1:${GOOGLE_MOCK_PORT}/token`,
          GOOGLE_API_BASE: `http://127.0.0.1:${GOOGLE_MOCK_PORT}`,
        },
      },
    ],
});

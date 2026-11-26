import { defineConfig, devices } from "@playwright/test";

/**
 * Testes E2E (ponta a ponta) do Study Flow Web. Rode com `npm run test:e2e` (scripts/e2e.mjs).
 *
 * - Black-box: interação apenas via papéis ARIA, labels e textos visíveis.
 * - Backend real, mas local: Supabase no Docker (Auth + PostgREST + Postgres), montado com as
 *   migrations do repositório. A produção nunca é usada pelos testes.
 * - Cada teste cria um usuário efêmero pela API admin e o apaga no fim (e2e/support/fixtures.ts).
 * - Telemetria: trace, vídeo e screenshot retidos apenas em falhas.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!process.env.E2E_SUPABASE_LOCAL || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(SUPABASE_URL)) {
  throw new Error(
    "Os testes E2E rodam só contra o Supabase local. Use `npm run test:e2e`, que sobe a pilha no Docker e passa as chaves.",
  );
}

// Porta própria, e não a 3000 do `npm run dev`: um servidor de dev aberto aponta para a produção
// (frontend/.env.local) e não pode ser reaproveitado pelos testes.
const PORT = Number(process.env.E2E_PORT ?? 3100);
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
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Google falso (OAuth + Gmail API) para o fluxo 3 (RF012).
      command: `node e2e/support/google-mock.mjs`,
      url: `http://127.0.0.1:${GOOGLE_MOCK_PORT}`,
      env: { GOOGLE_MOCK_PORT: String(GOOGLE_MOCK_PORT), E2E_DATA_PROVA: process.env.E2E_DATA_PROVA },
      reuseExistingServer: !isCI,
    },
    {
      // Build de produção, gerado pelo scripts/e2e.mjs com as chaves do Supabase local: o servidor
      // de dev compila rotas sob demanda e gera latência variável. E2E_DEV=1 usa `next dev`.
      command: process.env.E2E_DEV
        ? `npm --workspace=frontend run dev -- -p ${PORT}`
        : `npm --workspace=frontend run start -- -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
      timeout: 300_000,
      // O Supabase local vem do ambiente (scripts/e2e.mjs); o Google é o falso.
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

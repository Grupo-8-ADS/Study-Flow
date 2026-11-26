#!/usr/bin/env node
/**
 * Testes E2E contra um Supabase local (npm run test:e2e). Nada aqui fala com a produção.
 *
 * 1. Sobe a pilha local do Supabase no Docker (`supabase start`, config em supabase/config.toml)
 *    com as migrations do repositório. Se ela já estava de pé, aplica só as que faltam.
 * 2. Gera o build de produção da web apontando para essa pilha. As variáveis NEXT_PUBLIC_ são
 *    embutidas no build, e as do processo valem mais que o frontend/.env.local.
 * 3. Roda o Playwright com as chaves locais. Cada teste cria o próprio usuário pela API admin e o
 *    apaga no fim (e2e/support/fixtures.ts).
 *
 * Sem Docker, fora do CI, os testes são pulados com aviso (o CI roda). No CI, faltar Docker é erro.
 * Argumentos extras vão para o Playwright: `npm run test:e2e -- e2e/fluxo2-pomodoro-estatisticas.spec.ts`.
 * E2E_DEV=1 usa `next dev` em vez do build, para depurar.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const emCI = Boolean(process.env.CI);
/** O scripts/verify.mjs procura esta frase para mostrar o E2E como pulado, e não como aprovado. */
const AVISO_PULADO = "E2E pulado";

const rodar = (comando, env = process.env) =>
  spawnSync(comando, { cwd: RAIZ, stdio: "inherit", shell: true, env }).status ?? 1;

const ler = (comando) => {
  const r = spawnSync(comando, { cwd: RAIZ, shell: true, encoding: "utf8" });
  return r.status === 0 ? r.stdout : null;
};

function falhar(mensagem) {
  console.error(`\n✖ ${mensagem}`);
  process.exit(1);
}

if (ler("docker info --format {{.ServerVersion}}") === null) {
  const motivo = "Docker não encontrado ou parado. Os testes E2E sobem um Supabase local no Docker.";
  if (emCI) falhar(motivo);
  console.warn(`\n⚠ ${AVISO_PULADO}: ${motivo}\n  O CI roda esses testes. Para rodar aqui, instale e abra o Docker Desktop.`);
  process.exit(0);
}

console.log("▶ Supabase local (Docker)");
if (rodar("npx supabase start") !== 0) falhar("`supabase start` falhou.");
if (rodar("npx supabase migration up --local") !== 0) falhar("Não foi possível aplicar as migrations no Supabase local.");

const bruto = ler("npx supabase status -o json");
const json = bruto?.slice(bruto.indexOf("{"), bruto.lastIndexOf("}") + 1);
let status;
try {
  status = JSON.parse(json ?? "");
} catch {
  falhar("Não foi possível ler as chaves do Supabase local (`supabase status -o json`).");
}
const { API_URL: url, ANON_KEY: chavePublica, SERVICE_ROLE_KEY: chaveSecreta } = status;
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url ?? "") || !chavePublica || !chaveSecreta) {
  falhar(`O Supabase do E2E precisa ser o local; \`supabase status\` devolveu a URL "${url}".`);
}

const env = {
  ...process.env,
  E2E_SUPABASE_LOCAL: "1",
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: chavePublica,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: chavePublica,
  SUPABASE_SERVICE_ROLE_KEY: chaveSecreta,
};

if (!process.env.E2E_DEV) {
  console.log("\n▶ Build da web apontando para o Supabase local");
  if (rodar("npm run build:web", env) !== 0) falhar("O build da web falhou.");
}

console.log("\n▶ Playwright");
const extras = process.argv.slice(2).map((a) => JSON.stringify(a)).join(" ");
process.exit(rodar(`npx playwright test ${extras}`.trim(), env));

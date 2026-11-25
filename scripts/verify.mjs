#!/usr/bin/env node
/**
 * Roda localmente as mesmas checagens do CI (.github/workflows/frontend-ci.yml).
 * Cada checagem é um script do package.json da raiz; o CI chama esses mesmos scripts,
 * então não há como os dois divergirem.
 *
 * Uso:
 *   npm run verify                  web + mobile + integração (o que o pre-push roda)
 *   npm run verify -- web mobile    só os grupos escolhidos
 *   npm run verify -- --e2e         inclui os testes E2E (Playwright, precisa do .env)
 *
 * Os grupos rodam em paralelo; dentro de cada grupo, as etapas rodam em ordem e o grupo
 * para na primeira falha (como um job do CI).
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Mesmos grupos e ordem dos jobs do CI. */
const GRUPOS = {
  web: ["lint:web", "typecheck:web", "test:coverage", "build:web"],
  mobile: ["typecheck:mobile", "lint:mobile", "doctor:mobile", "export:mobile"],
  integracao: ["test:integration"],
  e2e: ["test:e2e"],
};
const PADRAO = ["web", "mobile", "integracao"];

const args = process.argv.slice(2);
const pedidos = args.filter((a) => !a.startsWith("--"));
const desconhecidos = pedidos.filter((g) => !(g in GRUPOS));
if (desconhecidos.length) {
  console.error(`Grupo desconhecido: ${desconhecidos.join(", ")}. Use: ${Object.keys(GRUPOS).join(", ")}.`);
  process.exit(2);
}
const grupos = pedidos.length ? pedidos : [...PADRAO, ...(args.includes("--e2e") ? ["e2e"] : [])];

const segundos = (ms) => `${(ms / 1000).toFixed(0)}s`;

function rodar(script) {
  return new Promise((resolve) => {
    const inicio = Date.now();
    // Sem --silent: ele vira npm_config_loglevel=silent nos filhos e quebra quem chama o
    // npm por baixo (o expo-doctor usa `npm explain --json`).
    const filho = spawn("npm", ["run", script], { cwd: RAIZ, shell: true, env: { ...process.env, FORCE_COLOR: "0" } });
    let saida = "";
    filho.stdout.on("data", (d) => (saida += d));
    filho.stderr.on("data", (d) => (saida += d));
    filho.on("close", (codigo) => resolve({ ok: codigo === 0, saida, ms: Date.now() - inicio }));
  });
}

async function rodarGrupo(grupo) {
  for (const script of GRUPOS[grupo]) {
    const { ok, saida, ms } = await rodar(script);
    console.log(`${ok ? "✔" : "✖"} ${grupo} › ${script} (${segundos(ms)})`);
    if (!ok) {
      const ultimas = saida.trimEnd().split(/\r?\n/).slice(-60).join("\n");
      console.log(`\n── saída de ${script} (últimas linhas) ──\n${ultimas}\n`);
      return false;
    }
  }
  return true;
}

const inicio = Date.now();
console.log(`Verificando: ${grupos.join(", ")}\n`);
const resultados = await Promise.all(grupos.map(rodarGrupo));
const falhas = grupos.filter((_, i) => !resultados[i]);

if (falhas.length) {
  console.log(`\n✖ Falhou em ${falhas.join(", ")} (${segundos(Date.now() - inicio)}). Corrija antes de subir.`);
  process.exit(1);
}
console.log(`\n✔ Tudo certo (${segundos(Date.now() - inicio)}).`);

#!/usr/bin/env node
/**
 * Aponta o git para os hooks versionados em .githooks (roda no `npm install` via "prepare").
 * Não faz nada no CI, em builds de deploy (Vercel/EAS definem CI) ou fora de um repositório git.
 */
import { execFileSync } from "node:child_process";

if (process.env.CI) process.exit(0);

try {
  execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { stdio: "ignore" });
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "ignore" });
} catch {
  // Sem git ou fora de um repositório (ex.: pacote instalado de um tarball): nada a instalar.
}

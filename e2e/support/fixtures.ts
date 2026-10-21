import { test as base, expect, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://fsevgdeegpaxdhcwkkcz.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  // Chave publishable (pública por definição), a mesma usada como fallback no frontend.
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZXZnZGVlZ3BheGRoY3dra2N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2Mjg2MDYsImV4cCI6MjA5OTIwNDYwNn0.J8rWkpAeueZ2-ji4gG4-IFlrq1Z4Na0K73muaySkf-4";

export type UsuarioE2E = {
  nome: string;
  username: string;
  email: string;
  senha: string;
};

/** Identificadores efêmeros: cada teste recebe um usuário único (anti-flakiness). */
export function novoUsuario(): UsuarioE2E {
  const id = randomUUID().slice(0, 8);
  return {
    nome: `Estudante E2E ${id}`,
    username: `e2e_${id}`,
    email: `e2e.${id}@studyflow-e2e.dev`,
    senha: `Senha@${id}`,
  };
}

/**
 * API Data Seeding: cria o usuário direto no Supabase Auth (sem passar pela UI),
 * para fluxos cujo foco não é o cadastro.
 */
export async function criarUsuarioViaApi(usuario: UsuarioE2E): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: usuario.email,
      password: usuario.senha,
      data: { nome: usuario.nome, username: usuario.username },
    }),
  });
  if (!res.ok) {
    throw new Error(`Falha no seeding do usuário (${res.status}): ${await res.text()}`);
  }
}

const EVIDENCIAS_DIR = path.resolve(__dirname, "../evidencias");

/**
 * Registra uma evidência (print) da etapa: anexa ao relatório HTML do Playwright e,
 * com E2E_EVIDENCIAS=1, grava em e2e/evidencias/ para uso no relatório do projeto.
 */
export async function evidencia(page: Page, testInfo: TestInfo, nome: string) {
  const buffer = await page.screenshot({ fullPage: true });
  await testInfo.attach(nome, { body: buffer, contentType: "image/png" });
  if (process.env.E2E_EVIDENCIAS === "1") {
    fs.mkdirSync(EVIDENCIAS_DIR, { recursive: true });
    fs.writeFileSync(path.join(EVIDENCIAS_DIR, `${nome}.png`), buffer);
  }
}

/** Desativa transições/animações CSS para estabilizar as ações (anti-flakiness). */
const SEM_ANIMACOES = `*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important;animation-delay:0s!important}`;

export const test = base.extend<{ usuario: UsuarioE2E }>({
  page: async ({ page }, use) => {
    await page.addInitScript((css) => {
      document.addEventListener("DOMContentLoaded", () => {
        const style = document.createElement("style");
        style.textContent = css;
        document.head.appendChild(style);
      });
    }, SEM_ANIMACOES);
    await use(page);
  },
  usuario: async ({}, use) => {
    await use(novoUsuario());
  },
});

export { expect };

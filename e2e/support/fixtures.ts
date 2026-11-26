import { test as base, expect, type Page, type TestInfo } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Cliente admin do Supabase local, com a chave secreta que o scripts/e2e.mjs lê do
 * `supabase status`. O playwright.config recusa rodar se a URL não for a local.
 */
let clienteAdmin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("Supabase local sem URL ou chave: rode com `npm run test:e2e`.");
  clienteAdmin ??= createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
  return clienteAdmin;
}

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
 * API Data Seeding: cria o usuário já confirmado pela API admin do Supabase Auth (sem passar
 * pela UI), para fluxos cujo foco não é o cadastro. O trigger do banco cria o perfil com o
 * nome e o username do metadata, como no cadastro pela tela.
 */
export async function criarUsuarioViaApi(usuario: UsuarioE2E): Promise<void> {
  const { error } = await admin().auth.admin.createUser({
    email: usuario.email,
    password: usuario.senha,
    email_confirm: true,
    user_metadata: { nome: usuario.nome, username: usuario.username },
  });
  if (error) throw new Error(`Falha no seeding do usuário: ${error.message}`);
}

/**
 * Apaga o usuário do teste, se ele chegou a existir (pela API ou pelo cadastro na tela).
 * As chaves estrangeiras com `on delete cascade` levam junto o perfil e os dados dele.
 */
async function apagarUsuario(email: string): Promise<void> {
  const porPagina = 200;
  for (let page = 1; ; page++) {
    const { data, error } = await admin().auth.admin.listUsers({ page, perPage: porPagina });
    if (error) throw new Error(`Falha ao listar os usuários de teste: ${error.message}`);
    const usuario = data.users.find((u) => u.email === email);
    if (usuario) {
      const { error: erroAoApagar } = await admin().auth.admin.deleteUser(usuario.id);
      if (erroAoApagar) throw new Error(`Falha ao apagar o usuário de teste: ${erroAoApagar.message}`);
      return;
    }
    if (data.users.length < porPagina) return;
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
    const usuario = novoUsuario();
    await use(usuario);
    await apagarUsuario(usuario.email);
  },
});

export { expect };

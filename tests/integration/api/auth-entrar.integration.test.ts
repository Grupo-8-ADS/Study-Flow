import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { POST as entrar } from "@/app/api/auth/entrar/route";

/**
 * Login por nome de usuário (RF003): a rota real conversa por HTTP com o PostgREST (RPC que
 * resolve o e-mail) e com o Supabase Auth (grant password), ambos simulados com MSW.
 */

const CONTAS: Record<string, { email: string; senha: string; confirmado: boolean }> = {
  ana: { email: "ana@unifei.edu.br", senha: "senha-certa", confirmado: true },
  bia: { email: "bia@unifei.edu.br", senha: "senha-da-bia", confirmado: false },
};

let ipsEncaminhados: (string | null)[];
let chavesUsadas: (string | null)[];
let tentativasDeSenha: number;

const erroAuth = (status: number, code: string) =>
  HttpResponse.json(
    { code, error_code: code, msg: code },
    { status, headers: { "x-supabase-api-version": "2024-01-01" } },
  );

const server = setupServer(
  http.post("*/rest/v1/rpc/get_email_by_username", async ({ request }) => {
    chavesUsadas.push(request.headers.get("apikey"));
    ipsEncaminhados.push(request.headers.get("sb-forwarded-for"));
    const { login_username } = (await request.json()) as { login_username: string };
    return HttpResponse.json(CONTAS[login_username.trim().toLowerCase()]?.email ?? null);
  }),
  http.post("*/auth/v1/token", async ({ request }) => {
    tentativasDeSenha++;
    const { email, password } = (await request.json()) as { email: string; password: string };
    const conta = Object.values(CONTAS).find((c) => c.email === email);
    if (!conta || conta.senha !== password) return erroAuth(400, "invalid_credentials");
    if (!conta.confirmado) return erroAuth(400, "email_not_confirmed");
    return HttpResponse.json({
      access_token: `at-${email}`,
      refresh_token: `rt-${email}`,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "u-1", aud: "authenticated", role: "authenticated", email },
    });
  }),
);

const requisicao = (corpo: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/auth/entrar", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });

describe("POST /api/auth/entrar (login por nome de usuário)", () => {
  const envOriginal = { ...process.env };

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterAll(() => {
    server.close();
    process.env = envOriginal;
  });

  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_teste";
    ipsEncaminhados = [];
    chavesUsadas = [];
    tentativasDeSenha = 0;
  });
  afterEach(() => server.resetHandlers());

  it("usuário e senha certos: devolve a sessão, sem expor o e-mail", async () => {
    const resposta = await entrar(requisicao({ usuario: "  Ana ", senha: "senha-certa" }, { "x-real-ip": "200.1.2.3" }));
    const corpo = await resposta.json();

    expect(resposta.status).toBe(200);
    expect(corpo).toEqual({ access_token: "at-ana@unifei.edu.br", refresh_token: "rt-ana@unifei.edu.br" });
    expect(JSON.stringify(corpo)).not.toContain('"ana@unifei.edu.br"');
    expect(resposta.headers.get("cache-control")).toBe("no-store");
    // Chave secreta no servidor e IP do usuário para o rate limit do Supabase Auth.
    expect(chavesUsadas).toEqual(["sb_secret_teste"]);
    expect(ipsEncaminhados).toEqual(["200.1.2.3"]);
  });

  it("usa o primeiro IP do x-forwarded-for quando não há x-real-ip", async () => {
    await entrar(requisicao({ usuario: "ana", senha: "senha-certa" }, { "x-forwarded-for": "200.9.9.9, 10.0.0.1" }));
    expect(ipsEncaminhados).toEqual(["200.9.9.9"]);
  });

  it("usuário inexistente e senha errada recebem exatamente a mesma resposta", async () => {
    const inexistente = await entrar(requisicao({ usuario: "ninguem", senha: "x" }));
    const senhaErrada = await entrar(requisicao({ usuario: "ana", senha: "errada" }));

    expect(inexistente.status).toBe(401);
    expect(senhaErrada.status).toBe(401);
    expect(await inexistente.json()).toEqual({ codigo: "credenciais_invalidas" });
    expect(await senhaErrada.json()).toEqual({ codigo: "credenciais_invalidas" });
    expect(tentativasDeSenha).toBe(1); // usuário inexistente nem chega ao Supabase Auth
  });

  it("conta sem e-mail confirmado: 403 email_nao_confirmado", async () => {
    const resposta = await entrar(requisicao({ usuario: "bia", senha: "senha-da-bia" }));
    expect(resposta.status).toBe(403);
    expect(await resposta.json()).toEqual({ codigo: "email_nao_confirmado" });
  });

  it("rate limit do Supabase Auth vira 429 muitas_tentativas", async () => {
    server.use(http.post("*/auth/v1/token", () => erroAuth(429, "over_request_rate_limit")));
    const resposta = await entrar(requisicao({ usuario: "ana", senha: "senha-certa" }));
    expect(resposta.status).toBe(429);
    expect(await resposta.json()).toEqual({ codigo: "muitas_tentativas" });
  });

  it("corpo inválido: 400 sem consultar nada", async () => {
    for (const corpo of ["não é json", {}, { usuario: "ana" }, { usuario: 1, senha: "x" }, { usuario: "a".repeat(65), senha: "x" }]) {
      const resposta = await entrar(requisicao(corpo));
      expect(resposta.status).toBe(400);
      expect(await resposta.json()).toEqual({ codigo: "credenciais_invalidas" });
    }
    expect(chavesUsadas).toEqual([]);
  });

  it("sem a chave secreta configurada: 503 indisponivel", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resposta = await entrar(requisicao({ usuario: "ana", senha: "senha-certa" }));
    expect(resposta.status).toBe(503);
    expect(await resposta.json()).toEqual({ codigo: "indisponivel" });
  });

  it("falha ao consultar o banco: 503 indisponivel (não finge que o usuário não existe)", async () => {
    server.use(http.post("*/rest/v1/rpc/get_email_by_username", () => HttpResponse.json({ message: "boom" }, { status: 500 })));
    const resposta = await entrar(requisicao({ usuario: "ana", senha: "senha-certa" }));
    expect(resposta.status).toBe(503);
  });
});

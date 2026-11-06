import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { POST as sincronizar } from "@/app/api/gmail/sincronizar/route";
import { POST as conectar } from "@/app/api/gmail/conectar/route";
import { GET as callback } from "@/app/api/gmail/callback/route";
import { assinarEstado, lerEstado, verificarEstado } from "@/lib/gmail-server";

/**
 * Integração com API externa (RF012): as rotas reais do Next conversam por HTTP com o
 * Google (OAuth + Gmail API) e com o PostgREST do Supabase, ambos simulados com MSW.
 * O "banco" é um estado em memória para verificar exatamente o que a rota grava.
 */

const USER_ID = "11111111-2222-3333-4444-555555555555";
const TOKEN_USUARIO = "jwt-do-usuario";
const ENV = {
  GOOGLE_CLIENT_ID: "client-id-teste",
  GOOGLE_CLIENT_SECRET: "segredo-teste",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-teste",
  GOOGLE_TOKEN_URL: "https://google.test/token",
  GOOGLE_OAUTH_URL: "https://google.test/auth",
  GOOGLE_API_BASE: "https://gmail.test",
};

type Linha = Record<string, unknown>;
let banco: Record<string, Linha[]>;
let consultasGmail: string[];
let refreshTokensUsados: string[];
let tokenGoogleStatus: number;

const emails: Record<string, { assunto: string; trecho: string; recebido: string }> = {
  m1: { assunto: "Prova de Cálculo dia 12/11", trecho: "Conteúdo: derivadas", recebido: "2026-11-01T12:00:00Z" },
  m2: { assunto: "Entrega do trabalho de Redes", trecho: "O prazo é 20/11/2026 às 23h59", recebido: "2026-11-01T12:00:00Z" },
  m3: { assunto: "Aviso sobre a prova", trecho: "Data a definir", recebido: "2026-11-01T12:00:00Z" },
  m4: { assunto: "P1 de Banco de Dados 15/11", trecho: "", recebido: "2026-11-01T12:00:00Z" },
};

/** Aplica filtros simples do PostgREST (col=eq.valor e col=in.(a,b)). */
function filtrar(tabela: string, params: URLSearchParams): Linha[] {
  return (banco[tabela] ?? []).filter((linha) =>
    [...params.entries()].every(([col, cond]) => {
      if (["select", "on_conflict", "columns", "order", "limit"].includes(col)) return true;
      if (cond.startsWith("eq.")) return String(linha[col]) === cond.slice(3);
      if (cond.startsWith("in.(")) return cond.slice(4, -1).split(",").map((v) => v.replace(/^"|"$/g, "")).includes(String(linha[col]));
      return true;
    })
  );
}

const responderLinhas = (request: Request, linhas: Linha[]) =>
  (request.headers.get("accept") ?? "").includes("vnd.pgrst.object")
    ? linhas[0]
      ? HttpResponse.json(linhas[0])
      : HttpResponse.json({ code: "PGRST116", message: "0 rows" }, { status: 406 })
    : HttpResponse.json(linhas);

const server = setupServer(
  // Supabase Auth: valida o JWT do usuário
  http.get("*/auth/v1/user", ({ request }) =>
    request.headers.get("authorization") === `Bearer ${TOKEN_USUARIO}`
      ? HttpResponse.json({ id: USER_ID, aud: "authenticated", role: "authenticated", email: "aluno@unifei.edu.br" })
      : HttpResponse.json({ message: "invalid JWT" }, { status: 401 })
  ),
  // Supabase PostgREST (service role)
  http.get("*/rest/v1/:tabela", ({ request, params }) =>
    responderLinhas(request, filtrar(String(params.tabela), new URL(request.url).searchParams))
  ),
  http.post("*/rest/v1/:tabela", async ({ request, params }) => {
    const tabela = String(params.tabela);
    const corpo = (await request.json()) as Linha | Linha[];
    const linhas = Array.isArray(corpo) ? corpo : [corpo];
    const upsert = (request.headers.get("prefer") ?? "").includes("resolution=merge-duplicates");
    banco[tabela] ??= [];
    // Índice único parcial (user_id, origem_externa_id) de itens_cronograma
    const duplicada = linhas.some((linha) =>
      linha.origem_externa_id != null &&
      banco[tabela].some((l) => l.user_id === linha.user_id && l.origem_externa_id === linha.origem_externa_id)
    );
    if (duplicada) return HttpResponse.json({ code: "23505", message: "duplicate key value" }, { status: 409 });
    for (const linha of linhas) {
      const existente = upsert ? banco[tabela].find((l) => l.user_id === linha.user_id) : undefined;
      if (existente) Object.assign(existente, linha);
      else banco[tabela].push({ ...linha });
    }
    return new HttpResponse(null, { status: 201 });
  }),
  http.patch("*/rest/v1/:tabela", async ({ request, params }) => {
    const alteracao = (await request.json()) as Linha;
    filtrar(String(params.tabela), new URL(request.url).searchParams).forEach((l) => Object.assign(l, alteracao));
    return new HttpResponse(null, { status: 204 });
  }),
  // Google OAuth (troca de código e renovação de token)
  http.post(ENV.GOOGLE_TOKEN_URL, async ({ request }) => {
    const form = new URLSearchParams(await request.text());
    if (tokenGoogleStatus !== 200) return HttpResponse.json({ error: "invalid_grant" }, { status: tokenGoogleStatus });
    if (form.get("grant_type") === "refresh_token") {
      refreshTokensUsados.push(form.get("refresh_token") ?? "");
      return HttpResponse.json({ access_token: "access-renovado", expires_in: 3599 });
    }
    return form.get("code") === "codigo-valido"
      ? HttpResponse.json({ access_token: "access-novo", refresh_token: "refresh-novo", expires_in: 3599 })
      : HttpResponse.json({ error: "invalid_grant" }, { status: 400 });
  }),
  // Gmail API
  http.get(`${ENV.GOOGLE_API_BASE}/gmail/v1/users/me/profile`, () => HttpResponse.json({ emailAddress: "aluno@gmail.com" })),
  http.get(`${ENV.GOOGLE_API_BASE}/gmail/v1/users/me/messages`, ({ request }) => {
    consultasGmail.push(new URL(request.url).searchParams.get("q") ?? "");
    return HttpResponse.json({ messages: Object.keys(emails).map((id) => ({ id, threadId: id })) });
  }),
  http.get(`${ENV.GOOGLE_API_BASE}/gmail/v1/users/me/messages/:id`, ({ request, params }) => {
    if (request.headers.get("authorization") !== "Bearer access-renovado") return new HttpResponse(null, { status: 401 });
    const email = emails[String(params.id)];
    return HttpResponse.json({
      id: params.id,
      snippet: email.trecho,
      internalDate: String(Date.parse(email.recebido)),
      payload: { headers: [{ name: "Subject", value: email.assunto }] },
    });
  })
);

const requisicao = (url: string, token: string | null = TOKEN_USUARIO) =>
  new Request(url, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });

describe("Integração com API externa: Gmail (RF012)", () => {
  const envOriginal = { ...process.env };

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterAll(() => server.close());
  afterEach(() => server.resetHandlers());

  beforeEach(() => {
    Object.assign(process.env, ENV);
    consultasGmail = [];
    refreshTokensUsados = [];
    tokenGoogleStatus = 200;
    banco = {
      sinc_gmail_tokens: [{ user_id: USER_ID, refresh_token: "refresh-guardado" }],
      sinc_gmail: [{ user_id: USER_ID, email_sinc: "aluno@gmail.com", data_ultima_sinc: "2026-10-25T10:00:00Z" }],
      palavras_chave: [
        { user_id: USER_ID, palavra: "prova", localizacao: "assunto" },
        { user_id: USER_ID, palavra: "entrega", localizacao: "corpo" },
        { user_id: "outro-usuario", palavra: "segredo", localizacao: "assunto" },
      ],
      itens_cronograma: [{ user_id: USER_ID, nome: "Já importado", origem_externa_id: "gmail:m4" }],
    };
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  describe("POST /api/gmail/sincronizar", () => {
    it("deve criar itens só para e-mails com data e ainda não importados, usando o refresh token guardado", async () => {
      const resposta = await sincronizar(requisicao("http://localhost/api/gmail/sincronizar"));

      expect(resposta.status).toBe(200);
      expect(await resposta.json()).toEqual({ encontrados: 4, criados: 2, jaImportados: 1, semData: 1 });
      expect(refreshTokensUsados).toEqual(["refresh-guardado"]);

      const criados = banco.itens_cronograma.filter((i) => i.origem_externa_id !== "gmail:m4");
      expect(criados).toEqual([
        expect.objectContaining({ user_id: USER_ID, nome: "Prova de Cálculo dia 12/11", tipo: "prova", data_inicio: "2026-11-12T00:00:00-03:00", origem_externa_id: "gmail:m1" }),
        expect.objectContaining({ user_id: USER_ID, nome: "Entrega do trabalho de Redes", tipo: "trabalho", data_inicio: "2026-11-20T00:00:00-03:00", origem_externa_id: "gmail:m2" }),
      ]);
      expect(criados[0].descricao).toBe("Importado do Gmail (aluno@gmail.com)");
    });

    it("deve montar a busca só com as palavras do próprio usuário, a partir da última sincronização", async () => {
      await sincronizar(requisicao("http://localhost/api/gmail/sincronizar"));

      expect(consultasGmail).toHaveLength(1);
      expect(consultasGmail[0]).toMatch(/^\{subject:prova entrega\} after:2026\/10\/2[45]$/);
      expect(consultasGmail[0]).not.toContain("segredo");
    });

    it("deve registrar a data da sincronização", async () => {
      const antes = Date.now();

      await sincronizar(requisicao("http://localhost/api/gmail/sincronizar"));

      const quando = Date.parse(String(banco.sinc_gmail[0].data_ultima_sinc));
      expect(quando).toBeGreaterThanOrEqual(antes - 1000);
    });

    it("deve ser idempotente: a segunda sincronização não duplica itens", async () => {
      await sincronizar(requisicao("http://localhost/api/gmail/sincronizar"));
      const segunda = await sincronizar(requisicao("http://localhost/api/gmail/sincronizar"));

      expect(await segunda.json()).toMatchObject({ criados: 0, jaImportados: 3 });
      expect(banco.itens_cronograma).toHaveLength(3);
    });

    it("deve ler todas as páginas da busca do Gmail", async () => {
      server.use(
        http.get(`${ENV.GOOGLE_API_BASE}/gmail/v1/users/me/messages`, ({ request }) => {
          const pagina = new URL(request.url).searchParams.get("pageToken");
          return HttpResponse.json(
            pagina === "p2"
              ? { messages: [{ id: "m2" }, { id: "m3" }, { id: "m4" }] }
              : { messages: [{ id: "m1" }], nextPageToken: "p2" }
          );
        })
      );

      const resposta = await sincronizar(requisicao("http://localhost/api/gmail/sincronizar"));

      expect(await resposta.json()).toEqual({ encontrados: 4, criados: 2, jaImportados: 1, semData: 1 });
    });

    it("não deve falhar quando outra sincronização simultânea já importou parte dos itens", async () => {
      // A checagem de duplicados não vê m1, mas outra requisição o insere antes deste insert.
      server.use(http.get("*/rest/v1/itens_cronograma", () => HttpResponse.json([])));
      banco.itens_cronograma.push({ user_id: USER_ID, nome: "Outra aba", origem_externa_id: "gmail:m1" });

      const resposta = await sincronizar(requisicao("http://localhost/api/gmail/sincronizar"));

      expect(resposta.status).toBe(200);
      expect(await resposta.json()).toMatchObject({ criados: 1 });
      expect(banco.itens_cronograma.filter((i) => i.origem_externa_id === "gmail:m1")).toHaveLength(1);
      expect(banco.itens_cronograma.some((i) => i.origem_externa_id === "gmail:m2")).toBe(true);
    });

    it("deve responder 409 GMAIL_DESCONECTADO quando não há token guardado", async () => {
      banco.sinc_gmail_tokens = [];

      const resposta = await sincronizar(requisicao("http://localhost/api/gmail/sincronizar"));

      expect(resposta.status).toBe(409);
      expect(await resposta.json()).toMatchObject({ code: "GMAIL_DESCONECTADO" });
      expect(consultasGmail).toHaveLength(0);
    });

    it("deve responder 422 SEM_PALAVRAS_CHAVE quando o usuário não cadastrou palavras", async () => {
      banco.palavras_chave = banco.palavras_chave.filter((p) => p.user_id !== USER_ID);

      const resposta = await sincronizar(requisicao("http://localhost/api/gmail/sincronizar"));

      expect(resposta.status).toBe(422);
      expect(await resposta.json()).toMatchObject({ code: "SEM_PALAVRAS_CHAVE" });
    });

    it("deve responder 409 GMAIL_REVOGADO quando o Google recusa o refresh token", async () => {
      tokenGoogleStatus = 400;

      const resposta = await sincronizar(requisicao("http://localhost/api/gmail/sincronizar"));

      expect(resposta.status).toBe(409);
      expect(await resposta.json()).toMatchObject({ code: "GMAIL_REVOGADO" });
      expect(banco.sinc_gmail[0].data_ultima_sinc).toBe("2026-10-25T10:00:00Z");
    });

    it("deve responder 502 GMAIL_FALHOU quando o Google está fora do ar", async () => {
      tokenGoogleStatus = 503;

      const resposta = await sincronizar(requisicao("http://localhost/api/gmail/sincronizar"));

      expect(resposta.status).toBe(502);
      expect(await resposta.json()).toMatchObject({ code: "GMAIL_FALHOU" });
    });

    it("deve responder 401 sem token de usuário e 503 quando o servidor não está configurado", async () => {
      const semToken = await sincronizar(requisicao("http://localhost/api/gmail/sincronizar", null));
      delete process.env.GOOGLE_CLIENT_SECRET;
      const semConfig = await sincronizar(requisicao("http://localhost/api/gmail/sincronizar"));

      expect([semToken.status, semConfig.status]).toEqual([401, 503]);
    });
  });

  describe("Fluxo OAuth: /api/gmail/conectar e /api/gmail/callback", () => {
    it("conectar deve devolver a URL de consentimento com escopo somente leitura e acesso offline", async () => {
      const resposta = await conectar(requisicao("http://localhost:3000/api/gmail/conectar"));
      const url = new URL(((await resposta.json()) as { url: string }).url);

      expect(url.origin + url.pathname).toBe(ENV.GOOGLE_OAUTH_URL);
      expect(Object.fromEntries(url.searchParams)).toMatchObject({
        client_id: ENV.GOOGLE_CLIENT_ID,
        redirect_uri: "http://localhost:3000/api/gmail/callback",
        scope: "https://www.googleapis.com/auth/gmail.readonly",
        access_type: "offline",
      });
      expect(verificarEstado(url.searchParams.get("state")!, ENV.GOOGLE_CLIENT_SECRET)).toBe(USER_ID);
    });

    it("callback com estado válido deve guardar o refresh token e o e-mail e voltar para /integracoes", async () => {
      banco.sinc_gmail_tokens = [];
      banco.sinc_gmail = [];
      const estado = assinarEstado(USER_ID, ENV.GOOGLE_CLIENT_SECRET);

      const resposta = await callback(new Request(`http://localhost:3000/api/gmail/callback?code=codigo-valido&state=${estado}`));

      expect(resposta.status).toBe(307);
      expect(resposta.headers.get("location")).toBe("http://localhost:3000/integracoes?gmail=conectado");
      expect(banco.sinc_gmail_tokens).toEqual([expect.objectContaining({ user_id: USER_ID, refresh_token: "refresh-novo" })]);
      expect(banco.sinc_gmail).toEqual([expect.objectContaining({ user_id: USER_ID, email_sinc: "aluno@gmail.com" })]);
    });

    it.each([
      ["estado adulterado", `code=codigo-valido&state=${"x".repeat(10)}.${"y".repeat(43)}`, "erro"],
      ["código recusado pelo Google", "code=codigo-invalido&state=__ESTADO__", "erro"],
      ["usuário cancelou o consentimento", "error=access_denied&state=__ESTADO__", "cancelado"],
    ])("callback com %s não deve gravar nada", async (_caso, query, resultado) => {
      banco.sinc_gmail_tokens = [];
      const estado = assinarEstado(USER_ID, ENV.GOOGLE_CLIENT_SECRET);

      const resposta = await callback(new Request(`http://localhost:3000/api/gmail/callback?${query.replace("__ESTADO__", estado)}`));

      expect(resposta.headers.get("location")).toBe(`http://localhost:3000/integracoes?gmail=${resultado}`);
      expect(banco.sinc_gmail_tokens).toEqual([]);
    });

    it("conectar com ?origem=app deve marcar a origem no estado assinado", async () => {
      const resposta = await conectar(requisicao("http://localhost:3000/api/gmail/conectar?origem=app"));
      const url = new URL(((await resposta.json()) as { url: string }).url);

      expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/gmail/callback");
      expect(lerEstado(url.searchParams.get("state")!, ENV.GOOGLE_CLIENT_SECRET)).toEqual({ userId: USER_ID, origem: "app" });
    });

    it.each([
      ["sucesso", "code=codigo-valido", "conectado"],
      ["cancelamento", "error=access_denied", "cancelado"],
      ["código recusado", "code=codigo-invalido", "erro"],
    ])("callback de conexão iniciada no app deve voltar ao app em caso de %s", async (_caso, query, resultado) => {
      banco.sinc_gmail_tokens = [];
      banco.sinc_gmail = [];
      const estado = assinarEstado(USER_ID, ENV.GOOGLE_CLIENT_SECRET, Date.now(), "app");

      const resposta = await callback(new Request(`http://localhost:3000/api/gmail/callback?${query}&state=${estado}`));

      expect(resposta.headers.get("location")).toBe(`studyflow://integracoes?gmail=${resultado}`);
    });

    it("estado do app expirado deve voltar ao app com erro, e adulterado deve cair no site", async () => {
      banco.sinc_gmail_tokens = [];
      const expirado = assinarEstado(USER_ID, ENV.GOOGLE_CLIENT_SECRET, Date.now() - 11 * 60 * 1000, "app");
      const respostaExpirado = await callback(new Request(`http://localhost:3000/api/gmail/callback?code=codigo-valido&state=${expirado}`));
      expect(respostaExpirado.headers.get("location")).toBe("studyflow://integracoes?gmail=erro");

      const [dados, assinatura] = assinarEstado(USER_ID, ENV.GOOGLE_CLIENT_SECRET, Date.now(), "app").split(".");
      const adulterado = `${dados}.${assinatura.slice(0, -2)}xx`;
      const respostaAdulterado = await callback(new Request(`http://localhost:3000/api/gmail/callback?code=codigo-valido&state=${adulterado}`));
      expect(respostaAdulterado.headers.get("location")).toBe("http://localhost:3000/integracoes?gmail=erro");
      expect(banco.sinc_gmail_tokens).toEqual([]);
    });

    it("estado expirado ou assinado com outro segredo deve ser rejeitado", () => {
      const agora = Date.now();
      const estado = assinarEstado(USER_ID, ENV.GOOGLE_CLIENT_SECRET, agora);

      expect(verificarEstado(estado, ENV.GOOGLE_CLIENT_SECRET, agora + 11 * 60 * 1000)).toBeNull();
      expect(verificarEstado(estado, "outro-segredo", agora)).toBeNull();
      expect(verificarEstado(estado, ENV.GOOGLE_CLIENT_SECRET, agora + 60 * 1000)).toBe(USER_ID);
      // Assinatura com caracteres multibyte (mesmo número de caracteres, mais bytes) não deve lançar erro
      const [dados, assinatura] = estado.split(".");
      expect(verificarEstado(`${dados}.${"é".repeat(assinatura.length)}`, ENV.GOOGLE_CLIENT_SECRET, agora)).toBeNull();
    });
  });
});

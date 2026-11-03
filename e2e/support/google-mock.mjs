// Servidor falso do Google (OAuth + Gmail API) para os testes E2E do RF012.
// O Next aponta para ele via GOOGLE_OAUTH_URL, GOOGLE_TOKEN_URL e GOOGLE_API_BASE.
import http from "node:http";

const PORT = Number(process.env.GOOGLE_MOCK_PORT ?? 4010);

/** Data do e-mail falso: 5 dias à frente, em DD/MM/AAAA (horário de Brasília). */
function dataDaProva() {
  const data = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const [ano, mes, dia] = data.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).split("-");
  return `${dia}/${mes}/${ano}`;
}

const json = (res, status, corpo) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(corpo));
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    if (url.pathname === "/") return json(res, 200, { ok: true });

    // Consentimento: aprova na hora e volta para o callback com um código.
    if (url.pathname === "/auth") {
      const destino = new URL(url.searchParams.get("redirect_uri") ?? "");
      destino.searchParams.set("code", "codigo-e2e");
      destino.searchParams.set("state", url.searchParams.get("state") ?? "");
      res.writeHead(302, { Location: destino.toString() });
      return res.end();
    }

    if (url.pathname === "/token" && req.method === "POST") {
      let corpo = "";
      for await (const parte of req) corpo += parte;
      const form = new URLSearchParams(corpo);
      if (form.get("grant_type") === "refresh_token") return json(res, 200, { access_token: "access-e2e", expires_in: 3599 });
      if (form.get("code") === "codigo-e2e") {
        return json(res, 200, { access_token: "access-e2e", refresh_token: "refresh-e2e", expires_in: 3599 });
      }
      return json(res, 400, { error: "invalid_grant" });
    }

    if (url.pathname === "/gmail/v1/users/me/profile") return json(res, 200, { emailAddress: "aluno.e2e@gmail.com" });

    if (url.pathname === "/gmail/v1/users/me/messages") return json(res, 200, { messages: [{ id: "e2e-prova" }] });

    if (url.pathname === "/gmail/v1/users/me/messages/e2e-prova") {
      return json(res, 200, {
        id: "e2e-prova",
        snippet: "Conteúdo: casos de uso e diagramas UML",
        internalDate: String(Date.now()),
        payload: { headers: [{ name: "Subject", value: `Prova de Engenharia de Software dia ${dataDaProva()}` }] },
      });
    }

    json(res, 404, { error: "not_found" });
  })
  .listen(PORT, () => console.log(`[google-mock] ouvindo em http://localhost:${PORT}`));

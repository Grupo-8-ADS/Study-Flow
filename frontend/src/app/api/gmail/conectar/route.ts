import { NextResponse } from "next/server";
import { assinarEstado, lerConfigGmail, urlAutorizacao, usuarioDaRequisicao } from "@/lib/gmail-server";

/** RF012: devolve a URL de consentimento do Google para o usuário logado. */
export async function POST(request: Request) {
  const config = lerConfigGmail();
  if (!config) {
    return NextResponse.json({ code: "GMAIL_NAO_CONFIGURADO", message: "Integração com o Gmail não configurada no servidor" }, { status: 503 });
  }

  const userId = await usuarioDaRequisicao(request);
  if (!userId) {
    return NextResponse.json({ code: "AUTH_INVALID", message: "Token de autenticação ausente ou inválido" }, { status: 401 });
  }

  const redirectUri = new URL("/api/gmail/callback", request.url).toString();
  return NextResponse.json({ url: urlAutorizacao(config, redirectUri, assinarEstado(userId, config.clientSecret)) });
}

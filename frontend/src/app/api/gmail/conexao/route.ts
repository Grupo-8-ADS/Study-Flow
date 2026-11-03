import { NextResponse } from "next/server";
import { clienteServico, lerConfigGmail, usuarioDaRequisicao } from "@/lib/gmail-server";

/** RF012: desconecta o Gmail (apaga o token guardado). Os itens já importados continuam no cronograma. */
export async function DELETE(request: Request) {
  const config = lerConfigGmail();
  if (!config) {
    return NextResponse.json({ code: "GMAIL_NAO_CONFIGURADO", message: "Integração com o Gmail não configurada no servidor" }, { status: 503 });
  }

  const userId = await usuarioDaRequisicao(request);
  if (!userId) {
    return NextResponse.json({ code: "AUTH_INVALID", message: "Token de autenticação ausente ou inválido" }, { status: 401 });
  }

  const db = clienteServico(config);
  const [tokens, status] = await Promise.all([
    db.from("sinc_gmail_tokens").delete().eq("user_id", userId),
    db.from("sinc_gmail").delete().eq("user_id", userId),
  ]);
  if (tokens.error || status.error) {
    return NextResponse.json({ code: "ERRO_INTERNO", message: "Não foi possível desconectar o Gmail" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}

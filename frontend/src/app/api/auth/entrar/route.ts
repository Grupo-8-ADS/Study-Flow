import { NextResponse } from "next/server";
import { codigoDoErroAuth, type CodigoErroLogin } from "@studyflow/shared";
import { chaveSecreta, clienteServidor, ipDaRequisicao } from "@/lib/supabase-servidor";

const STATUS: Record<CodigoErroLogin, number> = {
  credenciais_invalidas: 401,
  email_nao_confirmado: 403,
  muitas_tentativas: 429,
  indisponivel: 503,
};

const SEM_CACHE = { "Cache-Control": "no-store" };

const recusar = (codigo: CodigoErroLogin, status = STATUS[codigo]) =>
  NextResponse.json({ codigo }, { status, headers: SEM_CACHE });

/**
 * Login por nome de usuário (web e mobile). O e-mail da conta é descoberto aqui, com a chave
 * secreta, e nunca volta para o cliente: quem não tem a senha não descobre o e-mail de
 * ninguém. Usuário inexistente e senha errada têm a mesma resposta.
 *
 * Corpo: { usuario, senha }. Sucesso: 200 { access_token, refresh_token }.
 * Erro: { codigo } com 400/401/403/429/503 (ver CodigoErroLogin em @studyflow/shared).
 */
export async function POST(request: Request) {
  const chave = chaveSecreta();
  if (!chave) return recusar("indisponivel");

  const corpo = (await request.json().catch(() => null)) as { usuario?: unknown; senha?: unknown } | null;
  const usuario = typeof corpo?.usuario === "string" ? corpo.usuario.trim() : "";
  const senha = typeof corpo?.senha === "string" ? corpo.senha : "";
  if (!usuario || !senha || usuario.length > 64 || senha.length > 256) {
    return recusar("credenciais_invalidas", 400);
  }

  const admin = clienteServidor(chave, { ipDoUsuario: ipDaRequisicao(request) });

  const { data: email, error: erroBusca } = await admin.rpc("get_email_by_username", { login_username: usuario });
  if (erroBusca) return recusar("indisponivel");
  if (typeof email !== "string" || !email) return recusar("credenciais_invalidas");

  const { data, error } = await admin.auth.signInWithPassword({ email, password: senha });
  if (error || !data.session) return recusar(codigoDoErroAuth(error));

  return NextResponse.json(
    { access_token: data.session.access_token, refresh_token: data.session.refresh_token },
    { headers: SEM_CACHE },
  );
}

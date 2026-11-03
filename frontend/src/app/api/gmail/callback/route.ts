import { NextResponse } from "next/server";
import { clienteServico, emailDaConta, lerConfigGmail, trocarCodigo, verificarEstado } from "@/lib/gmail-server";

/** RF012: retorno do consentimento do Google. Guarda o refresh token e volta para /integracoes. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const voltar = (resultado: string) => NextResponse.redirect(new URL(`/integracoes?gmail=${resultado}`, url.origin));

  const config = lerConfigGmail();
  if (!config) return voltar("nao-configurado");
  if (url.searchParams.get("error")) return voltar("cancelado");

  const code = url.searchParams.get("code");
  const userId = verificarEstado(url.searchParams.get("state") ?? "", config.clientSecret);
  if (!code || !userId) return voltar("erro");

  try {
    const redirectUri = new URL("/api/gmail/callback", url.origin).toString();
    const { accessToken, refreshToken } = await trocarCodigo(config, code, redirectUri);
    const email = await emailDaConta(config, accessToken);

    const db = clienteServico(config);
    const tokens = await db
      .from("sinc_gmail_tokens")
      .upsert({ user_id: userId, refresh_token: refreshToken, updated_at: new Date().toISOString() });
    if (tokens.error) throw tokens.error;

    const status = await db
      .from("sinc_gmail")
      .upsert({ user_id: userId, email_sinc: email, is_sincronizacao_auto: true }, { onConflict: "user_id" });
    if (status.error) throw status.error;

    return voltar("conectado");
  } catch (err: unknown) {
    console.error("[gmail/callback]", err instanceof Error ? err.message : err);
    return voltar("erro");
  }
}

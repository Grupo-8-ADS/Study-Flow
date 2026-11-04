import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { APP_RETORNO_GMAIL, type EmailResumo } from "@studyflow/shared";
import { supabase, SUPABASE_FALLBACK_URL } from "@/lib/supabase";

/**
 * RF012: integração com o Gmail (somente no servidor).
 * O refresh token fica em public.sinc_gmail_tokens, tabela sem policies que só o
 * service role acessa. As URLs do Google são configuráveis para os testes.
 */

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const ESTADO_VALIDADE_MS = 10 * 60 * 1000;

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  serviceRoleKey: string;
  supabaseUrl: string;
  authUrl: string;
  tokenUrl: string;
  apiBase: string;
}

/** Configuração a partir do ambiente; null se a integração não estiver configurada. */
export function lerConfigGmail(env: NodeJS.ProcessEnv = process.env): GmailConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clientId || !clientSecret || !serviceRoleKey) return null;
  return {
    clientId,
    clientSecret,
    serviceRoleKey,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_FALLBACK_URL,
    authUrl: env.GOOGLE_OAUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token",
    apiBase: (env.GOOGLE_API_BASE || "https://gmail.googleapis.com").replace(/\/$/, ""),
  };
}

/** Cliente com service role: ignora RLS, então TODA consulta deve filtrar por user_id. */
export function clienteServico(config: GmailConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Valida o JWT do Supabase enviado no header Authorization e devolve o id do usuário. */
export async function usuarioDaRequisicao(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    return error || !data.user ? null : data.user.id;
  } catch {
    return null;
  }
}

const assinatura = (dados: string, segredo: string) =>
  createHmac("sha256", segredo).update(dados).digest("base64url");

/** De onde a conexão foi iniciada: o site (padrão) ou o app mobile. */
export type OrigemConexao = "web" | "app";

export { APP_RETORNO_GMAIL };

/**
 * Estado do OAuth: amarra o callback ao usuário que iniciou a conexão, com validade curta.
 * A origem vai dentro do estado assinado, então não pode ser trocada por quem intercepta o link.
 */
export function assinarEstado(userId: string, segredo: string, agora = Date.now(), origem: OrigemConexao = "web"): string {
  const conteudo = origem === "app" ? { u: userId, e: agora + ESTADO_VALIDADE_MS, o: "app" } : { u: userId, e: agora + ESTADO_VALIDADE_MS };
  const dados = Buffer.from(JSON.stringify(conteudo)).toString("base64url");
  return `${dados}.${assinatura(dados, segredo)}`;
}

export function verificarEstado(estado: string, segredo: string, agora = Date.now()): string | null {
  return lerEstado(estado, segredo, agora)?.userId ?? null;
}

/**
 * Valida a assinatura do estado e devolve o usuário e a origem da conexão.
 * Retorna null se a assinatura for inválida. Se o estado estiver expirado, `userId` vem null,
 * mas a origem (assinada) continua valendo, para devolver ao app quem demorou no consentimento.
 */
export function lerEstado(
  estado: string,
  segredo: string,
  agora = Date.now(),
): { userId: string | null; origem: OrigemConexao } | null {
  const [dados, recebida] = estado.split(".");
  if (!dados || !recebida) return null;
  const recebidaBytes = Buffer.from(recebida);
  const esperadaBytes = Buffer.from(assinatura(dados, segredo));
  if (recebidaBytes.length !== esperadaBytes.length || !timingSafeEqual(recebidaBytes, esperadaBytes)) {
    return null;
  }
  try {
    const { u, e, o } = JSON.parse(Buffer.from(dados, "base64url").toString("utf8")) as { u?: string; e?: number; o?: string };
    if (typeof u !== "string" || typeof e !== "number") return null;
    return { userId: e > agora ? u : null, origem: o === "app" ? "app" : "web" };
  } catch {
    return null;
  }
}

export function urlAutorizacao(config: GmailConfig, redirectUri: string, estado: string): string {
  const url = new URL(config.authUrl);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: estado,
  }).toString();
  return url.toString();
}

async function postToken(config: GmailConfig, campos: Record<string, string>) {
  const resposta = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...campos }),
  });
  const corpo = (await resposta.json().catch(() => ({}))) as Record<string, unknown>;
  if (!resposta.ok || typeof corpo.access_token !== "string") {
    throw new GmailErro(`Falha ao obter token do Google (${resposta.status})`, resposta.status === 400 ? "TOKEN_INVALIDO" : "GOOGLE_INDISPONIVEL");
  }
  return corpo as { access_token: string; refresh_token?: string };
}

export class GmailErro extends Error {
  constructor(message: string, readonly codigo: "TOKEN_INVALIDO" | "GOOGLE_INDISPONIVEL" | "SEM_REFRESH_TOKEN") {
    super(message);
  }
}

export async function trocarCodigo(config: GmailConfig, code: string, redirectUri: string) {
  const tokens = await postToken(config, { code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!tokens.refresh_token) {
    throw new GmailErro("O Google não devolveu um refresh token", "SEM_REFRESH_TOKEN");
  }
  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token };
}

export async function renovarAcesso(config: GmailConfig, refreshToken: string): Promise<string> {
  const tokens = await postToken(config, { refresh_token: refreshToken, grant_type: "refresh_token" });
  return tokens.access_token;
}

async function getGmail<T>(config: GmailConfig, accessToken: string, caminho: string): Promise<T> {
  const resposta = await fetch(`${config.apiBase}/gmail/v1/users/me/${caminho}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resposta.ok) {
    throw new GmailErro(`Falha na API do Gmail (${resposta.status})`, resposta.status === 401 ? "TOKEN_INVALIDO" : "GOOGLE_INDISPONIVEL");
  }
  return (await resposta.json()) as T;
}

export async function emailDaConta(config: GmailConfig, accessToken: string): Promise<string | null> {
  const perfil = await getGmail<{ emailAddress?: string }>(config, accessToken, "profile");
  return perfil.emailAddress ?? null;
}

interface MensagemGmail {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: Array<{ name: string; value: string }> };
}

/** Busca até `limite` e-mails da consulta e devolve assunto, trecho e data de cada um. */
/**
 * Lista as mensagens da busca, página a página, até `limite`.
 * `completo` é false quando sobraram mensagens além do limite.
 */
export async function buscarEmails(
  config: GmailConfig,
  accessToken: string,
  consulta: string,
  limite = 100,
): Promise<{ emails: EmailResumo[]; completo: boolean }> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q: consulta, maxResults: String(Math.min(limite - ids.length, 100)) });
    if (pageToken) params.set("pageToken", pageToken);
    const lista = await getGmail<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(config, accessToken, `messages?${params}`);
    ids.push(...(lista.messages ?? []).map((m) => m.id));
    pageToken = lista.nextPageToken;
  } while (pageToken && ids.length < limite);

  const mensagens = await Promise.all(
    ids.map((id) =>
      getGmail<MensagemGmail>(config, accessToken, `messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=Subject`),
    ),
  );

  const emails = mensagens.map((m) => ({
    id: m.id,
    assunto: m.payload?.headers?.find((h) => h.name.toLowerCase() === "subject")?.value ?? "",
    trecho: m.snippet ?? null,
    recebidoEm: new Date(Number(m.internalDate) || Date.now()),
  }));
  return { emails, completo: !pageToken };
}

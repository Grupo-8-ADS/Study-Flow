import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_FALLBACK_URL } from "@/lib/supabase";

/** Chave secreta do Supabase (sb_secret_…). Só existe no servidor; null se não configurada. */
export function chaveSecreta(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.SUPABASE_SERVICE_ROLE_KEY || null;
}

/**
 * Cliente com a chave secreta: ignora RLS, então TODA consulta deve filtrar pelo usuário.
 *
 * `ipDoUsuario` vai no header Sb-Forwarded-For para o rate limit do Supabase Auth contar o
 * IP de quem está entrando, e não o do servidor. Exige chave sb_secret_ e a opção
 * "IP Address Forwarding" ligada em Authentication > Rate Limits; sem ela o header é ignorado.
 */
export function clienteServidor(
  chave: string,
  { url = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_FALLBACK_URL, ipDoUsuario }: { url?: string; ipDoUsuario?: string | null } = {},
): SupabaseClient {
  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: ipDoUsuario ? { headers: { "sb-forwarded-for": ipDoUsuario } } : undefined,
  });
}

/** IP de quem fez a requisição, como a Vercel informa (x-real-ip ou o primeiro do x-forwarded-for). */
export function ipDaRequisicao(request: Request): string | null {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const primeiro = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return primeiro || null;
}

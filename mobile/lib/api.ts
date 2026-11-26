import { ROTA_ENTRAR_POR_USUARIO, type EntrarPorUsuario } from '@studyflow/shared';
import { supabase } from './supabase';

/** Site do Study Flow: as rotas /api/* (login por usuário, Gmail) rodam lá. */
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://study-flow-ten-olive.vercel.app';

export type RespostaApi = { ok: boolean; status: number; corpo: Record<string, unknown> };

async function lerCorpo(resposta: Response): Promise<Record<string, unknown>> {
  if (resposta.status === 204) return {};
  const corpo = await resposta.json().catch(() => ({}));
  return corpo && typeof corpo === 'object' ? (corpo as Record<string, unknown>) : {};
}

/** Chama uma rota do site autenticada com o token da sessão do Supabase (as rotas aceitam Bearer). */
export async function chamarApi(caminho: string, metodo: 'POST' | 'DELETE'): Promise<RespostaApi> {
  const { data } = await supabase.auth.getSession();
  const resposta = await fetch(`${SITE_URL}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
  });
  return { ok: resposta.ok, status: resposta.status, corpo: await lerCorpo(resposta) };
}

/** Login por nome de usuário pela rota do site (o e-mail da conta não sai do servidor). */
export const entrarPorUsuario: EntrarPorUsuario = async (usuario, senha) => {
  const resposta = await fetch(`${SITE_URL}${ROTA_ENTRAR_POR_USUARIO}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, senha }),
  });
  return { status: resposta.status, corpo: await lerCorpo(resposta) };
};

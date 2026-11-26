/**
 * Perfil do usuário logado no site, lido uma vez e compartilhado pelo menu, pelo painel e
 * pelas telas de perfil, recompensas, estatísticas e configurações.
 * @packageDocumentation
 */

import { supabase } from "@/lib/supabase";
import { getCurrentSupabaseUserId, getStoredSession, salvarSessaoLocal } from "@/lib/studyflow-data";
import { CHAVES, SemSessaoError, alterarConsulta, useConsulta } from "@/lib/consultas";

export type PerfilUsuario = {
  id: string;
  nome: string;
  username: string;
  email: string;
  avatar_url: string | null;
  banner_url: string | null;
  moldura: string | null;
  nivel_atual: number;
  xp: number;
  last_achievement: string | null;
  bg_color: string | null;
  horas_diarias: number | null;
  recebe_notificacao_pref: boolean | null;
};

const CHAVE_PERFIL = CHAVES.perfil;

const COLUNAS =
  "id,nome,username,email,avatar_url,banner_url,moldura,nivel_atual,xp,last_achievement,bg_color,horas_diarias,recebe_notificacao_pref";

export async function carregarPerfil(): Promise<PerfilUsuario> {
  const id = await getCurrentSupabaseUserId();
  if (!id) throw new SemSessaoError();
  const { data, error } = await supabase.from("profiles").select(COLUNAS).eq("id", id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar o seu perfil.");
  if (!data) throw new Error("Perfil não encontrado.");
  return { ...data, nivel_atual: data.nivel_atual ?? 1, xp: data.xp ?? 0 } as PerfilUsuario;
}

/** Perfil com cache entre páginas. */
export const usePerfil = () => useConsulta(CHAVE_PERFIL, carregarPerfil);

/**
 * Reflete uma gravação no cache (o menu e as outras telas mudam na hora) e mantém o nome e o
 * usuário da sessão local em dia. Imagens não vão para o localStorage: podem ter centenas de KB.
 */
export function atualizarPerfilEmCache(alteracao: Partial<PerfilUsuario>) {
  alterarConsulta<PerfilUsuario>(CHAVE_PERFIL, (atual) => ({ ...atual, ...alteracao }));
  const sessao = getStoredSession();
  if (sessao && (alteracao.nome !== undefined || alteracao.username !== undefined)) {
    salvarSessaoLocal({ ...sessao, nome: alteracao.nome ?? sessao.nome, username: alteracao.username ?? sessao.username });
  }
}

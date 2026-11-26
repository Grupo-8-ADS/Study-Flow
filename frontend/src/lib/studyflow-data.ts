import { supabase } from "@/lib/supabase";

/**
 * Sessão guardada no navegador após o login: só o que identifica a conta. Foto, banner,
 * nível e o resto do perfil vêm do banco pelo `usePerfil`.
 */
export type StudyFlowSession = {
  email: string;
  nome: string;
  username: string;
};

const CHAVE_SESSAO = "studyflow_session";
/** Campos que versões antigas guardavam na sessão (imagens de centenas de KB). */
const CAMPOS_ANTIGOS = ["avatar_url", "banner_url", "moldura"] as const;

export function getStoredSession(): StudyFlowSession | null {
  const storedSession = localStorage.getItem(CHAVE_SESSAO);
  if (!storedSession) return null;

  return JSON.parse(storedSession) as StudyFlowSession;
}

/** Grava a sessão local sem as imagens que versões antigas guardavam nela. */
export function salvarSessaoLocal(sessao: StudyFlowSession & Record<string, unknown>) {
  const limpa: Record<string, unknown> = { ...sessao };
  for (const campo of CAMPOS_ANTIGOS) delete limpa[campo];
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(limpa));
}

/** Tira da sessão local as imagens gravadas por versões antigas (lida em toda troca de tela). */
export function enxugarSessaoLocal() {
  const sessao = getStoredSession() as (StudyFlowSession & Record<string, unknown>) | null;
  if (sessao && CAMPOS_ANTIGOS.some((campo) => campo in sessao)) salvarSessaoLocal(sessao);
}

/**
 * Id do usuário logado no Supabase. Lê a sessão já guardada no navegador (sem ida ao
 * servidor de autenticação a cada troca de tela); o token continua sendo validado pelo
 * banco (RLS) em cada consulta.
 */
export async function getCurrentSupabaseUserId(session?: StudyFlowSession) {
  void session;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

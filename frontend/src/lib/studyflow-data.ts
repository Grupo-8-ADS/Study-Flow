import { supabase } from "@/lib/supabase";

export type StudyFlowSession = {
  email: string;
  nome: string;
  username: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  moldura?: string | null;
};

export function getStoredSession(): StudyFlowSession | null {
  const storedSession = localStorage.getItem("studyflow_session");
  if (!storedSession) return null;

  return JSON.parse(storedSession) as StudyFlowSession;
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

export function getLocalStudyMinutes(email: string) {
  const storedActivity = localStorage.getItem(`studyflow_activity_${email}`);
  if (!storedActivity) return 0;

  const parsedActivity = JSON.parse(storedActivity) as Array<{ type?: string }>;
  return parsedActivity.filter((activity) => activity.type === "foco").length * 25;
}


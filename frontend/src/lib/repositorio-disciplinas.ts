import { createClient } from "@supabase/supabase-js";
import type { CreateDisciplinaInput } from "@studyflow/shared";
import { SUPABASE_FALLBACK_KEY, SUPABASE_FALLBACK_URL, supabase } from "@/lib/supabase";

/** Colunas que a API expõe: exatamente o contrato de DisciplinaOutputSchema. */
export const COLUNAS_DISCIPLINA = "id,user_id,nome,professor,data_inicio,data_fim,anotacoes,created_at,updated_at";

/** Acesso às disciplinas de UM usuário autenticado. */
export interface RepositorioDisciplinas {
  /** Disciplinas do usuário, em ordem alfabética. */
  listar(): Promise<unknown[]>;
  /** Se o usuário já tem uma disciplina com este nome (sem diferenciar maiúsculas). */
  existeComNome(nome: string): Promise<boolean>;
  /** Grava a disciplina e devolve a linha criada. */
  criar(dados: CreateDisciplinaInput): Promise<unknown>;
}

export type AcessoDisciplinas = { userId: string; disciplinas: RepositorioDisciplinas };

/**
 * Regra de nome repetido: igual ignorando maiúsculas e espaços nas pontas. Comparada aqui, e não
 * com `ilike` no banco, porque o PostgREST trata `*` como curinga e "C*" casaria com "Cálculo".
 */
export const mesmoNome = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("pt-BR") === b.trim().toLocaleLowerCase("pt-BR");

/**
 * Valida o access token no Supabase Auth e devolve o acesso às disciplinas do dono dele, ou
 * null se o token for inválido ou estiver expirado. As consultas usam o JWT do próprio usuário,
 * então o RLS do banco garante que ninguém lê nem grava disciplinas de outra pessoa.
 */
export async function acessoDoToken(token: string): Promise<AcessoDisciplinas | null> {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const userId = data.user.id;

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_FALLBACK_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_FALLBACK_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  return {
    userId,
    disciplinas: {
      async listar() {
        const { data, error } = await db.from("disciplinas").select(COLUNAS_DISCIPLINA).eq("user_id", userId).order("nome");
        if (error) throw error;
        return data ?? [];
      },
      async existeComNome(nome) {
        const { data, error } = await db.from("disciplinas").select("nome").eq("user_id", userId);
        if (error) throw error;
        return (data ?? []).some((linha) => mesmoNome(linha.nome as string, nome));
      },
      async criar(dados) {
        const { data, error } = await db
          .from("disciplinas")
          .insert({ ...dados, user_id: userId })
          .select(COLUNAS_DISCIPLINA)
          .single();
        if (error) throw error;
        return data;
      },
    },
  };
}

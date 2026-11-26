import type { SupabaseClient } from '@supabase/supabase-js';

type Erro = { code?: string; message: string };

/**
 * Supabase falso só com a tabela profiles: select(...).eq('id').maybeSingle() e
 * update(...).eq('id'). `falhar` simula erro em uma operação ("select" ou "update").
 */
export function perfilFalso(inicial: Record<string, unknown> | null, falhar: Partial<Record<'select' | 'update', Erro>> = {}) {
  const linha = inicial ? { id: 'u1', ...inicial } : null;
  const updates: Record<string, unknown>[] = [];

  const client = {
    from(tabela: string) {
      if (tabela !== 'profiles') throw new Error(`tabela inesperada: ${tabela}`);
      return {
        select: () => ({
          eq: (_c: string, id: string) => ({
            maybeSingle: async () =>
              falhar.select ? { data: null, error: falhar.select } : { data: linha && linha.id === id ? { ...linha } : null, error: null },
          }),
        }),
        update: (valores: Record<string, unknown>) => ({
          eq: async (_c: string, id: string) => {
            if (falhar.update) return { data: null, error: falhar.update };
            updates.push(valores);
            if (linha && linha.id === id) Object.assign(linha, valores);
            return { data: null, error: null };
          },
        }),
      };
    },
  } as unknown as SupabaseClient;

  return { client, updates, linha };
}

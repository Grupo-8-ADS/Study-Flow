/**
 * Agenda no app: a mesma store compartilhada do site (`@studyflow/shared`), ligada ao
 * cliente Supabase do app, com cache em memória entre as telas.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { criarAgenda } from '@studyflow/shared';
import { supabase } from './supabase';
import { Storage } from './storage';

const agenda = criarAgenda({
  client: supabase,
  obterUserId: async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  },
  temSessao: async () => Boolean((await supabase.auth.getSession()).data.session) || Boolean(await Storage.getSession()),
  chaveLocal: async () => `studyflow_agenda_${(await Storage.getSession())?.email ?? 'anon'}`,
  storage: {
    get: (k) => AsyncStorage.getItem(k),
    set: (k, v) => AsyncStorage.setItem(k, v),
  },
});

export const {
  recarregarAgenda,
  limparAgenda,
  salvarCompromisso,
  excluirCompromisso,
  alternarConcluido,
  salvarDisciplina,
  excluirDisciplina,
  salvarBlocosCronograma,
} = agenda;

/** Dados da agenda: devolve o cache na hora e atualiza em segundo plano ao montar a tela. */
export function useAgenda() {
  const atual = useSyncExternalStore(agenda.assinar, agenda.obterEstado, agenda.obterEstado);

  useEffect(() => {
    void agenda.recarregarAgenda();
  }, []);

  const recarregar = useCallback(() => agenda.recarregarAgenda(), []);

  return {
    dados: atual.dados,
    carregando: atual.carregando && !atual.dados,
    atualizando: atual.carregando,
    erro: atual.erro,
    recarregar,
  };
}

/** Cores por tipo (as mesmas famílias do site). */
export const COR_TIPO = {
  prova: { cor: '#c2362f', fundo: '#fdecea', badge: 'danger' },
  trabalho: { cor: '#b57d0b', fundo: '#fff4d6', badge: 'warning' },
  atividade: { cor: '#29645e', fundo: '#e3f3f0', badge: 'primary' },
  estudo: { cor: '#0f8a5f', fundo: '#e7f6ef', badge: 'success' },
  aula: { cor: '#8a9996', fundo: '#f1f5f4', badge: 'gray' },
} as const;

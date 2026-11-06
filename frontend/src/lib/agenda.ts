/**
 * Agenda no web: instância da store compartilhada (`@studyflow/shared/agenda`) ligada ao
 * cliente Supabase do navegador, mais o hook `useAgenda` com cache entre as páginas.
 * @packageDocumentation
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { criarAgenda } from "@studyflow/shared";
import { supabase } from "@/lib/supabase";
import { getCurrentSupabaseUserId, getStoredSession } from "@/lib/studyflow-data";

export {
  ROTULO_TIPO,
  TIPOS_COMPROMISSO,
  aulasNoPeriodo,
  compromissoVazio,
  dataLocal,
  dataStr,
  formatarData,
  formatarHorario,
  hojeStr,
  horaStr,
  intervaloDe,
  ordenarCompromissos,
  proximasProvas,
  validarCompromisso,
} from "@studyflow/shared";
export type {
  AgendaDados,
  Aula,
  Compromisso,
  CompromissoForm,
  DisciplinaAgenda as Disciplina,
  DisciplinaForm,
  TipoCompromisso,
} from "@studyflow/shared";

const agenda = criarAgenda({
  client: supabase,
  obterUserId: () => getCurrentSupabaseUserId(),
  temSessao: () => Boolean(getStoredSession()),
  chaveLocal: () => `studyflow_agenda_${getStoredSession()?.email ?? "anon"}`,
  storage: {
    get: (k) => localStorage.getItem(k),
    set: (k, v) => localStorage.setItem(k, v),
  },
});

// Saiu da conta ou entrou outra pessoa (em qualquer tela ou aba): descarta o cache.
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((evento, sessao) => {
    const atual = agenda.obterEstado().userId;
    if (evento === "SIGNED_OUT" || (sessao?.user?.id && atual && sessao.user.id !== atual)) agenda.limparAgenda();
  });
}

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

const lerServidor = () => agenda.obterEstado();

/**
 * Dados da Agenda com cache entre páginas: devolve o que já está em memória na hora
 * e atualiza em segundo plano ao montar.
 */
export function useAgenda() {
  const atual = useSyncExternalStore(agenda.assinar, agenda.obterEstado, lerServidor);

  useEffect(() => {
    void agenda.recarregarAgenda();
  }, []);

  const recarregar = useCallback(() => agenda.recarregarAgenda(), []);

  return {
    dados: atual.dados,
    carregando: atual.carregando && !atual.dados,
    atualizando: atual.carregando,
    erro: atual.erro,
    local: atual.local,
    recarregar,
  };
}

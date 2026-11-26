/**
 * Cache das consultas do site entre as páginas (o mesmo modelo do `useAgenda`): ao voltar a
 * uma tela, ela aparece na hora com o que já está em memória e se atualiza em segundo plano.
 * Na primeira visita, `carregando` fica verdadeiro até chegar o dado real, para a página
 * mostrar o esqueleto em vez de valores inventados.
 * @packageDocumentation
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";

type Estado<T> = {
  dados: T | undefined;
  erro: string | null;
  /** Há uma busca em andamento (inclusive a revalidação de um dado já em cache). */
  buscando: boolean;
  /** Quando o dado chegou (ms); 0 = precisa buscar de novo. */
  atualizadoEm: number;
};

type Carregador<T> = () => Promise<T>;

/** Chaves das consultas em cache, para as telas que precisam invalidar umas às outras. */
export const CHAVES = {
  perfil: "perfil",
  conquistas: "conquistas",
  estatisticas: "estatisticas",
  resumoEstudo: "resumo-estudo",
} as const;

const VAZIO: Estado<never> = { dados: undefined, erro: null, buscando: false, atualizadoEm: 0 };

const estados = new Map<string, Estado<unknown>>();
const emAndamento = new Map<string, Promise<void>>();
const carregadores = new Map<string, Carregador<unknown>>();
const ouvintes = new Set<() => void>();
/** Muda quando o cache é limpo: respostas pedidas antes disso (outro usuário) são descartadas. */
let geracao = 0;

/** Erro de quem não tem mais sessão no Supabase: o shell manda de volta para o login. */
export class SemSessaoError extends Error {
  constructor() {
    super("Sua sessão expirou. Entre de novo.");
    this.name = "SemSessaoError";
  }
}

export const MENSAGEM_SEM_SESSAO = new SemSessaoError().message;

function avisar() {
  for (const ouvinte of ouvintes) ouvinte();
}

function definir(chave: string, estado: Estado<unknown>) {
  estados.set(chave, estado);
  avisar();
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Estado atual de uma consulta (o mesmo que o hook lê). */
export const estadoConsulta = <T>(chave: string) => (estados.get(chave) ?? VAZIO) as Estado<T>;

const mensagemDe = (erro: unknown) => (erro instanceof Error && erro.message ? erro.message : "Não foi possível carregar os dados.");

/** Busca (ou reaproveita a busca em andamento) e guarda o resultado no cache. */
export function buscarConsulta<T>(chave: string, carregar: Carregador<T>): Promise<void> {
  carregadores.set(chave, carregar as Carregador<unknown>);
  const andamento = emAndamento.get(chave);
  if (andamento) return andamento;

  const minhaGeracao = geracao;
  definir(chave, { ...(estados.get(chave) ?? VAZIO), buscando: true });

  const promessa = carregar()
    .then(
      (dados) => {
        if (minhaGeracao === geracao) definir(chave, { dados, erro: null, buscando: false, atualizadoEm: Date.now() });
      },
      (erro: unknown) => {
        if (minhaGeracao === geracao) definir(chave, { ...(estados.get(chave) ?? VAZIO), erro: mensagemDe(erro), buscando: false });
      },
    )
    .finally(() => {
      if (emAndamento.get(chave) === promessa) emAndamento.delete(chave);
    });
  emAndamento.set(chave, promessa);
  return promessa;
}

/**
 * Dado com cache entre páginas. `carregar` precisa ser uma função estável (declarada fora do
 * componente). O dado em cache vale por `validadeMs`; depois disso a tela o mostra e busca de novo.
 */
export function useConsulta<T>(chave: string, carregar: Carregador<T>, { validadeMs = 30_000 }: { validadeMs?: number } = {}) {
  const estado = useSyncExternalStore(
    assinar,
    () => estadoConsulta<T>(chave),
    () => VAZIO as Estado<T>,
  );

  useEffect(() => {
    const atual = estados.get(chave);
    if (!atual || atual.dados === undefined || Date.now() - atual.atualizadoEm > validadeMs) void buscarConsulta(chave, carregar);
  }, [chave, carregar, validadeMs]);

  const recarregar = useCallback(() => buscarConsulta(chave, carregar), [chave, carregar]);

  return {
    dados: estado.dados,
    erro: estado.erro,
    /** Ainda não há dado para mostrar (primeira carga). */
    carregando: estado.dados === undefined && !estado.erro,
    atualizando: estado.buscando,
    recarregar,
  };
}

/** Atualiza o dado em cache depois de uma gravação feita pela própria tela. */
export function alterarConsulta<T>(chave: string, alterar: (atual: T) => T) {
  const atual = estados.get(chave);
  if (atual?.dados === undefined) return;
  definir(chave, { ...atual, dados: alterar(atual.dados as T) });
}

/** O dado mudou no banco (ex.: sessão concluída rende XP): busca de novo o que já foi carregado. */
export function invalidarConsultas(...chaves: string[]) {
  for (const chave of chaves) {
    const atual = estados.get(chave);
    if (!atual) continue;
    definir(chave, { ...atual, atualizadoEm: 0 });
    const carregar = carregadores.get(chave);
    if (carregar) void buscarConsulta(chave, carregar);
  }
}

/** Uma sessão de foco concluída muda XP, nível, conquistas e estatísticas (o banco credita no trigger). */
export const invalidarAposSessao = () =>
  invalidarConsultas(CHAVES.perfil, CHAVES.conquistas, CHAVES.estatisticas, CHAVES.resumoEstudo);

/** Esquece tudo (saída da conta ou troca de usuário). */
export function limparConsultas() {
  geracao += 1;
  estados.clear();
  emAndamento.clear();
  avisar();
}

// Saiu da conta ou entrou outra pessoa (em qualquer tela ou aba): o cache não serve mais.
if (typeof window !== "undefined") {
  let usuarioAtual: string | null = null;
  supabase.auth.onAuthStateChange((evento, sessao) => {
    const id = sessao?.user?.id ?? null;
    if (evento === "SIGNED_OUT" || (usuarioAtual && id && id !== usuarioAtual)) limparConsultas();
    usuarioAtual = id;
  });
}

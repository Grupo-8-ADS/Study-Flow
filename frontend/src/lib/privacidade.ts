/**
 * Privacidade no site: lê e grava profiles.privacidade (regras em `@studyflow/shared`) e
 * migra, uma única vez, o valor que versões antigas guardavam no localStorage.
 * @packageDocumentation
 */

import {
  PRIVACIDADE_PADRAO,
  carregarPrivacidade,
  privacidadeLegada,
  resolverPrivacidadeLegada,
  salvarPrivacidade,
  type Privacidade,
  type PrivacidadePerfil,
} from "@studyflow/shared";
import { supabase } from "@/lib/supabase";

/** Chave usada antes de a privacidade ir para o banco. */
const chaveLegada = (email: string) => `studyflow_privacy_${email}`;

function lerLegada(email: string): Privacidade | null {
  try {
    return privacidadeLegada(localStorage.getItem(chaveLegada(email)));
  } catch {
    return null;
  }
}

function apagarLegada(email: string) {
  try {
    localStorage.removeItem(chaveLegada(email));
  } catch {
    // Sem acesso ao armazenamento: nada a limpar.
  }
}

/**
 * Preferências do usuário logado, com `carregada: false` quando não deu para lê-las (sem
 * usuário no Supabase, rede, coluna ausente): a tela então trata tudo como privado e não grava.
 * Se o perfil nunca teve privacidade e há um valor antigo neste navegador, ele é gravado no banco.
 */
export async function carregarPrivacidadeUsuario(userId: string | null, email: string): Promise<Pick<PrivacidadePerfil, "privacidade" | "carregada">> {
  if (!userId) return { privacidade: { ...PRIVACIDADE_PADRAO }, carregada: false };
  const perfil = await carregarPrivacidade(supabase, userId);
  if (!perfil.carregada) return { privacidade: perfil.privacidade, carregada: false };
  const legada = lerLegada(email);
  const { privacidade, gravar } = resolverPrivacidadeLegada(perfil, legada);
  if (gravar) {
    if (!(await salvarPrivacidade(supabase, userId, privacidade))) apagarLegada(email);
  } else if (legada && perfil.configurada) {
    // O banco já tem a escolha do usuário: o valor antigo deste navegador não vale mais.
    apagarLegada(email);
  }
  return { privacidade, carregada: true };
}

/** Grava as preferências; devolve a mensagem de erro ou null. */
export async function gravarPrivacidadeUsuario(userId: string | null, privacidade: Privacidade): Promise<string | null> {
  if (!userId) return "Entre na sua conta para salvar a privacidade.";
  return salvarPrivacidade(supabase, userId, privacidade);
}

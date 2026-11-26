/**
 * Preferências de privacidade do perfil (Configurações › Privacidade), gravadas em
 * profiles.privacidade (jsonb) e usadas igualmente no site e no app. O formato precisa
 * bater com a constraint profiles_privacidade_valida (migration 20261126000100_privacidade_perfil).
 * @packageDocumentation
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface Privacidade {
  /** Habilita os botões de compartilhar progresso. */
  permitir_compartilhar: boolean;
  /** Outras pessoas podem ver o perfil. */
  perfil_publico: boolean;
  /** Mostra o total de horas estudadas (inclusive no texto compartilhado). */
  mostrar_horas: boolean;
  /** Mostra as conquistas e a evolução de nível. */
  mostrar_conquistas: boolean;
}

export type ChavePrivacidade = keyof Privacidade;

export const PRIVACIDADE_PADRAO: Readonly<Privacidade> = Object.freeze({
  permitir_compartilhar: true,
  perfil_publico: false,
  mostrar_horas: true,
  mostrar_conquistas: true,
});

/** Opções na ordem e com os textos exibidos nas duas plataformas. */
export const OPCOES_PRIVACIDADE: ReadonlyArray<{ chave: ChavePrivacidade; titulo: string; descricao: string }> = [
  { chave: 'perfil_publico', titulo: 'Perfil público', descricao: 'Permitir que outras pessoas visualizem seu perfil.' },
  { chave: 'mostrar_horas', titulo: 'Mostrar horas estudadas', descricao: 'Mostrar o total de horas nos seus resumos e no texto compartilhado.' },
  { chave: 'mostrar_conquistas', titulo: 'Mostrar conquistas', descricao: 'Exibir suas conquistas e evolução de nível.' },
  { chave: 'permitir_compartilhar', titulo: 'Permitir compartilhamentos', descricao: 'Habilitar os botões para compartilhar seu progresso.' },
];

const CHAVES = Object.keys(PRIVACIDADE_PADRAO) as ChavePrivacidade[];

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Valor de profiles.privacidade (ou qualquer coisa malformada) → preferências completas. */
export function normalizarPrivacidade(valor: unknown): Privacidade {
  const resultado: Privacidade = { ...PRIVACIDADE_PADRAO };
  if (!ehObjeto(valor)) return resultado;
  for (const chave of CHAVES) {
    if (typeof valor[chave] === 'boolean') resultado[chave] = valor[chave] as boolean;
  }
  return resultado;
}

/** Nomes usados no localStorage do site antes de a privacidade ir para o banco. */
const CHAVES_LEGADAS: Record<string, ChavePrivacidade> = {
  allowSharing: 'permitir_compartilhar',
  publicProfile: 'perfil_publico',
  showStudyHours: 'mostrar_horas',
  showAchievements: 'mostrar_conquistas',
};

/**
 * Converte o JSON antigo do localStorage do site (`studyflow_privacy_<email>`) para o
 * formato do banco. Devolve null se não houver nada aproveitável.
 */
export function privacidadeLegada(json: string | null | undefined): Privacidade | null {
  if (!json) return null;
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return null;
  }
  if (!ehObjeto(bruto)) return null;
  const convertido: Partial<Privacidade> = {};
  for (const [antiga, nova] of Object.entries(CHAVES_LEGADAS)) {
    if (typeof bruto[antiga] === 'boolean') convertido[nova] = bruto[antiga] as boolean;
  }
  return Object.keys(convertido).length > 0 ? normalizarPrivacidade(convertido) : null;
}

/** Preferências com uma opção invertida (o que os interruptores fazem). */
export const alternarPrivacidade = (atual: Privacidade, chave: ChavePrivacidade): Privacidade => ({ ...atual, [chave]: !atual[chave] });

/**
 * Preferências lidas do perfil. `carregada` = a leitura deu certo; `configurada` = a coluna
 * já foi gravada alguma vez (null no banco = nunca configurada, valem os padrões).
 */
export interface PrivacidadePerfil {
  privacidade: Privacidade;
  carregada: boolean;
  configurada: boolean;
}

/** Lê profiles.privacidade do usuário. Em falha de rede, devolve os padrões com `carregada: false`. */
export async function carregarPrivacidade(client: SupabaseClient, userId: string): Promise<PrivacidadePerfil> {
  const { data, error } = await client.from('profiles').select('privacidade').eq('id', userId).maybeSingle();
  if (error || !data) return { privacidade: { ...PRIVACIDADE_PADRAO }, carregada: false, configurada: false };
  const bruto = (data as { privacidade?: unknown }).privacidade;
  return { privacidade: normalizarPrivacidade(bruto), carregada: true, configurada: bruto !== null && bruto !== undefined };
}

/**
 * Decide o que vale quando há preferências antigas no localStorage do site: elas só
 * entram (e devem ser gravadas no banco) se o perfil foi lido e nunca teve privacidade
 * configurada — assim o valor antigo não sobrescreve o que já foi escolhido em outro aparelho.
 */
export function resolverPrivacidadeLegada(perfil: PrivacidadePerfil, legada: Privacidade | null): { privacidade: Privacidade; gravar: boolean } {
  if (legada && perfil.carregada && !perfil.configurada) return { privacidade: legada, gravar: true };
  return { privacidade: perfil.privacidade, gravar: false };
}

/** Grava as preferências. Devolve a mensagem de erro para exibir, ou null se deu certo. */
export async function salvarPrivacidade(client: SupabaseClient, userId: string, privacidade: Privacidade): Promise<string | null> {
  const { error } = await client.from('profiles').update({ privacidade: normalizarPrivacidade(privacidade) }).eq('id', userId);
  return error ? 'Não foi possível salvar a preferência de privacidade. Tente de novo.' : null;
}

/**
 * Preferências tratadas como privadas, usadas enquanto as reais não foram lidas do banco
 * (falha de rede, coluna ainda não criada): nada é compartilhado nem exibido.
 */
export const PRIVACIDADE_RESTRITA: Readonly<Privacidade> = Object.freeze({
  permitir_compartilhar: false,
  perfil_publico: false,
  mostrar_horas: false,
  mostrar_conquistas: false,
});

export const ERRO_CARREGAR_PRIVACIDADE = 'Não foi possível carregar suas preferências de privacidade. Verifique a conexão e tente de novo.';

/** O que vale na tela: as preferências lidas ou, se a leitura falhou, as restritas. */
export const privacidadeEfetiva = (perfil: Pick<PrivacidadePerfil, 'privacidade' | 'carregada'>): Privacidade =>
  perfil.carregada ? perfil.privacidade : { ...PRIVACIDADE_RESTRITA };

/**
 * Inverte uma opção só se as preferências foram lidas: nunca grava os padrões por cima
 * das escolhas reais do usuário. Devolve null quando não pode alterar.
 */
export function alternarPrivacidadeLida(perfil: Pick<PrivacidadePerfil, 'privacidade' | 'carregada'>, chave: ChavePrivacidade): Privacidade | null {
  return perfil.carregada ? alternarPrivacidade(perfil.privacidade, chave) : null;
}

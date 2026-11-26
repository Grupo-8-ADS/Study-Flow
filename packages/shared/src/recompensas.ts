/**
 * Recompensas cosméticas desbloqueadas por nível: molduras do avatar e banners do perfil.
 * O nível mínimo de cada item também é validado no banco (trigger em profiles), então
 * os ids e níveis daqui precisam bater com public.nivel_minimo_moldura/banner
 * (migration 20261125000200_curva_nivel_e_recompensas).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { xpParaNivel } from './gamificacao';

/**
 * Arte desenhada para uma moldura: imagem PNG transparente com um aro circular, que pode
 * ter enfeites saindo para fora (ex.: o capelo). A geometria diz como encaixar o aro no avatar.
 */
export interface ArteMoldura {
  /** Nome do arquivo (web: /recompensas/<arquivo>; mobile: assets/images/recompensas). */
  arquivo: string;
  /** Largura da imagem dividida pelo diâmetro externo do aro. */
  escala: number;
  /** Canto superior esquerdo da imagem em relação ao avatar, em frações do diâmetro (negativo = para fora). */
  x: number;
  y: number;
}

export interface Moldura {
  id: string;
  nome: string;
  nivel: number;
  /** Cores do aro (gradiente, do início ao fim); com arte, são o fallback. */
  cores: [string, string, ...string[]];
  arte?: ArteMoldura;
}

export interface BannerPreset {
  id: string;
  nome: string;
  nivel: number;
  /** Cores do gradiente diagonal; com imagem, são o fundo enquanto ela carrega. */
  cores: [string, string, ...string[]];
  /** Ilustração do banner (web: /recompensas/<imagem>; mobile: assets/images/recompensas). */
  imagem?: string;
}

/** Arte da moldura "Formatura": imagem 635×635, aro de 406 px de diâmetro começando em (117, 117). */
const ARTE_FORMATURA: ArteMoldura = { arquivo: 'moldura-formatura.png', escala: 635 / 406, x: -117 / 406, y: -117 / 406 };

export const MOLDURAS: Moldura[] = [
  { id: 'bronze', nome: 'Bronze', nivel: 3, cores: ['#f3d2b3', '#c98a55', '#8a5a2b'] },
  { id: 'formatura', nome: 'Formatura', nivel: 4, cores: ['#3a3a3a', '#111111', '#f2a516'], arte: ARTE_FORMATURA },
  { id: 'prata', nome: 'Prata', nivel: 6, cores: ['#ffffff', '#aeb9c2', '#6f7f8b'] },
  { id: 'ouro', nome: 'Ouro', nivel: 8, cores: ['#fff1b8', '#e0a92e', '#9c6b00'] },
  { id: 'esmeralda', nome: 'Esmeralda', nivel: 12, cores: ['#b8f0d8', '#29a37a', '#0f5c44'] },
  { id: 'aurora', nome: 'Aurora', nivel: 16, cores: ['#7dd3fc', '#a78bfa', '#f472b6', '#facc15'] },
];

export const BANNERS: BannerPreset[] = [
  { id: 'floresta', nome: 'Floresta', nivel: 1, cores: ['#0f1c1d', '#29645e'] },
  { id: 'raposa-outono', nome: 'Raposa no outono', nivel: 2, cores: ['#7a2e0e', '#d9661f', '#f2b45a'], imagem: 'banner-raposa-outono.webp' },
  { id: 'oceano', nome: 'Oceano', nivel: 3, cores: ['#0b3a53', '#1f7a8c', '#7cc6d6'] },
  { id: 'por-do-sol', nome: 'Pôr do sol', nivel: 5, cores: ['#5b2a86', '#d9467a', '#f6a04d'] },
  { id: 'noite', nome: 'Noite estrelada', nivel: 8, cores: ['#0b1026', '#2b2f77', '#6b4fbb'] },
  { id: 'aurora', nome: 'Aurora', nivel: 12, cores: ['#06283d', '#1aa384', '#9be15d'] },
  { id: 'dourado', nome: 'Dourado', nivel: 16, cores: ['#3a2600', '#b8860b', '#ffe08a'] },
];

export const PREFIXO_BANNER = 'preset:';

/** "preset:<id>" → preset; URL/data URL de imagem → null. */
export function bannerPreset(valor: string | null | undefined): BannerPreset | null {
  if (!valor?.startsWith(PREFIXO_BANNER)) return null;
  return BANNERS.find((b) => b.id === valor.slice(PREFIXO_BANNER.length)) ?? null;
}

export const molduraPorId = (id: string | null | undefined) => MOLDURAS.find((m) => m.id === id) ?? null;

export const desbloqueado = (item: { nivel: number }, nivelAtual: number) => nivelAtual >= item.nivel;

/** CSS de gradiente para o web. */
export const gradienteCss = (cores: string[], angulo = 135) => `linear-gradient(${angulo}deg, ${cores.join(', ')})`;

/** Próxima moldura ou banner a liberar e quanto XP falta para ela (null = tudo liberado). */
export function proximaRecompensa(nivel: number, xp: number): { tipo: 'moldura' | 'banner'; item: Moldura | BannerPreset; faltamXp: number } | null {
  const candidatos = [
    ...MOLDURAS.map((item) => ({ tipo: 'moldura' as const, item })),
    ...BANNERS.map((item) => ({ tipo: 'banner' as const, item })),
  ]
    .filter((c) => c.item.nivel > nivel)
    .sort((a, b) => a.item.nivel - b.item.nivel);
  const proximo = candidatos[0];
  if (!proximo) return null;
  return { ...proximo, faltamXp: Math.max(0, xpParaNivel(proximo.item.nivel) - Math.max(xp, 0)) };
}

/** Frase do topo da tela de recompensas. */
export function textoProximaRecompensa(nivel: number, xp: number): string {
  const proxima = proximaRecompensa(nivel, xp);
  if (!proxima) return 'Você liberou todas as molduras e banners.';
  const artigo = proxima.tipo === 'moldura' ? 'a moldura' : 'o banner';
  return `Faltam ${proxima.faltamXp} XP para liberar ${artigo} ${proxima.item.nome} (nível ${proxima.item.nivel}).`;
}

export interface Contagem {
  feitos: number;
  total: number;
}

/** Quantos itens de cada coleção já foram liberados, e o total geral em %. */
export function resumoColecao(nivel: number, conquistas: Contagem) {
  const molduras = { feitos: MOLDURAS.filter((m) => desbloqueado(m, nivel)).length, total: MOLDURAS.length };
  const banners = { feitos: BANNERS.filter((b) => desbloqueado(b, nivel)).length, total: BANNERS.length };
  const feitos = conquistas.feitos + molduras.feitos + banners.feitos;
  const total = conquistas.total + molduras.total + banners.total;
  return { conquistas, molduras, banners, feitos, total, percentual: total > 0 ? Math.round((feitos / total) * 100) : 0 };
}

export type CampoRecompensa = 'moldura' | 'banner_url';

/** Valor gravado em profiles.banner_url para um banner pronto. */
export const valorBanner = (banner: Pick<BannerPreset, 'id'>) => `${PREFIXO_BANNER}${banner.id}`;

/**
 * Equipa (ou tira, com `valor` null) a moldura ou o banner do perfil. O trigger
 * validar_recompensas_perfil recusa itens acima do nível (erro 42501).
 * Devolve a mensagem de erro para exibir, ou null se deu certo.
 */
export async function equiparRecompensa(client: SupabaseClient, userId: string, campo: CampoRecompensa, valor: string | null): Promise<string | null> {
  const { error } = await client.from('profiles').update({ [campo]: valor }).eq('id', userId);
  if (!error) return null;
  return error.code === '42501' ? 'Esse item ainda está bloqueado para o seu nível.' : 'Não foi possível equipar agora. Tente de novo.';
}

/**
 * Recompensas cosméticas desbloqueadas por nível: molduras do avatar e banners do perfil.
 * O nível mínimo de cada item também é validado no banco (trigger em profiles), então
 * os ids e níveis daqui precisam bater com a migration 20261106000300_recompensas.
 */

export interface Moldura {
  id: string;
  nome: string;
  nivel: number;
  /** Cores do aro (gradiente, do início ao fim). */
  cores: [string, string, ...string[]];
}

export interface BannerPreset {
  id: string;
  nome: string;
  nivel: number;
  /** Cores do gradiente diagonal. */
  cores: [string, string, ...string[]];
}

export const MOLDURAS: Moldura[] = [
  { id: 'bronze', nome: 'Bronze', nivel: 3, cores: ['#f3d2b3', '#c98a55', '#8a5a2b'] },
  { id: 'prata', nome: 'Prata', nivel: 6, cores: ['#ffffff', '#aeb9c2', '#6f7f8b'] },
  { id: 'ouro', nome: 'Ouro', nivel: 10, cores: ['#fff1b8', '#e0a92e', '#9c6b00'] },
  { id: 'esmeralda', nome: 'Esmeralda', nivel: 15, cores: ['#b8f0d8', '#29a37a', '#0f5c44'] },
  { id: 'aurora', nome: 'Aurora', nivel: 25, cores: ['#7dd3fc', '#a78bfa', '#f472b6', '#facc15'] },
];

export const BANNERS: BannerPreset[] = [
  { id: 'floresta', nome: 'Floresta', nivel: 1, cores: ['#0f1c1d', '#29645e'] },
  { id: 'oceano', nome: 'Oceano', nivel: 3, cores: ['#0b3a53', '#1f7a8c', '#7cc6d6'] },
  { id: 'por-do-sol', nome: 'Pôr do sol', nivel: 6, cores: ['#5b2a86', '#d9467a', '#f6a04d'] },
  { id: 'noite', nome: 'Noite estrelada', nivel: 10, cores: ['#0b1026', '#2b2f77', '#6b4fbb'] },
  { id: 'aurora', nome: 'Aurora', nivel: 15, cores: ['#06283d', '#1aa384', '#9be15d'] },
  { id: 'dourado', nome: 'Dourado', nivel: 25, cores: ['#3a2600', '#b8860b', '#ffe08a'] },
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

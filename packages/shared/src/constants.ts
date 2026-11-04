/**
 * Tokens de cor compartilhados entre o site e o app (mesmos valores do `@theme`
 * em frontend/src/app/globals.css). A cor principal é o verde Study Flow (#29645e).
 */
export const COLORS = {
  primary: '#29645e', // primary-700
  primaryDark: '#1f4d48', // primary-800
  primaryLight: '#348e83', // primary-500
  primaryMuted: '#e3f3f0', // primary-100
  primarySoft: '#f2faf8', // primary-50
  background: '#f5f9f8', // canvas
  card: '#ffffff', // surface
  text: '#12201e', // ink-900
  textSecondary: '#4a5b58', // ink-600
  textMuted: '#5c6d6a', // ink-500 (menor tom com contraste AA sobre branco)
  placeholder: '#8a9996', // ink-400
  border: '#e3ebe9', // line
  borderStrong: '#dde6e4', // ink-200
  danger: '#c2362f',
  dangerLight: '#fdecea',
  warning: '#b45309',
  warningLight: '#fdf3e2',
  success: '#0f8a5f',
  successLight: '#e7f6ef',
  info: '#2563eb',
  infoLight: '#e8f0fe',
  gold: '#b57d0b',
  goldLight: '#fff4d6',
  purple: '#705c9d',
  purpleLight: '#f3f0f9',
};

/** Raios de canto compartilhados (px): controles, cartões e painéis. */
export const RADII = {
  control: 10,
  card: 16,
  panel: 20,
};

export const POMODORO_TIMES = {
  foco: 25 * 60, // 25 minutos em segundos
  curta: 5 * 60,  // 5 minutos em segundos
  longa: 15 * 60, // 15 minutos em segundos
};

export const DISTRIBUTION_COLORS = [
  '#29645e',
  '#348e83',
  '#e5a93b',
  '#f87171',
  '#9ca3af',
];

export const DEMO_USER = {
  id: 'demo-user-id',
  email: 'admin@studyflow.com',
  nome: 'Carlos Eduardo',
  username: 'carlosedu',
  bg_color: '#29645e',
  horas_diarias: 4,
  nivel_atual: 12,
  xp: 2840,
  last_achievement: 'Especialista em História I',
};

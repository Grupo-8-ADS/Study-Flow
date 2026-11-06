/**
 * Pomodoro configurável: durações de cada modo, ciclos até a pausa longa e
 * avanço automático. Usado pelo timer do site e do app.
 */

export type ModoPomodoro = 'foco' | 'pausa_curta' | 'pausa_longa';

export interface ConfigPomodoro {
  /** Minutos de foco. */
  foco: number;
  /** Minutos da pausa curta. */
  pausaCurta: number;
  /** Minutos da pausa longa. */
  pausaLonga: number;
  /** Quantos focos até a pausa longa. */
  ciclosAteLonga: number;
  /** Ao terminar um modo, já começa o próximo. */
  autoIniciar: boolean;
  /** Toca um som ao terminar. */
  som: boolean;
}

export const POMODORO_PADRAO: ConfigPomodoro = {
  foco: 25,
  pausaCurta: 5,
  pausaLonga: 15,
  ciclosAteLonga: 4,
  autoIniciar: false,
  som: true,
};

export const PRESETS_POMODORO: Array<{ nome: string; config: Pick<ConfigPomodoro, 'foco' | 'pausaCurta' | 'pausaLonga' | 'ciclosAteLonga'> }> = [
  { nome: 'Clássico 25/5', config: { foco: 25, pausaCurta: 5, pausaLonga: 15, ciclosAteLonga: 4 } },
  { nome: 'Longo 50/10', config: { foco: 50, pausaCurta: 10, pausaLonga: 30, ciclosAteLonga: 3 } },
  { nome: 'Curto 15/3', config: { foco: 15, pausaCurta: 3, pausaLonga: 10, ciclosAteLonga: 4 } },
];

export const LIMITES_POMODORO = {
  foco: [5, 180],
  pausaCurta: [1, 60],
  pausaLonga: [1, 90],
  ciclosAteLonga: [2, 10],
} as const;

const limitar = (v: unknown, [min, max]: readonly [number, number], padrao: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : padrao;
};

/** Lê uma configuração salva (JSON ou objeto), corrigindo valores fora dos limites. */
export function normalizarPomodoro(bruto: unknown): ConfigPomodoro {
  let obj: Partial<ConfigPomodoro> = {};
  try {
    obj = (typeof bruto === 'string' ? JSON.parse(bruto) : bruto) ?? {};
  } catch {
    obj = {};
  }
  if (typeof obj !== 'object') obj = {};
  return {
    foco: limitar(obj.foco, LIMITES_POMODORO.foco, POMODORO_PADRAO.foco),
    pausaCurta: limitar(obj.pausaCurta, LIMITES_POMODORO.pausaCurta, POMODORO_PADRAO.pausaCurta),
    pausaLonga: limitar(obj.pausaLonga, LIMITES_POMODORO.pausaLonga, POMODORO_PADRAO.pausaLonga),
    ciclosAteLonga: limitar(obj.ciclosAteLonga, LIMITES_POMODORO.ciclosAteLonga, POMODORO_PADRAO.ciclosAteLonga),
    autoIniciar: typeof obj.autoIniciar === 'boolean' ? obj.autoIniciar : POMODORO_PADRAO.autoIniciar,
    som: typeof obj.som === 'boolean' ? obj.som : POMODORO_PADRAO.som,
  };
}

/** Duração do modo em segundos. */
export function duracaoModo(modo: ModoPomodoro, cfg: ConfigPomodoro): number {
  const min = modo === 'foco' ? cfg.foco : modo === 'pausa_curta' ? cfg.pausaCurta : cfg.pausaLonga;
  return min * 60;
}

/**
 * Próximo modo depois de terminar `modo`. `focosConcluidos` já inclui o foco que acabou
 * de terminar (quando `modo` é foco).
 */
export function proximoModo(modo: ModoPomodoro, focosConcluidos: number, cfg: ConfigPomodoro): ModoPomodoro {
  if (modo !== 'foco') return 'foco';
  return focosConcluidos > 0 && focosConcluidos % cfg.ciclosAteLonga === 0 ? 'pausa_longa' : 'pausa_curta';
}

/** Segundos restantes até `fimEm` (ms), arredondando para cima; nunca negativo. */
export function segundosRestantes(fimEm: number, agora: number): number {
  return Math.max(0, Math.ceil((fimEm - agora) / 1000));
}

export const ROTULO_MODO: Record<ModoPomodoro, string> = {
  foco: 'Foco',
  pausa_curta: 'Pausa curta',
  pausa_longa: 'Pausa longa',
};

import { describe, expect, it } from 'vitest';
import { POMODORO_PADRAO, duracaoModo, normalizarPomodoro, proximoModo, segundosRestantes } from './pomodoro';

describe('pomodoro', () => {
  it('usa o padrão quando não há nada salvo ou o JSON é inválido', () => {
    expect(normalizarPomodoro(null)).toEqual(POMODORO_PADRAO);
    expect(normalizarPomodoro('{quebrado')).toEqual(POMODORO_PADRAO);
  });

  it('limita valores fora da faixa e mantém os válidos', () => {
    const cfg = normalizarPomodoro(JSON.stringify({ foco: 999, pausaCurta: 0, pausaLonga: 20, ciclosAteLonga: 3, autoIniciar: true }));
    expect(cfg).toMatchObject({ foco: 180, pausaCurta: 1, pausaLonga: 20, ciclosAteLonga: 3, autoIniciar: true, som: true });
  });

  it('alterna foco e pausas, com pausa longa a cada N focos', () => {
    const cfg = { ...POMODORO_PADRAO, ciclosAteLonga: 3 };
    expect(proximoModo('foco', 1, cfg)).toBe('pausa_curta');
    expect(proximoModo('foco', 3, cfg)).toBe('pausa_longa');
    expect(proximoModo('pausa_curta', 1, cfg)).toBe('foco');
    expect(proximoModo('pausa_longa', 3, cfg)).toBe('foco');
  });

  it('calcula durações e o tempo restante pelo relógio', () => {
    expect(duracaoModo('foco', POMODORO_PADRAO)).toBe(1500);
    expect(duracaoModo('pausa_longa', POMODORO_PADRAO)).toBe(900);
    expect(segundosRestantes(10_000, 8_500)).toBe(2);
    expect(segundosRestantes(10_000, 12_000)).toBe(0);
  });
});

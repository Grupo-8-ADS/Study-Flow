import { describe, expect, it } from 'vitest';
import type { AgendaDados } from './agenda';
import { LIMITE_DIARIO_PADRAO_H, lerLimiteDiario, limiteDiarioInicial, planejarCronograma, resumoCronograma } from './cronograma';

/** Segunda-feira, 07:00 local. */
const AGORA = new Date(2026, 10, 23, 7, 0);

const agenda = (parcial: Partial<AgendaDados> = {}): AgendaDados => ({
  disciplinas: [
    { id: 'd1', nome: 'Cálculo', professor: '', prioridade: 3, aulas: [], notas: '' },
    { id: 'd2', nome: 'História', professor: '', prioridade: 1, aulas: [], notas: '' },
  ],
  compromissos: [],
  rotinas: [],
  ...parcial,
});

/** Segunda a sexta, 08:00–18:00 livre para estudar. */
const rotina = [1, 2, 3, 4, 5].map((dia_semana) => ({ dia_semana, hora_inicio: '08:00', hora_fim: '18:00' }));

const base = { agenda: agenda(), rotina, semanas: 1, duracaoBloco: '50', limiteHoras: '', substituir: true, agora: AGORA };

describe('limiteDiarioInicial', () => {
  it('quandoPerfilTemMeta_deveUsarAMeta', () => {
    expect(limiteDiarioInicial(2.5)).toBe(2.5);
    expect(limiteDiarioInicial('3')).toBe(3);
  });

  it('quandoSemMetaValida_deveUsar4h', () => {
    for (const v of [null, undefined, 0, -1, 'abc', Number.NaN]) expect(limiteDiarioInicial(v)).toBe(LIMITE_DIARIO_PADRAO_H);
    expect(LIMITE_DIARIO_PADRAO_H).toBe(4);
  });
});

describe('lerLimiteDiario', () => {
  it('quandoVazio_deveSerSemLimite', () => {
    expect(lerLimiteDiario('  ')).toEqual({ minutos: undefined });
  });

  it('quandoNumeroComVirgula_deveConverterEmMinutos', () => {
    expect(lerLimiteDiario('1,5')).toEqual({ minutos: 90 });
    expect(lerLimiteDiario('24')).toEqual({ minutos: 1440 });
  });

  it('quandoForaDaFaixa_deveDarErro', () => {
    for (const t of ['0', '-2', '25', 'x']) expect(lerLimiteDiario(t)).toHaveProperty('erro');
  });
});

describe('planejarCronograma', () => {
  it('quandoSemDisciplinas_deveAvisarComLinkParaDisciplinas', () => {
    expect(planejarCronograma({ ...base, agenda: agenda({ disciplinas: [] }) })).toEqual({
      ok: false,
      mensagem: 'Cadastre ao menos uma disciplina antes de gerar o cronograma.',
      semDisciplinas: true,
    });
  });

  it('quandoSemRotinaOuDuracaoOuLimiteInvalidos_deveDarErro', () => {
    expect(planejarCronograma({ ...base, rotina: [] })).toMatchObject({ ok: false, mensagem: expect.stringMatching(/rotina semanal/) });
    expect(planejarCronograma({ ...base, duracaoBloco: '5' })).toMatchObject({ ok: false, mensagem: expect.stringMatching(/entre 10 e 240/) });
    expect(planejarCronograma({ ...base, duracaoBloco: '50.5' })).toMatchObject({ ok: false });
    expect(planejarCronograma({ ...base, limiteHoras: '30' })).toMatchObject({ ok: false, mensagem: expect.stringMatching(/máximo de horas/) });
  });

  it('quandoComLimiteDiario_naoPassaDoLimiteEmNenhumDia', () => {
    const r = planejarCronograma({ ...base, limiteHoras: '2' });
    if (!r.ok) throw new Error(r.mensagem);
    const porDia = new Map<string, number>();
    for (const b of r.blocos) {
      const dia = new Date(b.data_inicio).toDateString();
      porDia.set(dia, (porDia.get(dia) ?? 0) + (new Date(b.data_fim).getTime() - new Date(b.data_inicio).getTime()) / 60000);
    }
    expect(r.blocos.length).toBeGreaterThan(0);
    expect(Math.max(...porDia.values())).toBeLessThanOrEqual(120);
  });

  it('quandoSemLimite_geraMaisBlocosQueComLimite', () => {
    const com = planejarCronograma({ ...base, limiteHoras: '1' });
    const sem = planejarCronograma(base);
    if (!com.ok || !sem.ok) throw new Error('falhou');
    expect(sem.blocos.length).toBeGreaterThan(com.blocos.length);
    expect(sem.duracaoMin).toBe(50);
  });

  it('quandoAulaOcupaOHorario_contaComoDescartado', () => {
    const comAula = agenda({
      disciplinas: [{ id: 'd1', nome: 'Cálculo', professor: '', prioridade: 2, aulas: [{ dia_semana: 2, inicio: '08:00', fim: '18:00' }], notas: '' }],
    });
    const r = planejarCronograma({ ...base, agenda: comAula });
    if (!r.ok) throw new Error(r.mensagem);
    expect(r.descartados).toBeGreaterThan(0);
    expect(r.blocos.every((b) => new Date(b.data_inicio).getDay() !== 2)).toBe(true);
  });
});

describe('resumoCronograma', () => {
  it('contaBlocosPorDisciplinaNaOrdemDeAparicao', () => {
    const b = (nome: string) => ({ disciplina_id: nome, disciplina_nome: nome, data_inicio: '', data_fim: '' });
    expect(resumoCronograma([b('A'), b('B'), b('A')])).toEqual([
      ['A', 2],
      ['B', 1],
    ]);
  });
});

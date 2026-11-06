import { describe, expect, it } from 'vitest';


import { aulasNoPeriodo, deLinha, formatarHorario, paraLinha, validarCompromisso, type CompromissoForm } from './agenda';

const base: CompromissoForm = {
  titulo: 'P1',
  tipo: 'prova',
  disciplinaId: null,
  data: '2026-11-20',
  horaInicio: '',
  horaFim: '',
  notas: '',
};

const ida_e_volta = (form: CompromissoForm) => {
  const linha = paraLinha(form);
  return deLinha({ id: 'x', completed: false, origem_externa_id: null, ...linha })!;
};

describe('agenda.ts', () => {
  it('compromisso_quandoSoComData_deveFicarNoDiaEscolhidoComoDiaInteiro', () => {
    const c = ida_e_volta(base);
    expect(c.data).toBe('2026-11-20');
    expect(c.horaInicio).toBe('');
    expect(formatarHorario(c)).toBe('Dia inteiro');
  });

  it('compromisso_quandoComInicioEFim_devePreservarHorarios', () => {
    const c = ida_e_volta({ ...base, horaInicio: '19:00', horaFim: '20:40' });
    expect(c).toMatchObject({ data: '2026-11-20', horaInicio: '19:00', horaFim: '20:40' });
  });

  it('compromisso_quandoSoComInicio_deveFicarSemTermino', () => {
    const c = ida_e_volta({ ...base, horaInicio: '08:00' });
    expect(c).toMatchObject({ horaInicio: '08:00', horaFim: '' });
    expect(formatarHorario(c)).toBe('08:00');
  });

  it('paraLinha_deveGravarInstanteRealComFuso', () => {
    const linha = paraLinha({ ...base, horaInicio: '19:00' });
    expect(new Date(linha.data_inicio).getHours()).toBe(19);
    expect(linha.data_inicio.endsWith('Z')).toBe(true);
  });

  it('deLinha_quandoTipoAntigo_deveNormalizar', () => {
    const linha = { ...paraLinha(base), tipo: 'entrega' };
    expect(deLinha({ id: 'x', completed: false, origem_externa_id: null, ...linha })!.tipo).toBe('trabalho');
  });

  it('deLinha_quandoOrigemCronograma_deveMarcarComoGerado', () => {
    const linha = { ...paraLinha({ ...base, tipo: 'estudo', titulo: 'Bloco' }) };
    expect(deLinha({ id: 'x', completed: false, origem_externa_id: 'cronograma:x', ...linha })!.origem).toBe('cronograma');
  });

  it('validarCompromisso_deveExigirNomeDataEOrdemDosHorarios', () => {
    expect(validarCompromisso({ ...base, titulo: ' ' })).toMatch(/nome/i);
    expect(validarCompromisso({ ...base, data: '' })).toMatch(/data/i);
    expect(validarCompromisso({ ...base, horaFim: '10:00' })).toMatch(/início/i);
    expect(validarCompromisso({ ...base, horaInicio: '10:00', horaFim: '09:00' })).toMatch(/depois/i);
    expect(validarCompromisso(base)).toBeNull();
  });

  it('aulasNoPeriodo_deveRepetirAsAulasNosDiasDaSemana', () => {
    // 16/11/2026 é segunda; 22/11 é domingo.
    const aulas = aulasNoPeriodo(
      [{ id: 'd', nome: 'Cálculo', professor: '', prioridade: 2, notas: '', aulas: [{ dia_semana: 1, inicio: '19:00', fim: '20:40' }, { dia_semana: 3, inicio: '19:00', fim: '20:40' }] }],
      '2026-11-16',
      '2026-11-22',
    );
    expect(aulas.map((a) => a.data)).toEqual(['2026-11-16', '2026-11-18']);
  });
});

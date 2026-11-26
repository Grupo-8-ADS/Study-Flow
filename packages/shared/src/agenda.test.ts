import { describe, expect, it } from 'vitest';


import { aulasNoPeriodo, deLinha, diasAte, focoSugerido, formatarHorario, ocupadosNoPeriodo, paraLinha, proximasEntregas, rotinasNoPeriodo, rotuloProfessor, validarCompromisso, type CompromissoForm } from './agenda';

describe('diasAte', () => {
  it('deveContarDiasCorridos', () => {
    expect(diasAte('2026-12-03', '2026-11-26')).toBe(7);
    expect(diasAte('2026-11-26', '2026-11-26')).toBe(0);
    expect(diasAte('2026-11-25', '2026-11-26')).toBe(-1);
  });
});

describe('focoSugerido', () => {
  const HOJE = '2026-11-26';
  const disciplinas = [
    { id: 'c', nome: 'Cálculo I' },
    { id: 'f', nome: 'Física II' },
  ];
  const prova = (data: string, extra: object = {}) => ({ titulo: 'P1', tipo: 'prova' as const, disciplinaId: 'c', data, concluido: false, ...extra });

  it('quandoProvaNosProximos7Dias_deveSugerirAMateriaDaProva', () => {
    expect(focoSugerido([prova('2026-12-03')], disciplinas, [], HOJE)).toBe('P1 (Cálculo I) é em 7 dias. Priorize essa matéria.');
    expect(focoSugerido([prova('2026-11-26')], disciplinas, [], HOJE)).toBe('P1 (Cálculo I) é hoje. Priorize essa matéria.');
    expect(focoSugerido([prova('2026-11-27', { disciplinaId: null })], disciplinas, [], HOJE)).toBe('P1 é amanhã. Priorize essa matéria.');
  });

  it('quandoProvaPassadaConcluidaOuLonge_deveIgnorar', () => {
    const dist = [{ name: 'Cálculo I' }, { name: 'Física II' }];
    const ignoradas = [prova('2026-11-25'), prova('2026-12-04'), prova('2026-11-28', { concluido: true })];
    expect(focoSugerido(ignoradas, disciplinas, dist, HOJE)).toBe('Física II é a disciplina com menos horas registradas.');
  });

  it('quandoDisciplinaSemSessoes_deveSugeriLa', () => {
    expect(focoSugerido([], disciplinas, [{ name: 'Cálculo I' }], HOJE)).toBe('Você ainda não registrou sessões de Física II.');
  });

  it('quandoNadaParaSugerir_deveDevolverNull', () => {
    expect(focoSugerido([], [], undefined, HOJE)).toBeNull();
  });
});

describe('rotuloProfessor', () => {
  it('quandoSemTitulo_deveAcrescentarProf', () => {
    expect(rotuloProfessor('Ana Souza')).toBe('Prof. Ana Souza');
    expect(rotuloProfessor('  Ana  ')).toBe('Prof. Ana');
  });

  it('quandoJaTemTitulo_naoDeveRepetir', () => {
    for (const nome of ['Prof. Teste', 'prof Teste', 'Profa. Maria', 'Professor João', 'Professora Lia', 'PROF. X', 'Prof.Ana', 'Profª Bia', 'Profª. Bia']) {
      expect(rotuloProfessor(nome)).toBe(nome);
    }
  });

  it('quandoNomeComecaComProfMasNaoEhTitulo_deveAcrescentar', () => {
    expect(rotuloProfessor('Profeta Silva')).toBe('Prof. Profeta Silva');
  });

  it('quandoVazio_deveDevolverVazio', () => {
    expect(rotuloProfessor('')).toBe('');
    expect(rotuloProfessor('   ')).toBe('');
    expect(rotuloProfessor(null)).toBe('');
    expect(rotuloProfessor(undefined)).toBe('');
  });
});

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

describe('rotinas e ocupação da agenda', () => {
  it('rotinasNoPeriodo_deveRepetirOsHorariosNosDiasDaSemana', () => {
    // 2026-03-02 é segunda-feira
    const lista = rotinasNoPeriodo([{ id: 'r1', nome: 'Trabalho', horarios: [{ dia_semana: 1, inicio: '08:00', fim: '12:00' }], notas: '' }], '2026-03-01', '2026-03-14');
    expect(lista.map((c) => c.data)).toEqual(['2026-03-02', '2026-03-09']);
    expect(lista[0]).toMatchObject({ rotina: true, titulo: 'Trabalho', horaInicio: '08:00', horaFim: '12:00', disciplinaId: null });
  });

  it('ocupadosNoPeriodo_deveSomarAulasRotinasECompromissosComHorario', () => {
    const dados = {
      disciplinas: [{ id: 'd1', nome: 'Cálculo', professor: '', prioridade: 2 as const, aulas: [{ dia_semana: 1, inicio: '19:00', fim: '20:40' }], notas: '' }],
      rotinas: [{ id: 'r1', nome: 'Trabalho', horarios: [{ dia_semana: 1, inicio: '08:00', fim: '12:00' }], notas: '' }],
      compromissos: [
        { id: 'c1', titulo: 'Reunião', tipo: 'atividade' as const, disciplinaId: null, data: '2026-03-02', horaInicio: '14:00', horaFim: '', notas: '', concluido: false, origem: null },
        { id: 'c2', titulo: 'Dia todo', tipo: 'atividade' as const, disciplinaId: null, data: '2026-03-02', horaInicio: '', horaFim: '', notas: '', concluido: false, origem: null },
        { id: 'c3', titulo: 'Estudo', tipo: 'estudo' as const, disciplinaId: 'd1', data: '2026-03-02', horaInicio: '15:00', horaFim: '16:00', notas: '', concluido: false, origem: 'cronograma' as const },
      ],
    };
    const horas = (o: { inicio: Date; fim: Date }) => `${o.inicio.getHours()}-${o.fim.getHours()}`;
    expect(ocupadosNoPeriodo(dados, '2026-03-02', '2026-03-02').map(horas).sort()).toEqual(['14-15', '15-16', '19-20', '8-12']);
    expect(ocupadosNoPeriodo(dados, '2026-03-02', '2026-03-02', true).map(horas).sort()).toEqual(['14-15', '19-20', '8-12']);
  });

  it('proximasEntregas_deveIgnorarTrabalhosConcluidosEPassados', () => {
    const c = (id: string, data: string, concluido = false) => ({
      id, titulo: id, tipo: 'trabalho' as const, disciplinaId: 'd1', data, horaInicio: '', horaFim: '', notas: '', concluido, origem: null,
    });
    const amanha = new Date(Date.now() + 86_400_000);
    const depois = new Date(Date.now() + 3 * 86_400_000);
    const s = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(proximasEntregas([c('feito', s(amanha), true), c('velho', '2020-01-01'), c('ok', s(depois))]).get('d1')).toBe(s(depois));
  });
});

import { describe, it, expect } from 'vitest';
import {
  intervaloDoPeriodo,
  intervaloPersonalizado,
  gerarRelatorioPeriodo,
  relatorioParaCSV,
  dataLocalISO,
  type Intervalo,
  type RelatorioPeriodo,
  type SessaoRelatorio,
} from './relatorios';

// 03/11/2026 é uma terça-feira; 08/11/2026 e 01/11/2026 são domingos (horário local).
const TERCA = new Date(2026, 10, 3);
const SEMANA: Intervalo = { inicio: new Date(2026, 10, 2), fim: new Date(2026, 10, 9) };

const sessao = (
  ano: number,
  mes: number,
  dia: number,
  min: number | null,
  extra: Partial<SessaoRelatorio> = {},
  hora = 10,
): SessaoRelatorio => ({
  data_inicio: new Date(ano, mes, dia, hora, 0).toISOString(),
  duracao_efetiva_min: min,
  ...extra,
});

const ymd = (d: Date) => [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()];

describe('dataLocalISO', () => {
  it('dataLocalISO_quandoMesEDiaComUmDigito_devePreencherComZero', () => {
    expect(dataLocalISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('dataLocalISO_quandoMesEDiaComDoisDigitos_deveManterValores', () => {
    expect(dataLocalISO(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('intervaloDoPeriodo', () => {
  it('intervaloDoPeriodo_quandoSemanaEmDiaUtil_deveIniciarNaSegundaEFinalizarNaProximaSegunda', () => {
    const r = intervaloDoPeriodo('semana', TERCA);
    expect(ymd(r.inicio)).toEqual([2026, 10, 2, 0, 0]);
    expect(ymd(r.fim)).toEqual([2026, 10, 9, 0, 0]);
  });

  it('intervaloDoPeriodo_quandoHojeEhSegunda_deveIniciarNoProprioDia', () => {
    const r = intervaloDoPeriodo('semana', new Date(2026, 10, 2));
    expect(ymd(r.inicio)).toEqual([2026, 10, 2, 0, 0]);
  });

  it('intervaloDoPeriodo_quandoHojeEhDomingo_deveIniciarNaSegundaPassada', () => {
    const r = intervaloDoPeriodo('semana', new Date(2026, 10, 8));
    expect(ymd(r.inicio)).toEqual([2026, 10, 2, 0, 0]);
    expect(ymd(r.fim)).toEqual([2026, 10, 9, 0, 0]);
  });

  it('intervaloDoPeriodo_quandoSemanaCruzaMes_deveIniciarNoMesAnterior', () => {
    const r = intervaloDoPeriodo('semana', new Date(2026, 10, 1)); // domingo
    expect(ymd(r.inicio)).toEqual([2026, 9, 26, 0, 0]);
    expect(ymd(r.fim)).toEqual([2026, 10, 2, 0, 0]);
  });

  it('intervaloDoPeriodo_quandoSemanaCruzaAno_deveIniciarNoAnoAnterior', () => {
    const r = intervaloDoPeriodo('semana', new Date(2027, 0, 1)); // sexta
    expect(ymd(r.inicio)).toEqual([2026, 11, 28, 0, 0]);
    expect(ymd(r.fim)).toEqual([2027, 0, 4, 0, 0]);
  });

  it('intervaloDoPeriodo_quandoReferenciaTemHorario_deveZerarHorarioDoInicio', () => {
    const r = intervaloDoPeriodo('semana', new Date(2026, 10, 3, 18, 45));
    expect(ymd(r.inicio)).toEqual([2026, 10, 2, 0, 0]);
  });

  it('intervaloDoPeriodo_quandoMesNoMeioDoMes_deveCobrirOMesCivil', () => {
    const r = intervaloDoPeriodo('mes', TERCA);
    expect(ymd(r.inicio)).toEqual([2026, 10, 1, 0, 0]);
    expect(ymd(r.fim)).toEqual([2026, 11, 1, 0, 0]);
  });

  it('intervaloDoPeriodo_quandoMesNoPrimeiroEUltimoDia_deveManterOMesmoIntervalo', () => {
    const primeiro = intervaloDoPeriodo('mes', new Date(2026, 10, 1));
    const ultimo = intervaloDoPeriodo('mes', new Date(2026, 10, 30, 23, 59));
    expect(ymd(primeiro.inicio)).toEqual([2026, 10, 1, 0, 0]);
    expect(ymd(primeiro.fim)).toEqual([2026, 11, 1, 0, 0]);
    expect(ymd(ultimo.inicio)).toEqual([2026, 10, 1, 0, 0]);
    expect(ymd(ultimo.fim)).toEqual([2026, 11, 1, 0, 0]);
  });

  it('intervaloDoPeriodo_quandoMesDeDezembro_deveVirarOAnoNoFim', () => {
    const r = intervaloDoPeriodo('mes', new Date(2026, 11, 31));
    expect(ymd(r.inicio)).toEqual([2026, 11, 1, 0, 0]);
    expect(ymd(r.fim)).toEqual([2027, 0, 1, 0, 0]);
  });
});

describe('intervaloPersonalizado', () => {
  it('intervaloPersonalizado_quandoDatasValidas_deveTornarFimExclusivoNoDiaSeguinte', () => {
    const r = intervaloPersonalizado('2026-11-02', '2026-11-08');
    expect(ymd(r.inicio)).toEqual([2026, 10, 2, 0, 0]);
    expect(ymd(r.fim)).toEqual([2026, 10, 9, 0, 0]);
  });

  it('intervaloPersonalizado_quandoMesmoDia_deveCobrirUmDia', () => {
    const r = intervaloPersonalizado('2026-11-03', '2026-11-03');
    expect(ymd(r.inicio)).toEqual([2026, 10, 3, 0, 0]);
    expect(ymd(r.fim)).toEqual([2026, 10, 4, 0, 0]);
  });

  it('intervaloPersonalizado_quandoFimNoUltimoDiaDoAno_deveVirarOAno', () => {
    const r = intervaloPersonalizado('2026-12-01', '2026-12-31');
    expect(ymd(r.fim)).toEqual([2027, 0, 1, 0, 0]);
  });

  it('intervaloPersonalizado_quandoAnoBissexto_deveAceitar29DeFevereiro', () => {
    const r = intervaloPersonalizado('2028-02-29', '2028-02-29');
    expect(ymd(r.inicio)).toEqual([2028, 1, 29, 0, 0]);
  });

  it('intervaloPersonalizado_quandoFormatoInvalido_deveLancarErroComFormatoEsperado', () => {
    expect(() => intervaloPersonalizado('03/11/2026', '2026-11-08')).toThrow(
      'Data inválida: "03/11/2026" (use AAAA-MM-DD)',
    );
    expect(() => intervaloPersonalizado('2026-11-02', 'abc')).toThrow('Data inválida: "abc" (use AAAA-MM-DD)');
    expect(() => intervaloPersonalizado('', '2026-11-08')).toThrow('Data inválida: "" (use AAAA-MM-DD)');
  });

  it('intervaloPersonalizado_quandoSemZeroAEsquerda_deveRejeitar', () => {
    expect(() => intervaloPersonalizado('2026-1-1', '2026-11-08')).toThrow(/Data inválida/);
  });

  it('intervaloPersonalizado_quandoTextoExtraNoInicioOuFim_deveRejeitar', () => {
    expect(() => intervaloPersonalizado('x2026-11-02', '2026-11-08')).toThrow(/Data inválida/);
    expect(() => intervaloPersonalizado('2026-11-02x', '2026-11-08')).toThrow(/Data inválida/);
  });

  it('intervaloPersonalizado_quando31DeFevereiro_deveLancarErroDeDataInvalida', () => {
    expect(() => intervaloPersonalizado('2026-02-31', '2026-03-05')).toThrowError(
      /^Data inválida: "2026-02-31"$/,
    );
  });

  it('intervaloPersonalizado_quandoDataFinalInexistente_deveLancarErro', () => {
    expect(() => intervaloPersonalizado('2026-02-01', '2026-04-31')).toThrowError(
      /^Data inválida: "2026-04-31"$/,
    );
  });

  it('intervaloPersonalizado_quando29DeFevereiroEmAnoNaoBissexto_deveLancarErro', () => {
    expect(() => intervaloPersonalizado('2027-02-29', '2027-03-05')).toThrow(/Data inválida/);
  });

  it('intervaloPersonalizado_quandoMesOuDiaZeroOuMesMaiorQue12_deveLancarErro', () => {
    expect(() => intervaloPersonalizado('2026-13-01', '2027-01-05')).toThrow(/Data inválida/);
    expect(() => intervaloPersonalizado('2026-00-10', '2027-01-05')).toThrow(/Data inválida/);
    expect(() => intervaloPersonalizado('2026-03-00', '2027-01-05')).toThrow(/Data inválida/);
  });

  it('intervaloPersonalizado_quandoFimAnteriorAoInicio_deveLancarErro', () => {
    expect(() => intervaloPersonalizado('2026-11-08', '2026-11-02')).toThrow(
      'A data final deve ser igual ou posterior à inicial',
    );
  });
});

describe('gerarRelatorioPeriodo', () => {
  it('gerarRelatorioPeriodo_quandoSemSessoes_deveRetornarTudoZeradoComUmRegistroPorDia', () => {
    // Act
    const r = gerarRelatorioPeriodo([], SEMANA);
    // Assert
    expect(r.inicio).toBe('2026-11-02');
    expect(r.fim).toBe('2026-11-08');
    expect(r.totalMinutos).toBe(0);
    expect(r.totalSessoes).toBe(0);
    expect(r.diasEstudados).toBe(0);
    expect(r.mediaMinutosPorDia).toBe(0);
    expect(r.porDisciplina).toEqual([]);
    expect(r.porDia.map((d) => d.data)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
    expect(r.porDia.every((d) => d.minutos === 0)).toBe(true);
  });

  it('gerarRelatorioPeriodo_quandoSessoesConcluidasNoIntervalo_deveConsolidarTotais', () => {
    // Arrange
    const sessoes = [
      sessao(2026, 10, 2, 30, { disciplina_nome: 'Cálculo', status: 'concluida' }),
      sessao(2026, 10, 2, 20, { disciplina_nome: 'Cálculo', status: 'concluida' }),
      sessao(2026, 10, 4, 50, { disciplina_nome: 'Física', status: 'concluida' }),
    ];
    // Act
    const r = gerarRelatorioPeriodo(sessoes, SEMANA);
    // Assert
    expect(r.totalMinutos).toBe(100);
    expect(r.totalSessoes).toBe(3);
    expect(r.diasEstudados).toBe(2);
    expect(r.mediaMinutosPorDia).toBe(14);
    expect(r.porDia).toContainEqual({ data: '2026-11-02', minutos: 50 });
    expect(r.porDia).toContainEqual({ data: '2026-11-04', minutos: 50 });
    expect(r.porDia).toContainEqual({ data: '2026-11-03', minutos: 0 });
    expect(r.porDisciplina).toEqual([
      { disciplina: 'Cálculo', minutos: 50, sessoes: 2, percentual: 50 },
      { disciplina: 'Física', minutos: 50, sessoes: 1, percentual: 50 },
    ]);
  });

  it('gerarRelatorioPeriodo_quandoStatusNaoConcluida_deveIgnorarSessao', () => {
    const sessoes = [
      sessao(2026, 10, 3, 40, { status: 'cancelada' }),
      sessao(2026, 10, 3, 40, { status: 'em_andamento' }),
      sessao(2026, 10, 3, 25, { status: 'concluida' }),
    ];
    const r = gerarRelatorioPeriodo(sessoes, SEMANA);
    expect(r.totalMinutos).toBe(25);
    expect(r.totalSessoes).toBe(1);
  });

  it('gerarRelatorioPeriodo_quandoStatusAusenteOuNulo_deveContarSessao', () => {
    const sessoes = [
      sessao(2026, 10, 3, 10),
      sessao(2026, 10, 3, 15, { status: null }),
      sessao(2026, 10, 3, 5, { status: '' }),
    ];
    const r = gerarRelatorioPeriodo(sessoes, SEMANA);
    expect(r.totalSessoes).toBe(3);
    expect(r.totalMinutos).toBe(30);
  });

  it('gerarRelatorioPeriodo_quandoSessaoNoInicioDoIntervalo_deveIncluir', () => {
    const s = { data_inicio: new Date(2026, 10, 2, 0, 0).toISOString(), duracao_efetiva_min: 10 };
    const r = gerarRelatorioPeriodo([s], SEMANA);
    expect(r.totalSessoes).toBe(1);
    expect(r.porDia[0]).toEqual({ data: '2026-11-02', minutos: 10 });
  });

  it('gerarRelatorioPeriodo_quandoSessaoUmMinutoAntesDoInicio_deveIgnorar', () => {
    const s = { data_inicio: new Date(2026, 10, 1, 23, 59).toISOString(), duracao_efetiva_min: 10 };
    expect(gerarRelatorioPeriodo([s], SEMANA).totalSessoes).toBe(0);
  });

  it('gerarRelatorioPeriodo_quandoSessaoNoUltimoMinutoDoUltimoDia_deveIncluir', () => {
    const s = { data_inicio: new Date(2026, 10, 8, 23, 59).toISOString(), duracao_efetiva_min: 10 };
    const r = gerarRelatorioPeriodo([s], SEMANA);
    expect(r.totalSessoes).toBe(1);
    expect(r.porDia[6]).toEqual({ data: '2026-11-08', minutos: 10 });
  });

  it('gerarRelatorioPeriodo_quandoSessaoExatamenteNoFimExclusivo_deveIgnorar', () => {
    const s = { data_inicio: new Date(2026, 10, 9, 0, 0).toISOString(), duracao_efetiva_min: 10 };
    expect(gerarRelatorioPeriodo([s], SEMANA).totalSessoes).toBe(0);
  });

  it('gerarRelatorioPeriodo_quandoDataInvalida_deveIgnorarSessao', () => {
    const r = gerarRelatorioPeriodo([{ data_inicio: 'lixo', duracao_efetiva_min: 10 }], SEMANA);
    expect(r.totalSessoes).toBe(0);
    expect(r.totalMinutos).toBe(0);
  });

  it('gerarRelatorioPeriodo_quandoDuracaoNulaOuInvalida_deveContarSessaoCom0Minutos', () => {
    const sessoes = [
      sessao(2026, 10, 3, null),
      sessao(2026, 10, 3, Number.NaN),
      { data_inicio: new Date(2026, 10, 3, 9).toISOString(), duracao_efetiva_min: 'abc' as unknown as number },
    ];
    const r = gerarRelatorioPeriodo(sessoes, SEMANA);
    expect(r.totalSessoes).toBe(3);
    expect(r.totalMinutos).toBe(0);
    expect(r.diasEstudados).toBe(0);
  });

  it('gerarRelatorioPeriodo_quandoDuracaoNegativa_deveTratarComoZero', () => {
    const r = gerarRelatorioPeriodo([sessao(2026, 10, 3, -20), sessao(2026, 10, 3, 10)], SEMANA);
    expect(r.totalMinutos).toBe(10);
    expect(r.totalSessoes).toBe(2);
  });

  it('gerarRelatorioPeriodo_quandoDuracaoFracionaria_deveArredondarCadaSessao', () => {
    const r = gerarRelatorioPeriodo([sessao(2026, 10, 3, 25.5), sessao(2026, 10, 3, 10.4)], SEMANA);
    expect(r.totalMinutos).toBe(36); // 26 + 10
  });

  it('gerarRelatorioPeriodo_quandoDisciplinaAusenteVaziaOuEspacos_deveAgruparEmGeral', () => {
    const sessoes = [
      sessao(2026, 10, 3, 10),
      sessao(2026, 10, 3, 10, { disciplina_nome: null }),
      sessao(2026, 10, 3, 10, { disciplina_nome: '' }),
      sessao(2026, 10, 3, 10, { disciplina_nome: '   ' }),
    ];
    const r = gerarRelatorioPeriodo(sessoes, SEMANA);
    expect(r.porDisciplina).toEqual([{ disciplina: 'Geral', minutos: 40, sessoes: 4, percentual: 100 }]);
  });

  it('gerarRelatorioPeriodo_quandoNomeDeDisciplinaComEspacos_deveAparar', () => {
    const sessoes = [
      sessao(2026, 10, 3, 10, { disciplina_nome: ' Cálculo ' }),
      sessao(2026, 10, 3, 10, { disciplina_nome: 'Cálculo' }),
    ];
    const r = gerarRelatorioPeriodo(sessoes, SEMANA);
    expect(r.porDisciplina).toHaveLength(1);
    expect(r.porDisciplina[0].disciplina).toBe('Cálculo');
    expect(r.porDisciplina[0].sessoes).toBe(2);
  });

  it('gerarRelatorioPeriodo_quandoPercentualNaoExato_deveArredondarParaOMaisProximo', () => {
    const sessoes = [
      sessao(2026, 10, 3, 1, { disciplina_nome: 'A' }),
      sessao(2026, 10, 3, 2, { disciplina_nome: 'B' }),
    ];
    const r = gerarRelatorioPeriodo(sessoes, SEMANA);
    expect(r.porDisciplina).toEqual([
      { disciplina: 'B', minutos: 2, sessoes: 1, percentual: 67 },
      { disciplina: 'A', minutos: 1, sessoes: 1, percentual: 33 },
    ]);
  });

  it('gerarRelatorioPeriodo_quandoSessoesSemMinutos_devePercentualZero', () => {
    const r = gerarRelatorioPeriodo([sessao(2026, 10, 3, 0, { disciplina_nome: 'A' })], SEMANA);
    expect(r.porDisciplina).toEqual([{ disciplina: 'A', minutos: 0, sessoes: 1, percentual: 0 }]);
  });

  it('gerarRelatorioPeriodo_quandoDisciplinasEmpatadas_deveOrdenarPorMinutosEDepoisPorNome', () => {
    const sessoes = [
      sessao(2026, 10, 3, 10, { disciplina_nome: 'Zoologia' }),
      sessao(2026, 10, 3, 10, { disciplina_nome: 'Álgebra' }),
      sessao(2026, 10, 3, 30, { disciplina_nome: 'Música' }),
    ];
    const r = gerarRelatorioPeriodo(sessoes, SEMANA);
    expect(r.porDisciplina.map((l) => l.disciplina)).toEqual(['Música', 'Álgebra', 'Zoologia']);
  });

  it('gerarRelatorioPeriodo_quandoMediaNaoInteira_deveArredondarParaOMaisProximo', () => {
    // 4/7 = 0,57 -> 1 ; 10/7 = 1,43 -> 1 ; 11/7 = 1,57 -> 2
    expect(gerarRelatorioPeriodo([sessao(2026, 10, 3, 4)], SEMANA).mediaMinutosPorDia).toBe(1);
    expect(gerarRelatorioPeriodo([sessao(2026, 10, 3, 10)], SEMANA).mediaMinutosPorDia).toBe(1);
    expect(gerarRelatorioPeriodo([sessao(2026, 10, 3, 11)], SEMANA).mediaMinutosPorDia).toBe(2);
  });

  it('gerarRelatorioPeriodo_quandoMesCompleto_deveGerar30DiasEFimNoUltimoDia', () => {
    const r = gerarRelatorioPeriodo([sessao(2026, 10, 30, 30)], intervaloDoPeriodo('mes', TERCA));
    expect(r.inicio).toBe('2026-11-01');
    expect(r.fim).toBe('2026-11-30');
    expect(r.porDia).toHaveLength(30);
    expect(r.porDia[29]).toEqual({ data: '2026-11-30', minutos: 30 });
    expect(r.mediaMinutosPorDia).toBe(1);
  });

  it('gerarRelatorioPeriodo_quandoSessoesDeOutroMes_deveIgnorarNoRelatorioMensal', () => {
    const intervalo = intervaloDoPeriodo('mes', TERCA);
    const r = gerarRelatorioPeriodo([sessao(2026, 9, 31, 60), sessao(2026, 11, 1, 60)], intervalo);
    expect(r.totalSessoes).toBe(0);
  });

  it('gerarRelatorioPeriodo_quandoIntervaloPersonalizadoDeUmDia_deveTerUmRegistroEMediaIgualAoTotal', () => {
    const intervalo = intervaloPersonalizado('2026-11-03', '2026-11-03');
    const r = gerarRelatorioPeriodo([sessao(2026, 10, 3, 45)], intervalo);
    expect(r.inicio).toBe('2026-11-03');
    expect(r.fim).toBe('2026-11-03');
    expect(r.porDia).toEqual([{ data: '2026-11-03', minutos: 45 }]);
    expect(r.mediaMinutosPorDia).toBe(45);
  });

  it('gerarRelatorioPeriodo_quandoIntervaloVazio_deveUsarPeloMenosUmDia', () => {
    const d = new Date(2026, 10, 3);
    const r = gerarRelatorioPeriodo([], { inicio: d, fim: d });
    expect(r.porDia).toHaveLength(1);
    expect(r.mediaMinutosPorDia).toBe(0);
  });

  it('gerarRelatorioPeriodo_quandoDiasSemEstudo_deveContarApenasDiasComMinutos', () => {
    const sessoes = [sessao(2026, 10, 3, 10), sessao(2026, 10, 3, 10, {}, 20), sessao(2026, 10, 5, 0)];
    const r = gerarRelatorioPeriodo(sessoes, SEMANA);
    expect(r.diasEstudados).toBe(1);
    expect(r.totalSessoes).toBe(3);
  });
});

describe('relatorioParaCSV', () => {
  const base: RelatorioPeriodo = {
    inicio: '2026-11-02',
    fim: '2026-11-03',
    totalMinutos: 90,
    totalSessoes: 2,
    diasEstudados: 1,
    mediaMinutosPorDia: 45,
    porDisciplina: [{ disciplina: 'Matemática', minutos: 90, sessoes: 2, percentual: 100 }],
    porDia: [
      { data: '2026-11-02', minutos: 90 },
      { data: '2026-11-03', minutos: 0 },
    ],
  };

  it('relatorioParaCSV_quandoRelatorioSimples_deveGerarEstruturaCompletaComCRLF', () => {
    // Act
    const csv = relatorioParaCSV(base);
    // Assert
    expect(csv).toBe(
      [
        'Relatório de estudos Study Flow',
        'Período;2026-11-02 a 2026-11-03',
        'Total de minutos;90',
        'Total de sessões;2',
        'Dias estudados;1',
        'Média de minutos por dia;45',
        '',
        'Disciplina;Minutos;Sessões;Percentual',
        'Matemática;90;2;100%',
        '',
        'Data;Minutos',
        '2026-11-02;90',
        '2026-11-03;0',
        '',
      ].join('\r\n'),
    );
  });

  it('relatorioParaCSV_quandoGerado_deveUsarSomenteCRLFComoQuebraDeLinha', () => {
    const csv = relatorioParaCSV(base);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('relatorioParaCSV_quandoSemDisciplinas_deveManterCabecalhosEVazioEntreSecoes', () => {
    const csv = relatorioParaCSV({ ...base, porDisciplina: [], porDia: [] });
    expect(csv).toContain('Disciplina;Minutos;Sessões;Percentual\r\n\r\nData;Minutos\r\n');
  });

  it('relatorioParaCSV_quandoNomeComPontoEVirgula_deveEnvolverEmAspas', () => {
    const csv = relatorioParaCSV({
      ...base,
      porDisciplina: [{ disciplina: 'Cálculo; Parte 1', minutos: 10, sessoes: 1, percentual: 100 }],
    });
    expect(csv).toContain('"Cálculo; Parte 1";10;1;100%');
  });

  it('relatorioParaCSV_quandoNomeComAspas_deveDuplicarAspasEEnvolver', () => {
    const csv = relatorioParaCSV({
      ...base,
      porDisciplina: [{ disciplina: 'Prova "final"', minutos: 10, sessoes: 1, percentual: 100 }],
    });
    expect(csv).toContain('"Prova ""final""";10;1;100%');
  });

  it('relatorioParaCSV_quandoNomeComQuebraDeLinha_deveEnvolverEmAspas', () => {
    const lf = relatorioParaCSV({
      ...base,
      porDisciplina: [{ disciplina: 'Linha1\nLinha2', minutos: 1, sessoes: 1, percentual: 100 }],
    });
    const cr = relatorioParaCSV({
      ...base,
      porDisciplina: [{ disciplina: 'A\rB', minutos: 1, sessoes: 1, percentual: 100 }],
    });
    expect(lf).toContain('"Linha1\nLinha2";1;1;100%');
    expect(cr).toContain('"A\rB";1;1;100%');
  });

  it('relatorioParaCSV_quandoNomeSemCaracteresEspeciais_deveNaoUsarAspas', () => {
    const csv = relatorioParaCSV(base);
    expect(csv).not.toContain('"');
  });
});

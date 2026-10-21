import { describe, it, expect } from 'vitest';
import {
  gerarCronograma,
  validarRotina,
  CronogramaError,
  type DisciplinaPlanejamento,
  type RotinaSlot,
  type BlocoEstudo,
} from './scheduler';

// 26/10/2026 é uma segunda-feira (horário local).
const SEGUNDA = new Date(2026, 9, 26);

const slot = (dia: number, ini: string, fim: string): RotinaSlot => ({
  dia_semana: dia,
  hora_inicio: ini,
  hora_fim: fim,
});

const disc = (id: string, peso?: number, proximaProva?: string | null): DisciplinaPlanejamento => ({
  id,
  nome: `Disciplina ${id}`,
  peso,
  proximaProva,
});

const contar = (blocos: BlocoEstudo[]) => {
  const mapa: Record<string, number> = {};
  blocos.forEach((b) => {
    mapa[b.disciplina_id] = (mapa[b.disciplina_id] ?? 0) + 1;
  });
  return mapa;
};

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const capturar = (fn: () => unknown): CronogramaError => {
  try {
    fn();
  } catch (e) {
    return e as CronogramaError;
  }
  throw new Error('Era esperado que a função lançasse um erro.');
};

describe('scheduler.ts - Suíte de Testes Unitários', () => {
  describe('validarRotina', () => {
    it('validarRotina_quandoRotinaValida_deveRetornarListaVazia', () => {
      // Arrange
      const slots = [slot(1, '19:00', '21:00'), slot(1, '21:00', '22:00'), slot(3, '08:00', '10:00')];

      // Act
      const erros = validarRotina(slots);

      // Assert
      expect(erros).toEqual([]);
    });

    it('validarRotina_quandoListaVazia_deveRetornarListaVazia', () => {
      // Arrange / Act
      const erros = validarRotina([]);

      // Assert
      expect(erros).toEqual([]);
    });

    it('validarRotina_quandoFimIgualAoInicio_deveRetornarErroDeIntervalo', () => {
      // Arrange
      const slots = [slot(2, '10:00', '10:00')];

      // Act
      const erros = validarRotina(slots);

      // Assert
      expect(erros).toEqual(['O horário de fim deve ser posterior ao horário de início.']);
    });

    it('validarRotina_quandoFimAnteriorAoInicio_deveRetornarErroDeIntervalo', () => {
      // Arrange
      const slots = [slot(2, '22:00', '19:00')];

      // Act
      const erros = validarRotina(slots);

      // Assert
      expect(erros).toHaveLength(1);
      expect(erros[0]).toContain('posterior');
    });

    it('validarRotina_quandoHorarioForaDoFormato_deveRetornarErroDeFormato', () => {
      // Arrange
      const slots = [slot(2, '25:00', '26:00'), slot(4, '', '10:00')];

      // Act
      const erros = validarRotina(slots);

      // Assert
      expect(erros).toHaveLength(2);
      expect(erros[0]).toContain('Terça-feira');
      expect(erros[1]).toContain('Quinta-feira');
    });

    it('validarRotina_quandoDiaDaSemanaInvalido_deveRetornarErroDeDia', () => {
      // Arrange
      const slots = [slot(7, '10:00', '11:00'), slot(-1, '10:00', '11:00'), slot(1.5, '10:00', '11:00')];

      // Act
      const erros = validarRotina(slots);

      // Assert
      expect(erros).toEqual(['Dia da semana inválido.', 'Dia da semana inválido.', 'Dia da semana inválido.']);
    });

    it('validarRotina_quandoHorariosSeSobrepoemNoMesmoDia_deveRetornarErroDeSobreposicao', () => {
      // Arrange
      const slots = [slot(1, '19:00', '21:00'), slot(1, '20:30', '22:00')];

      // Act
      const erros = validarRotina(slots);

      // Assert
      expect(erros).toHaveLength(1);
      expect(erros[0]).toContain('se sobrepõem');
      expect(erros[0]).toContain('Segunda-feira');
    });

    it('validarRotina_quandoHorariosSaoContiguosOuEmDiasDiferentes_naoDeveAcusarSobreposicao', () => {
      // Arrange
      const slots = [slot(1, '19:00', '20:00'), slot(1, '20:00', '21:00'), slot(2, '19:00', '21:00')];

      // Act
      const erros = validarRotina(slots);

      // Assert
      expect(erros).toEqual([]);
    });

    it('validarRotina_quandoHorarioMenorQueODuracaoDoBloco_deveRetornarErro', () => {
      // Arrange
      const slots = [slot(5, '10:00', '10:30')];

      // Act
      const erros = validarRotina(slots, 50);

      // Assert
      expect(erros).toHaveLength(1);
      expect(erros[0]).toContain('menor que a duração do bloco (50 min)');
    });

    it('validarRotina_quandoDuracaoNaoInformada_naoDeveExigirTamanhoMinimo', () => {
      // Arrange
      const slots = [slot(5, '10:00', '10:30')];

      // Act
      const erros = validarRotina(slots);

      // Assert
      expect(erros).toEqual([]);
    });
  });

  describe('gerarCronograma - divisão em blocos', () => {
    it('gerarCronograma_quandoHorarioComporta2Blocos_deveSepararPorIntervalo', () => {
      // Arrange (19:00-21:00: 19:00-19:50, 20:00-20:50)
      const rotina = [slot(1, '19:00', '21:00')];

      // Act
      const blocos = gerarCronograma({ disciplinas: [disc('A')], rotina, dataInicio: SEGUNDA, semanas: 1 });

      // Assert
      expect(blocos).toHaveLength(2);
      expect(hhmm(blocos[0].data_inicio)).toBe('19:00');
      expect(hhmm(blocos[0].data_fim)).toBe('19:50');
      expect(hhmm(blocos[1].data_inicio)).toBe('20:00');
      expect(hhmm(blocos[1].data_fim)).toBe('20:50');
    });

    it('gerarCronograma_quandoSobraMenorQueUmBloco_deveDescartarOResto', () => {
      // Arrange (19:00-20:55: segundo bloco terminaria às 20:50, cabe; terceiro não)
      const rotina = [slot(1, '19:00', '20:55')];

      // Act
      const blocos = gerarCronograma({ disciplinas: [disc('A')], rotina, dataInicio: SEGUNDA, semanas: 1 });

      // Assert
      expect(blocos).toHaveLength(2);
    });

    it('gerarCronograma_quandoUmHorarioNaoComportaNenhumBloco_deveIgnorarEUsarOsDemais', () => {
      // Arrange
      const rotina = [slot(1, '08:00', '08:30'), slot(2, '19:00', '19:50')];

      // Act
      const blocos = gerarCronograma({ disciplinas: [disc('A')], rotina, dataInicio: SEGUNDA, semanas: 1 });

      // Assert
      expect(blocos).toHaveLength(1);
      expect(new Date(blocos[0].data_inicio).getDay()).toBe(2);
    });

    it('gerarCronograma_quandoNenhumHorarioComportaBloco_deveLancarSemBlocos', () => {
      // Arrange
      const rotina = [slot(1, '08:00', '08:30')];

      // Act
      const erro = capturar(() => gerarCronograma({ disciplinas: [disc('A')], rotina, dataInicio: SEGUNDA, semanas: 2 }));

      // Assert
      expect(erro).toBeInstanceOf(CronogramaError);
      expect(erro.code).toBe('SEM_BLOCOS');
    });

    it('gerarCronograma_quandoDuracaoEIntervaloPersonalizados_deveRespeitarOsValores', () => {
      // Arrange (09:00-11:00 com 30min + 15min: 09:00, 09:45, 10:30)
      const rotina = [slot(1, '09:00', '11:00')];

      // Act
      const blocos = gerarCronograma({
        disciplinas: [disc('A')],
        rotina,
        dataInicio: SEGUNDA,
        semanas: 1,
        duracaoBlocoMin: 30,
        intervaloMin: 15,
      });

      // Assert
      expect(blocos.map((b) => hhmm(b.data_inicio))).toEqual(['09:00', '09:45', '10:30']);
      expect(hhmm(blocos[2].data_fim)).toBe('11:00');
    });

    it('gerarCronograma_quandoIntervaloZero_deveGerarBlocosAdjacentes', () => {
      // Arrange
      const rotina = [slot(1, '09:00', '10:40')];

      // Act
      const blocos = gerarCronograma({
        disciplinas: [disc('A')],
        rotina,
        dataInicio: SEGUNDA,
        semanas: 1,
        intervaloMin: 0,
      });

      // Assert
      expect(blocos.map((b) => hhmm(b.data_inicio))).toEqual(['09:00', '09:50']);
    });
  });

  describe('gerarCronograma - período e ordenação', () => {
    it('gerarCronograma_quandoVariasSemanas_deveRepetirARotinaEmCadaSemana', () => {
      // Arrange
      const rotina = [slot(1, '19:00', '19:50'), slot(3, '19:00', '19:50')];

      // Act
      const blocos = gerarCronograma({ disciplinas: [disc('A'), disc('B')], rotina, dataInicio: SEGUNDA, semanas: 4 });

      // Assert
      expect(blocos).toHaveLength(8);
      const dias = blocos.map((b) => new Date(b.data_inicio).getDay());
      expect(dias).toEqual([1, 3, 1, 3, 1, 3, 1, 3]);
    });

    it('gerarCronograma_quandoSlotsFornecidosForaDeOrdem_deveRetornarBlocosEmOrdemCronologica', () => {
      // Arrange
      const rotina = [slot(5, '10:00', '11:00'), slot(0, '09:00', '12:00'), slot(1, '20:00', '21:00'), slot(1, '08:00', '09:00')];

      // Act
      const blocos = gerarCronograma({ disciplinas: [disc('A'), disc('B')], rotina, dataInicio: SEGUNDA, semanas: 2 });

      // Assert
      const tempos = blocos.map((b) => new Date(b.data_inicio).getTime());
      expect([...tempos].sort((a, b) => a - b)).toEqual(tempos);
    });

    it('gerarCronograma_quandoDataInicioTemHorario_deveConsiderarApenasODia', () => {
      // Arrange (segunda às 23:30: o horário das 19:00 do mesmo dia ainda entra)
      const rotina = [slot(1, '19:00', '19:50')];
      const inicio = new Date(2026, 9, 26, 23, 30);

      // Act
      const blocos = gerarCronograma({ disciplinas: [disc('A')], rotina, dataInicio: inicio, semanas: 1 });

      // Assert
      expect(blocos).toHaveLength(1);
      expect(new Date(blocos[0].data_inicio).getDate()).toBe(26);
    });

    it('gerarCronograma_quandoPeriodoDeUmaSemana_naoDeveIncluirOitavoDia', () => {
      // Arrange (segunda a segunda: a segunda seguinte está fora do período)
      const rotina = [slot(1, '19:00', '19:50')];

      // Act
      const blocos = gerarCronograma({ disciplinas: [disc('A')], rotina, dataInicio: SEGUNDA, semanas: 1 });

      // Assert
      expect(blocos).toHaveLength(1);
    });

    it('gerarCronograma_quandoBlocosGerados_deveSerializarEmIsoEPreservarDuracao', () => {
      // Arrange
      const rotina = [slot(1, '19:00', '19:50')];

      // Act
      const [bloco] = gerarCronograma({ disciplinas: [disc('A')], rotina, dataInicio: SEGUNDA, semanas: 1 });

      // Assert
      expect(new Date(bloco.data_inicio).toISOString()).toBe(bloco.data_inicio);
      expect(new Date(bloco.data_fim).getTime() - new Date(bloco.data_inicio).getTime()).toBe(50 * 60000);
      expect(bloco.disciplina_nome).toBe('Disciplina A');
    });
  });

  describe('gerarCronograma - distribuição entre disciplinas', () => {
    const rotinaDiaria = [0, 1, 2, 3, 4, 5, 6].map((d) => slot(d, '08:00', '12:00'));

    it('gerarCronograma_quandoPesosIguais_deveDistribuirDeFormaUniforme', () => {
      // Arrange
      const disciplinas = [disc('A'), disc('B'), disc('C')];

      // Act
      const blocos = gerarCronograma({ disciplinas, rotina: rotinaDiaria, dataInicio: SEGUNDA, semanas: 1 });
      const total = contar(blocos);

      // Assert (7 dias x 4 blocos = 28)
      expect(blocos).toHaveLength(28);
      const valores = Object.values(total);
      expect(Math.max(...valores) - Math.min(...valores)).toBeLessThanOrEqual(1);
    });

    it('gerarCronograma_quandoPesosDiferentes_deveDistribuirProporcionalmenteAoPeso', () => {
      // Arrange (3:2:1 => ~50%, ~33%, ~17% de 56 blocos)
      const disciplinas = [disc('A', 3), disc('B', 2), disc('C', 1)];

      // Act
      const blocos = gerarCronograma({ disciplinas, rotina: rotinaDiaria, dataInicio: SEGUNDA, semanas: 2 });
      const total = contar(blocos);

      // Assert
      expect(blocos).toHaveLength(56);
      expect(total.A).toBeGreaterThan(total.B);
      expect(total.B).toBeGreaterThan(total.C);
      expect(Math.abs(total.A - 28)).toBeLessThanOrEqual(2);
      expect(Math.abs(total.B - 18.67)).toBeLessThanOrEqual(2);
      expect(Math.abs(total.C - 9.33)).toBeLessThanOrEqual(2);
    });

    it('gerarCronograma_quandoPesoAusenteOuForaDoIntervalo_deveAplicarLimites', () => {
      // Arrange (undefined => 1; 99 => 5; 0 => 1; NaN => 1)
      const disciplinas = [disc('A', 99), disc('B', undefined), disc('C', 0), disc('D', Number.NaN)];

      // Act
      const blocos = gerarCronograma({ disciplinas, rotina: rotinaDiaria, dataInicio: SEGUNDA, semanas: 2 });
      const total = contar(blocos);

      // Assert (A tem peso efetivo 5 contra 1+1+1)
      expect(total.A).toBeGreaterThan(total.B);
      expect(Math.abs(total.B - total.C)).toBeLessThanOrEqual(1);
      expect(Math.abs(total.C - total.D)).toBeLessThanOrEqual(1);
    });

    it('gerarCronograma_quandoProvaDentroDoPeriodo_deveAumentarABalanceAteAData', () => {
      // Arrange (mesmo peso; prova de B na quarta da primeira semana)
      const disciplinasSemProva = [disc('A', 1), disc('B', 1), disc('C', 1)];
      const disciplinasComProva = [disc('A', 1), disc('B', 1, '2026-10-28'), disc('C', 1)];
      const rotina = [slot(1, '08:00', '12:00'), slot(2, '08:00', '12:00'), slot(3, '08:00', '12:00')];

      // Act
      const sem = gerarCronograma({ disciplinas: disciplinasSemProva, rotina, dataInicio: SEGUNDA, semanas: 1 });
      const com = gerarCronograma({ disciplinas: disciplinasComProva, rotina, dataInicio: SEGUNDA, semanas: 1 });

      // Assert
      expect(Math.abs(contar(sem).B - contar(sem).A)).toBeLessThanOrEqual(1);
      expect(contar(com).B).toBeGreaterThan(contar(com).A);
      expect(contar(com).B).toBeGreaterThan(contar(com).C);
    });

    it('gerarCronograma_quandoBlocoPosteriorAProva_deveUsarPesoNormal', () => {
      // Arrange (prova de B na segunda; depois dela os pesos voltam a ser iguais)
      const disciplinas = [disc('A', 1), disc('B', 1, '2026-10-26'), disc('C', 1)];
      const rotina = [slot(1, '08:00', '12:00'), slot(5, '08:00', '12:00'), slot(6, '08:00', '12:00')];

      // Act
      const blocos = gerarCronograma({ disciplinas, rotina, dataInicio: SEGUNDA, semanas: 1 });
      const depois = blocos.filter((b) => new Date(b.data_inicio).getDay() !== 1);
      const total = contar(depois);

      // Assert
      const valores = Object.values(total);
      expect(Math.max(...valores) - Math.min(...valores)).toBeLessThanOrEqual(1);
    });

    it('gerarCronograma_quandoProvaForaDoPeriodo_naoDeveAplicarReforco', () => {
      // Arrange (prova antes do início e depois do fim do período)
      const rotina = [slot(1, '08:00', '12:00'), slot(2, '08:00', '12:00')];
      const disciplinas = [disc('A', 1, '2026-10-01'), disc('B', 1, '2026-12-31'), disc('C', 1, null)];

      // Act
      const blocos = gerarCronograma({ disciplinas, rotina, dataInicio: SEGUNDA, semanas: 1 });
      const total = contar(blocos);
      const valores = Object.values(total);

      // Assert
      expect(Math.max(...valores) - Math.min(...valores)).toBeLessThanOrEqual(1);
    });

    it('gerarCronograma_quandoProvaNoUltimoDiaDoPeriodo_deveAplicarReforco', () => {
      // Arrange (período de 1 semana a partir de 26/10 termina em 01/11)
      const rotina = [slot(0, '08:00', '12:00'), slot(1, '08:00', '12:00')];
      const disciplinas = [disc('A', 1), disc('B', 1, '2026-11-01'), disc('C', 1)];

      // Act
      const blocos = gerarCronograma({ disciplinas, rotina, dataInicio: SEGUNDA, semanas: 1 });
      const total = contar(blocos);

      // Assert
      expect(total.B).toBeGreaterThan(total.A);
      expect(total.B).toBeGreaterThan(total.C);
    });

    it('gerarCronograma_quandoHaMaisDeUmaDisciplina_naoDeveRepetirDisciplinaEmBlocosConsecutivos', () => {
      // Arrange (pesos muito desbalanceados forçariam repetição sem a regra)
      const disciplinas = [disc('A', 5), disc('B', 1), disc('C', 1)];

      // Act
      const blocos = gerarCronograma({ disciplinas, rotina: rotinaDiaria, dataInicio: SEGUNDA, semanas: 3 });

      // Assert
      for (let i = 1; i < blocos.length; i++) {
        expect(blocos[i].disciplina_id).not.toBe(blocos[i - 1].disciplina_id);
      }
    });

    it('gerarCronograma_quandoDuasDisciplinasComPesosDesiguais_deveAlternarSempre', () => {
      // Arrange
      const disciplinas = [disc('A', 5), disc('B', 1)];

      // Act
      const blocos = gerarCronograma({ disciplinas, rotina: rotinaDiaria, dataInicio: SEGUNDA, semanas: 1 });

      // Assert
      blocos.forEach((b, i) => {
        if (i > 0) expect(b.disciplina_id).not.toBe(blocos[i - 1].disciplina_id);
      });
      expect(blocos[0].disciplina_id).toBe('A');
    });

    it('gerarCronograma_quandoApenasUmaDisciplina_devePermitirRepeticao', () => {
      // Arrange
      const rotina = [slot(1, '08:00', '12:00')];

      // Act
      const blocos = gerarCronograma({ disciplinas: [disc('A')], rotina, dataInicio: SEGUNDA, semanas: 1 });

      // Assert
      expect(blocos).toHaveLength(4);
      expect(new Set(blocos.map((b) => b.disciplina_id))).toEqual(new Set(['A']));
    });
  });

  describe('gerarCronograma - determinismo', () => {
    it('gerarCronograma_quandoExecutadoDuasVezesComAsMesmasEntradas_deveRetornarResultadosIdenticos', () => {
      // Arrange
      const params = {
        disciplinas: [disc('A', 3), disc('B', 2, '2026-11-03'), disc('C', 1)],
        rotina: [slot(1, '19:00', '22:00'), slot(4, '08:00', '12:00')],
        dataInicio: SEGUNDA,
        semanas: 4,
      };

      // Act
      const primeiro = gerarCronograma(params);
      const segundo = gerarCronograma(params);

      // Assert
      expect(segundo).toEqual(primeiro);
    });

    it('gerarCronograma_quandoExecutado_naoDeveMutarAsEntradas', () => {
      // Arrange
      const disciplinas = [disc('A', 3), disc('B', 1)];
      const rotina = [slot(4, '08:00', '12:00'), slot(1, '19:00', '22:00')];
      const copiaDisc = JSON.parse(JSON.stringify(disciplinas));
      const copiaRotina = JSON.parse(JSON.stringify(rotina));
      const inicio = new Date(SEGUNDA);

      // Act
      gerarCronograma({ disciplinas, rotina, dataInicio: inicio, semanas: 2 });

      // Assert
      expect(disciplinas).toEqual(copiaDisc);
      expect(rotina).toEqual(copiaRotina);
      expect(inicio.getTime()).toBe(SEGUNDA.getTime());
    });
  });

  describe('gerarCronograma - erros', () => {
    const rotinaOk = [slot(1, '19:00', '20:00')];

    it('gerarCronograma_quandoSemDisciplinas_deveLancarSemDisciplinas', () => {
      // Arrange / Act
      const erro = capturar(() => gerarCronograma({ disciplinas: [], rotina: rotinaOk, dataInicio: SEGUNDA, semanas: 1 }));

      // Assert
      expect(erro).toBeInstanceOf(CronogramaError);
      expect(erro).toBeInstanceOf(Error);
      expect(erro.name).toBe('CronogramaError');
      expect(erro.code).toBe('SEM_DISCIPLINAS');
      expect(erro.message).toBe('Cadastre ao menos uma disciplina antes de gerar o cronograma.');
    });

    it('gerarCronograma_quandoRotinaVazia_deveLancarRotinaVazia', () => {
      // Arrange / Act
      const erro = capturar(() => gerarCronograma({ disciplinas: [disc('A')], rotina: [], dataInicio: SEGUNDA, semanas: 1 }));

      // Assert
      expect(erro.code).toBe('ROTINA_VAZIA');
      expect(erro.message).toBe('Cadastre sua rotina semanal antes de gerar o cronograma.');
    });

    it('gerarCronograma_quandoRotinaInvalida_deveLancarRotinaInvalidaComDetalhes', () => {
      // Arrange
      const rotina = [slot(1, '19:00', '21:00'), slot(1, '20:00', '22:00'), slot(2, '10:00', '09:00')];

      // Act
      const erro = capturar(() => gerarCronograma({ disciplinas: [disc('A')], rotina, dataInicio: SEGUNDA, semanas: 1 }));

      // Assert
      expect(erro.code).toBe('ROTINA_INVALIDA');
      expect(erro.detalhes).toHaveLength(2);
      expect(erro.message).toBe(erro.detalhes[0]);
    });

    it('gerarCronograma_quandoSemanasForaDoIntervalo_deveLancarParametrosInvalidos', () => {
      // Arrange
      const valores = [0, 9, 1.5, Number.NaN];

      valores.forEach((semanas) => {
        // Act
        const erro = capturar(() => gerarCronograma({ disciplinas: [disc('A')], rotina: rotinaOk, dataInicio: SEGUNDA, semanas }));

        // Assert
        expect(erro.code).toBe('PARAMETROS_INVALIDOS');
      });
    });

    it('gerarCronograma_quandoDataInicioInvalida_deveLancarParametrosInvalidos', () => {
      // Arrange
      const invalida = new Date('nao-e-data');

      // Act
      const erro = capturar(() => gerarCronograma({ disciplinas: [disc('A')], rotina: rotinaOk, dataInicio: invalida, semanas: 1 }));

      // Assert
      expect(erro.code).toBe('PARAMETROS_INVALIDOS');
    });

    it('gerarCronograma_quandoDuracaoOuIntervaloInvalidos_deveLancarParametrosInvalidos', () => {
      // Arrange
      const base = { disciplinas: [disc('A')], rotina: rotinaOk, dataInicio: SEGUNDA, semanas: 1 };

      // Act
      const duracaoZero = capturar(() => gerarCronograma({ ...base, duracaoBlocoMin: 0 }));
      const intervaloNegativo = capturar(() => gerarCronograma({ ...base, intervaloMin: -5 }));
      const duracaoInfinita = capturar(() => gerarCronograma({ ...base, duracaoBlocoMin: Number.POSITIVE_INFINITY }));

      // Assert
      expect(duracaoZero.code).toBe('PARAMETROS_INVALIDOS');
      expect(intervaloNegativo.code).toBe('PARAMETROS_INVALIDOS');
      expect(duracaoInfinita.code).toBe('PARAMETROS_INVALIDOS');
    });

    it('gerarCronograma_quandoEntradasNaoSaoListas_deveLancarErrosTipados', () => {
      // Arrange
      const semDisciplinas = { disciplinas: undefined as unknown as DisciplinaPlanejamento[], rotina: rotinaOk, dataInicio: SEGUNDA, semanas: 1 };
      const semRotina = { disciplinas: [disc('A')], rotina: undefined as unknown as RotinaSlot[], dataInicio: SEGUNDA, semanas: 1 };

      // Act
      const e1 = capturar(() => gerarCronograma(semDisciplinas));
      const e2 = capturar(() => gerarCronograma(semRotina));

      // Assert
      expect(e1.code).toBe('SEM_DISCIPLINAS');
      expect(e2.code).toBe('ROTINA_VAZIA');
    });
  });
});

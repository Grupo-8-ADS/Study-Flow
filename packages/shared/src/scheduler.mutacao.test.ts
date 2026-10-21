import { describe, it, expect } from 'vitest';
import { gerarCronograma, validarRotina, CronogramaError, type RotinaSlot } from './scheduler';

/**
 * Testes complementares guiados por mutacao (StrykerJS): fronteiras de periodo,
 * mensagens de erro, desempate e adjacencia de horarios.
 */
const slot = (dia: number, ini: string, fim: string): RotinaSlot => ({ dia_semana: dia, hora_inicio: ini, hora_fim: fim });
const capturar = (fn: () => unknown): CronogramaError => {
  try {
    fn();
  } catch (e) {
    return e as CronogramaError;
  }
  throw new Error('Era esperado que a funcao lancasse um erro.');
};

// 02/03/2026 e uma segunda-feira (mes < 10 exercita o zero a esquerda de chaveData).
const MARCO = new Date(2026, 2, 2);
const ROTINA_SEGUNDA = [slot(1, '08:00', '20:00')];
const sequencia = (proximaProva?: string | null) =>
  gerarCronograma({
    disciplinas: [
      { id: 'A', nome: 'A', peso: 1, proximaProva },
      { id: 'B', nome: 'B', peso: 1 },
      { id: 'C', nome: 'C', peso: 1 },
    ],
    rotina: ROTINA_SEGUNDA,
    dataInicio: MARCO,
    semanas: 1,
  })
    .map((b) => b.disciplina_id)
    .join('');

const SEM_PROVA = 'ABCABCABCABC';
const COM_PROVA = 'ABCABACABACA';

describe('scheduler.ts - testes de fronteira (mutacao)', () => {
  describe('validarRotina', () => {
    it('validarRotina_quandoSlotTemExatamenteADuracaoDoBloco_naoDeveReclamar', () => {
      expect(validarRotina([slot(1, '09:00', '09:50')], 50)).toEqual([]);
    });

    it('validarRotina_quandoSlotMaiorQueODuracao_naoDeveReclamar', () => {
      expect(validarRotina([slot(1, '09:00', '10:00')], 50)).toEqual([]);
    });

    it('validarRotina_quandoSlotMenorQueODuracao_deveInformarRotuloEDuracao', () => {
      expect(validarRotina([slot(1, '09:00', '09:49')], 50)).toEqual([
        'O horário Segunda-feira 09:00 – 09:49 é menor que a duração do bloco (50 min).',
      ]);
    });

    it('validarRotina_quandoDuracaoNaoInformada_naoDeveValidarTamanhoMinimo', () => {
      expect(validarRotina([slot(1, '09:00', '09:05')])).toEqual([]);
    });

    it('validarRotina_quandoHorariosSaoAdjacentesNaOrdemInversa_naoDeveAcusarSobreposicao', () => {
      expect(validarRotina([slot(1, '10:00', '11:00'), slot(1, '09:00', '10:00')])).toEqual([]);
    });

    it('validarRotina_quandoSobrepoeNaOrdemInversa_deveAcusarSobreposicao', () => {
      expect(validarRotina([slot(1, '10:00', '11:00'), slot(1, '10:30', '10:45')])).toHaveLength(1);
    });
  });

  describe('CronogramaError', () => {
    it('CronogramaError_quandoSemDetalhes_deveTerListaVaziaEPrototipoCorreto', () => {
      const e = new CronogramaError('SEM_BLOCOS', 'msg');
      expect(e.detalhes).toEqual([]);
      expect(e.name).toBe('CronogramaError');
      expect(e).toBeInstanceOf(CronogramaError);
      expect(e).toBeInstanceOf(Error);
    });
  });

  describe('gerarCronograma - mensagens e limites de parametros', () => {
    const base = { disciplinas: [{ id: 'A', nome: 'A' }], rotina: ROTINA_SEGUNDA, dataInicio: MARCO, semanas: 1 };

    it('gerarCronograma_quandoDataInicioInvalida_deveInformarMensagem', () => {
      const e = capturar(() => gerarCronograma({ ...base, dataInicio: new Date('x') }));
      expect(e.code).toBe('PARAMETROS_INVALIDOS');
      expect(e.message).toBe('Data de início inválida.');
      expect(e.detalhes).toEqual([]);
    });

    it('gerarCronograma_quandoSemanasForaDoIntervalo_deveInformarMensagemComLimites', () => {
      for (const semanas of [0, 9]) {
        const e = capturar(() => gerarCronograma({ ...base, semanas }));
        expect(e.code).toBe('PARAMETROS_INVALIDOS');
        expect(e.message).toBe('O número de semanas deve estar entre 1 e 8.');
      }
    });

    it('gerarCronograma_quandoSemanasNoLimiteSuperiorOuInferior_deveGerar', () => {
      expect(gerarCronograma({ ...base, semanas: 8 })).toHaveLength(8 * 12);
      expect(gerarCronograma({ ...base, semanas: 1 })).toHaveLength(12);
    });

    it('gerarCronograma_quandoDuracaoOuIntervaloInvalidos_deveInformarMensagem', () => {
      const e = capturar(() => gerarCronograma({ ...base, duracaoBlocoMin: 0 }));
      expect(e.message).toBe('Duração do bloco e intervalo devem ser positivos.');
      expect(capturar(() => gerarCronograma({ ...base, intervaloMin: -1 })).code).toBe('PARAMETROS_INVALIDOS');
    });

    it('gerarCronograma_quandoNenhumSlotComportaOBloco_deveInformarMensagemDeSemBlocos', () => {
      const e = capturar(() => gerarCronograma({ ...base, rotina: [slot(1, '09:00', '09:30')] }));
      expect(e.code).toBe('SEM_BLOCOS');
      expect(e.message).toBe('Nenhum horário da rotina comporta um bloco de estudo com a duração informada.');
    });
  });

  describe('gerarCronograma - janela do periodo e peso de prova', () => {
    it('sequencia_quandoSemProva_deveAlternarIgualmente', () => {
      expect(sequencia()).toBe(SEM_PROVA);
    });

    it.each(['2026-03-02', '2026-03-08', '2026-03-08T15:00:00Z'])(
      'sequencia_quandoProvaDentroDoPeriodo_%s_deveFavorecerADisciplina',
      (prova) => {
        expect(sequencia(prova)).toBe(COM_PROVA);
      },
    );

    it.each(['2026-03-01', '2026-03-09', '2026-03-10'])(
      'sequencia_quandoProvaForaDoPeriodo_%s_deveIgnorarAProva',
      (prova) => {
        expect(sequencia(prova)).toBe(SEM_PROVA);
      },
    );
  });

  describe('gerarCronograma - escolha da disciplina', () => {
    it('gerarCronograma_quandoSegundaDisciplinaTemMaiorPeso_deveComecarPorEla', () => {
      const blocos = gerarCronograma({
        disciplinas: [
          { id: 'A', nome: 'A', peso: 1 },
          { id: 'B', nome: 'B', peso: 5 },
        ],
        rotina: ROTINA_SEGUNDA,
        dataInicio: MARCO,
        semanas: 1,
      });
      expect(blocos[0].disciplina_id).toBe('B');
    });

    it('gerarCronograma_quandoPesosIguais_deveDesempatarPelaPrimeiraDisciplina', () => {
      const blocos = gerarCronograma({
        disciplinas: [
          { id: 'A', nome: 'A', peso: 3 },
          { id: 'B', nome: 'B', peso: 3 },
        ],
        rotina: ROTINA_SEGUNDA,
        dataInicio: MARCO,
        semanas: 1,
      });
      expect(blocos[0].disciplina_id).toBe('A');
    });
  });
});

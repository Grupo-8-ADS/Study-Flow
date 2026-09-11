import { describe, it, expect } from 'vitest';
import {
  isValidDateString,
  toDatabaseDate,
  formatDisplayDate,
  isValidTimeString,
  isTimeIntervalValid,
  applyDateMask,
  applyTimeMask,
} from './validation';

describe('validation.ts - Suíte de Testes Unitários Comportamentais', () => {
  describe('isValidDateString', () => {
    it('isValidDateString_quandoDataForFormatoBrasileiroValido_deveRetornarTrue', () => {
      // Arrange
      const dataValida = '15/09/2026';

      // Act
      const resultado = isValidDateString(dataValida);

      // Assert
      expect(resultado).toBe(true);
    });

    it('isValidDateString_quandoDataForIsoValida_deveRetornarTrue', () => {
      // Arrange
      const dataIso = '2026-09-15';

      // Act
      const resultado = isValidDateString(dataIso);

      // Assert
      expect(resultado).toBe(true);
    });

    it('isValidDateString_quandoAnoBissextoValido29Fev_deveRetornarTrue', () => {
      // Arrange (2024 é bissexto)
      const dataBissexta = '29/02/2024';

      // Act
      const resultado = isValidDateString(dataBissexta);

      // Assert
      expect(resultado).toBe(true);
    });

    it('isValidDateString_quandoAnoNaoBissexto29Fev_deveRetornarFalse', () => {
      // Arrange (2023 não é bissexto)
      const dataInvalida = '29/02/2023';

      // Act
      const resultado = isValidDateString(dataInvalida);

      // Assert
      expect(resultado).toBe(false);
    });

    it('isValidDateString_quandoDiaForInexistenteNoMes_deveRetornarFalse', () => {
      // Arrange (abril possui apenas 30 dias)
      const dataInvalida = '31/04/2026';

      // Act
      const resultado = isValidDateString(dataInvalida);

      // Assert
      expect(resultado).toBe(false);
    });

    it('isValidDateString_quandoMesForInvalido_deveRetornarFalse', () => {
      // Arrange
      const dataMesInvalido = '15/13/2026';

      // Act
      const resultado = isValidDateString(dataMesInvalido);

      // Assert
      expect(resultado).toBe(false);
    });

    it('isValidDateString_quandoStringForVaziaOuNula_deveRetornarFalse', () => {
      // Act & Assert
      expect(isValidDateString('')).toBe(false);
      expect(isValidDateString('   ')).toBe(false);
      expect(isValidDateString(null as unknown as string)).toBe(false);
      expect(isValidDateString(undefined as unknown as string)).toBe(false);
    });
  });

  describe('toDatabaseDate', () => {
    it('toDatabaseDate_quandoDataForFormatoBrasileiro_deveConverterParaIso', () => {
      // Arrange
      const dataBr = '15/09/2026';

      // Act
      const resultado = toDatabaseDate(dataBr);

      // Assert
      expect(resultado).toBe('2026-09-15');
    });

    it('toDatabaseDate_quandoDataJaForIso_deveRetornarMesmaString', () => {
      // Arrange
      const dataIso = '2026-09-15';

      // Act
      const resultado = toDatabaseDate(dataIso);

      // Assert
      expect(resultado).toBe('2026-09-15');
    });

    it('toDatabaseDate_quandoEntradaForNulaOuIndefinida_deveRetornarNull', () => {
      // Act & Assert
      expect(toDatabaseDate(null)).toBeNull();
      expect(toDatabaseDate(undefined)).toBeNull();
      expect(toDatabaseDate('')).toBeNull();
    });

    it('toDatabaseDate_quandoFormatoForInvalido_deveRetornarNull', () => {
      // Arrange
      const entradaInvalida = 'texto-aleatorio';

      // Act
      const resultado = toDatabaseDate(entradaInvalida);

      // Assert
      expect(resultado).toBeNull();
    });
  });

  describe('formatDisplayDate', () => {
    it('formatDisplayDate_quandoDataForIso_deveFormatarParaPadraoBrasileiro', () => {
      // Arrange
      const dataIso = '2026-09-15';

      // Act
      const resultado = formatDisplayDate(dataIso);

      // Assert
      expect(resultado).toBe('15/09/2026');
    });

    it('formatDisplayDate_quandoDataForTimestampCompletoIso_deveExtrairEFormatarApenasData', () => {
      // Arrange
      const isoTimestamp = '2026-09-15T14:30:00.000Z';

      // Act
      const resultado = formatDisplayDate(isoTimestamp);

      // Assert
      expect(resultado).toBe('15/09/2026');
    });

    it('formatDisplayDate_quandoDataJaEstiverFormatada_devePreservarFormato', () => {
      // Arrange
      const dataBr = '15/09/2026';

      // Act
      const resultado = formatDisplayDate(dataBr);

      // Assert
      expect(resultado).toBe('15/09/2026');
    });

    it('formatDisplayDate_quandoEntradaForNulaOuIndefinida_deveRetornarStringVazia', () => {
      // Act & Assert
      expect(formatDisplayDate(null)).toBe('');
      expect(formatDisplayDate(undefined)).toBe('');
    });
  });

  describe('isValidTimeString', () => {
    it('isValidTimeString_quandoHorarioValido24h_deveRetornarTrue', () => {
      // Act & Assert
      expect(isValidTimeString('00:00')).toBe(true);
      expect(isValidTimeString('08:30')).toBe(true);
      expect(isValidTimeString('14:45')).toBe(true);
      expect(isValidTimeString('23:59')).toBe(true);
    });

    it('isValidTimeString_quandoHoraForMaiorQue23_deveRetornarFalse', () => {
      // Act & Assert
      expect(isValidTimeString('24:00')).toBe(false);
      expect(isValidTimeString('25:15')).toBe(false);
    });

    it('isValidTimeString_quandoMinutoForMaiorQue59_deveRetornarFalse', () => {
      // Act & Assert
      expect(isValidTimeString('12:60')).toBe(false);
      expect(isValidTimeString('10:99')).toBe(false);
    });

    it('isValidTimeString_quandoStringForVaziaOuMalformada_deveRetornarFalse', () => {
      // Act & Assert
      expect(isValidTimeString('')).toBe(false);
      expect(isValidTimeString('8:30')).toBe(false);
      expect(isValidTimeString('ab:cd')).toBe(false);
    });
  });

  describe('isTimeIntervalValid', () => {
    it('isTimeIntervalValid_quandoFimForAposInicio_deveRetornarTrue', () => {
      // Arrange
      const inicio = '08:00';
      const fim = '10:00';

      // Act
      const resultado = isTimeIntervalValid(inicio, fim);

      // Assert
      expect(resultado).toBe(true);
    });

    it('isTimeIntervalValid_quandoFimForIgualAoInicio_deveRetornarFalse', () => {
      // Arrange
      const horario = '08:00';

      // Act
      const resultado = isTimeIntervalValid(horario, horario);

      // Assert
      expect(resultado).toBe(false);
    });

    it('isTimeIntervalValid_quandoFimForAnteriorAoInicio_deveRetornarFalse', () => {
      // Arrange
      const inicio = '10:00';
      const fim = '08:00';

      // Act
      const resultado = isTimeIntervalValid(inicio, fim);

      // Assert
      expect(resultado).toBe(false);
    });

    it('isTimeIntervalValid_quandoHorariosForemInvalidos_deveRetornarFalse', () => {
      // Act & Assert
      expect(isTimeIntervalValid('invalido', '10:00')).toBe(false);
      expect(isTimeIntervalValid('08:00', 'invalido')).toBe(false);
    });
  });

  describe('applyDateMask', () => {
    it('applyDateMask_quandoDigitarDoisDigitos_deveManterSemBarra', () => {
      expect(applyDateMask('15')).toBe('15');
    });

    it('applyDateMask_quandoDigitarTresDigitos_deveInserirPrimeiraBarra', () => {
      expect(applyDateMask('150')).toBe('15/0');
    });

    it('applyDateMask_quandoDigitarQuatroDigitos_deveManterUmaBarra', () => {
      expect(applyDateMask('1509')).toBe('15/09');
    });

    it('applyDateMask_quandoDigitarCincoDigitos_deveInserirSegundaBarra', () => {
      expect(applyDateMask('15092')).toBe('15/09/2');
    });

    it('applyDateMask_quandoDigitarOitoDigitosCompletos_deveFormatarComDuasBarras', () => {
      expect(applyDateMask('15092026')).toBe('15/09/2026');
    });

    it('applyDateMask_quandoHouverCaracteresNaoNumericos_deveSanitizar', () => {
      expect(applyDateMask('15-09-2026')).toBe('15/09/2026');
      expect(applyDateMask('abc15def09ghi2026')).toBe('15/09/2026');
    });
  });

  describe('applyTimeMask', () => {
    it('applyTimeMask_quandoDigitarAteDoisDigitos_deveRetornarApenasNumeros', () => {
      expect(applyTimeMask('08')).toBe('08');
    });

    it('applyTimeMask_quandoDigitarTresOuQuatroDigitos_deveInserirDoisPontos', () => {
      expect(applyTimeMask('083')).toBe('08:3');
      expect(applyTimeMask('0830')).toBe('08:30');
    });

    it('applyTimeMask_quandoHouverCaracteresNaoNumericos_deveSanitizar', () => {
      expect(applyTimeMask('08h30m')).toBe('08:30');
    });
  });
});

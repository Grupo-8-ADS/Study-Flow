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

/**
 * Testes complementares guiados por mutacao (StrykerJS): fronteiras de regex
 * (ancoras ^ e $, faixas de mes/dia), trim e aritmetica de minutos.
 */
describe('validation.ts - testes de fronteira (mutacao)', () => {
  describe('isValidDateString', () => {
    it.each(['x15/09/2026', '15/09/2026x', 'x2026-09-15', '2026-09-15x'])(
      'isValidDateString_quandoHouverLixoAoRedor_%s_deveRetornarFalse',
      (entrada) => {
        expect(isValidDateString(entrada)).toBe(false);
      },
    );

    it.each(['15/13/2026', '15/00/2026', '35/09/2026', '15/09/20266', '2026-13-10', '2026-00-10', '2026-01-00', '2026-01-32', '2026-01-35'])(
      'isValidDateString_quandoMesOuDiaForaDaFaixa_%s_deveRetornarFalse',
      (entrada) => {
        expect(isValidDateString(entrada)).toBe(false);
      },
    );

    it('isValidDateString_quandoHouverEspacosNasPontas_deveAceitarAsDuasNotacoes', () => {
      expect(isValidDateString('  15/09/2026  ')).toBe(true);
      expect(isValidDateString('  2026-09-15  ')).toBe(true);
    });

    it('isValidDateString_quandoAnoTiverMenosDeQuatroDigitosSignificativos_deveRetornarFalse', () => {
      // new Date(50, ...) vira 1950: so a comparacao de getFullYear detecta isso.
      expect(isValidDateString('15/09/0050')).toBe(false);
      expect(isValidDateString('0050-09-15')).toBe(false);
    });

    it('isValidDateString_quandoDiaTrintaEUmEmMesDeTrintaDias_deveRetornarFalse', () => {
      expect(isValidDateString('31/04/2026')).toBe(false);
      expect(isValidDateString('2026-04-31')).toBe(false);
    });

    it('isValidDateString_quandoEntradaNaoForString_deveRetornarFalseSemLancar', () => {
      expect(isValidDateString(20260915 as unknown as string)).toBe(false);
      expect(isValidDateString({} as unknown as string)).toBe(false);
      expect(isValidDateString(null as unknown as string)).toBe(false);
    });
  });

  describe('toDatabaseDate', () => {
    it('toDatabaseDate_quandoHouverEspacosNasPontas_deveRemoverEConverter', () => {
      expect(toDatabaseDate('  15/09/2026 ')).toBe('2026-09-15');
      expect(toDatabaseDate('  2026-09-15 ')).toBe('2026-09-15');
    });

    it.each([
      'x15/09/2026',
      '15/09/2026x',
      '15/13/2026',
      '15/00/2026',
      '35/09/2026',
      'x2026-09-15',
      '2026-09-15x',
      '2026-13-15',
      '2026-00-15',
      '2026-01-00',
      '2026-01-32',
    ])('toDatabaseDate_quandoFormatoInvalido_%s_deveRetornarNull', (entrada) => {
      expect(toDatabaseDate(entrada)).toBeNull();
    });
  });

  describe('formatDisplayDate', () => {
    it('formatDisplayDate_quandoHouverSufixoDeHorario_deveDescartarOSufixo', () => {
      expect(formatDisplayDate('2026-09-15T10:30:00Z')).toBe('15/09/2026');
      expect(formatDisplayDate('15/09/2026 10:30')).toBe('15/09/2026');
      expect(formatDisplayDate('15/09/2026   ')).toBe('15/09/2026');
    });

    it.each(['2026-13-15 x', '2026-00-15 x', '2026-01-00 x', '2026-01-32 x', '2026-01-35 x'])(
      'formatDisplayDate_quandoIsoComMesOuDiaInvalido_%s_deveDevolverEntradaIntacta',
      (entrada) => {
        expect(formatDisplayDate(entrada)).toBe(entrada);
      },
    );

    it.each(['15/13/2026 x', '15/00/2026 x', '35/09/2026 x', '1a/09/2026 x', '15/09/abcd x'])(
      'formatDisplayDate_quandoBrComMesOuDiaInvalido_%s_deveDevolverEntradaIntacta',
      (entrada) => {
        expect(formatDisplayDate(entrada)).toBe(entrada);
      },
    );
  });

  describe('isValidTimeString', () => {
    it('isValidTimeString_quandoHouverLixoAoRedor_deveRetornarFalse', () => {
      expect(isValidTimeString('x09:30')).toBe(false);
      expect(isValidTimeString('09:30x')).toBe(false);
    });

    it('isValidTimeString_quandoHouverEspacosNasPontas_deveRetornarTrue', () => {
      expect(isValidTimeString('  09:30  ')).toBe(true);
    });

    it('isValidTimeString_quandoEntradaNaoForString_deveRetornarFalseSemLancar', () => {
      expect(isValidTimeString(930 as unknown as string)).toBe(false);
      expect(isValidTimeString({} as unknown as string)).toBe(false);
    });
  });

  describe('isTimeIntervalValid', () => {
    it('isTimeIntervalValid_quandoHorariosIguais_deveRetornarFalse', () => {
      expect(isTimeIntervalValid('09:00', '09:00')).toBe(false);
    });

    it('isTimeIntervalValid_quandoMesmaHoraEMinutosCrescem_deveRetornarTrue', () => {
      expect(isTimeIntervalValid('09:10', '09:50')).toBe(true);
    });

    it('isTimeIntervalValid_quandoMesmaHoraEMinutosDecrescem_deveRetornarFalse', () => {
      expect(isTimeIntervalValid('09:50', '09:10')).toBe(false);
    });

    it('isTimeIntervalValid_quandoApenasUmDosHorariosForInvalido_deveRetornarFalse', () => {
      expect(isTimeIntervalValid('09:00', '99:99')).toBe(false);
      expect(isTimeIntervalValid('99:99', '23:00')).toBe(false);
    });
  });

  describe('mascaras', () => {
    it('applyDateMask_quandoExcederOitoDigitos_deveTruncarEmDdMmAaaa', () => {
      expect(applyDateMask('1509202699999')).toBe('15/09/2026');
    });

    it('applyTimeMask_quandoExcederQuatroDigitos_deveTruncarEmHhMm', () => {
      expect(applyTimeMask('093099')).toBe('09:30');
    });
  });
});

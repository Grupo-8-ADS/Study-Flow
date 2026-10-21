import { describe, it, expect, vi } from 'vitest';
import { calculateStreak, buildDistribution } from './studyflow-data';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: vi.fn() } },
}));

/** Testes complementares guiados por mutacao (StrykerJS). */
describe('studyflow-data.ts - testes de fronteira (mutacao)', () => {
  describe('calculateStreak', () => {
    it('calculateStreak_quandoDataVemComHorario_deveConsiderarSomenteODia', () => {
      const agora = new Date().toISOString(); // ex.: 2026-10-21T13:45:10.123Z
      expect(calculateStreak([agora])).toBe(1);
    });

    it('calculateStreak_quandoHaDoisRegistrosNoMesmoDiaComHorariosDiferentes_deveContarUmDia', () => {
      const hoje = new Date().toISOString().slice(0, 10);
      expect(calculateStreak([`${hoje}T01:00:00.000Z`, `${hoje}T23:00:00.000Z`])).toBe(1);
    });
  });

  describe('buildDistribution', () => {
    const linhas = ['A', 'B', 'C', 'D', 'E'].map((disciplina, i) => ({ disciplina, minutes: (5 - i) * 60 }));

    it('buildDistribution_quandoCincoDisciplinas_deveAtribuirCoresNaOrdem', () => {
      expect(buildDistribution(linhas).map((d) => d.color)).toEqual([
        'bg-[#29645e]',
        'bg-[#348e83]',
        'bg-[#e5a93b]',
        'bg-red-400',
        'bg-gray-300',
      ]);
    });

    it('buildDistribution_quandoHorasPequenas_deveUsarMaximoMinimoDeDuasHoras', () => {
      const [d] = buildDistribution([{ disciplina: 'A', minutes: 30 }]);
      expect(d.hours).toBe(0.5);
      expect(d.max).toBe(2);
    });

    it('buildDistribution_quandoTresHoras_deveArredondarMaximoParaQuatro', () => {
      const [d] = buildDistribution([{ disciplina: 'A', minutes: 180 }]);
      expect(d.max).toBe(4);
    });

    it('buildDistribution_quandoZeroMinutos_deveManterMaximoUm', () => {
      const [d] = buildDistribution([{ disciplina: 'A', minutes: 0 }]);
      expect(d.hours).toBe(0);
      expect(d.max).toBe(1);
    });
  });
});

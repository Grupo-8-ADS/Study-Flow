import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStoredSession,
  getCurrentSupabaseUserId,
  getLocalStudyMinutes,
  calculateStreak,
  buildDistribution,
  StudyFlowSession,
} from './studyflow-data';
import { supabase } from '@/lib/supabase';

// Mock do supabase client para isolar chamadas de infraestrutura
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('studyflow-data.ts - Suíte de Testes Unitários e de Integração Lógica', () => {
  // Mock determinístico do localStorage em memória (Fake Object)
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };
  })();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  describe('getStoredSession', () => {
    it('getStoredSession_quandoExistirSessaoValida_deveRetornarObjetoDesserializado', () => {
      // Arrange
      const sessaoEsperada: StudyFlowSession = {
        email: 'estudante@studyflow.com',
        nome: 'Estudante Exemplo',
        username: 'estudante',
      };
      localStorage.setItem('studyflow_session', JSON.stringify(sessaoEsperada));

      // Act
      const sessao = getStoredSession();

      // Assert
      expect(sessao).toEqual(sessaoEsperada);
    });

    it('getStoredSession_quandoStorageEstiverVazio_deveRetornarNull', () => {
      // Act
      const sessao = getStoredSession();

      // Assert
      expect(sessao).toBeNull();
    });
  });

  describe('getCurrentSupabaseUserId', () => {
    it('getCurrentSupabaseUserId_quandoUsuarioAutenticadoNoSupabase_deveRetornarId', async () => {
      // Arrange (Stub de entrada indireta)
      const mockUserId = 'user-uuid-12345';
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: mockUserId } as unknown as import('@supabase/supabase-js').User },
        error: null,
      });

      // Act
      const id = await getCurrentSupabaseUserId();

      // Assert
      expect(id).toBe(mockUserId);
    });

    it('getCurrentSupabaseUserId_quandoUsuarioNaoAutenticado_deveRetornarNull', async () => {
      // Arrange
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      // Act
      const id = await getCurrentSupabaseUserId();

      // Assert
      expect(id).toBeNull();
    });
  });

  describe('getLocalStudyMinutes', () => {
    it('getLocalStudyMinutes_quandoExistiremSessoesDeFoco_deveCalcularMinutosCorretos', () => {
      // Arrange (3 sessões de foco x 25min = 75min)
      const email = 'aluno@unifei.edu.br';
      const atividades = [
        { type: 'foco' },
        { type: 'pausa' },
        { type: 'foco' },
        { type: 'foco' },
      ];
      localStorage.setItem(`studyflow_activity_${email}`, JSON.stringify(atividades));

      // Act
      const minutos = getLocalStudyMinutes(email);

      // Assert
      expect(minutos).toBe(75);
    });

    it('getLocalStudyMinutes_quandoNaoHouverAtividades_deveRetornarZero', () => {
      // Act & Assert
      expect(getLocalStudyMinutes('inexistente@unifei.edu.br')).toBe(0);
    });
  });

  describe('calculateStreak', () => {
    it('calculateStreak_quandoNaoHouverDatas_deveRetornarZero', () => {
      expect(calculateStreak([])).toBe(0);
    });

    it('calculateStreak_quandoConterHojeEOntem_deveCalcularDoisDiasConsecutivos', () => {
      // Arrange
      const hoje = new Date();
      const ontem = new Date();
      ontem.setDate(hoje.getDate() - 1);

      const datas = [
        hoje.toISOString(),
        ontem.toISOString(),
      ];

      // Act
      const streak = calculateStreak(datas);

      // Assert
      expect(streak).toBe(2);
    });

    it('calculateStreak_quandoHouverQuebraDeSequencia_deveInterromperContagem', () => {
      // Arrange (hoje ok, mas ontem ausente e anteontem presente)
      const hoje = new Date();
      const anteontem = new Date();
      anteontem.setDate(hoje.getDate() - 2);

      const datas = [
        hoje.toISOString(),
        anteontem.toISOString(),
      ];

      // Act
      const streak = calculateStreak(datas);

      // Assert (apenas hoje é consecutivo contínuo a partir do cursor atual)
      expect(streak).toBe(1);
    });
  });

  describe('buildDistribution', () => {
    it('buildDistribution_quandoReceberLinhasDeEstudo_deveAgruparOrdenarECalcularHoras', () => {
      // Arrange
      const registros = [
        { disciplina: 'Cálculo 1', minutes: 120 }, // 2h
        { disciplina: 'Física 1', minutes: 60 },   // 1h
        { disciplina: 'Cálculo 1', minutes: 60 },  // +1h = 3h
        { disciplina: null, minutes: 30 },         // nulo descartado
      ];

      // Act
      const distribuicao = buildDistribution(registros);

      // Assert
      expect(distribuicao).toHaveLength(2);
      expect(distribuicao[0].name).toBe('Cálculo 1');
      expect(distribuicao[0].hours).toBe(3.0);
      expect(distribuicao[1].name).toBe('Física 1');
      expect(distribuicao[1].hours).toBe(1.0);
      expect(distribuicao[0].color).toBe('bg-[#29645e]');
    });

    it('buildDistribution_quandoHouverMaisDeCincoDisciplinas_deveLimitarAoTop5', () => {
      // Arrange (6 disciplinas)
      const registros = [
        { disciplina: 'Matéria 1', minutes: 10 },
        { disciplina: 'Matéria 2', minutes: 20 },
        { disciplina: 'Matéria 3', minutes: 30 },
        { disciplina: 'Matéria 4', minutes: 40 },
        { disciplina: 'Matéria 5', minutes: 50 },
        { disciplina: 'Matéria 6', minutes: 60 },
      ];

      // Act
      const distribuicao = buildDistribution(registros);

      // Assert
      expect(distribuicao).toHaveLength(5);
      expect(distribuicao[0].name).toBe('Matéria 6'); // Maior tempo primeiro
    });
  });
});

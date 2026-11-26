import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStoredSession,
  getCurrentSupabaseUserId,
  getLocalStudyMinutes,
  StudyFlowSession,
} from './studyflow-data';
import { supabase } from '@/lib/supabase';
import { AuthError } from '@supabase/supabase-js';

// Mock do supabase client para isolar chamadas de infraestrutura
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
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
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: { id: mockUserId } } as unknown as import('@supabase/supabase-js').Session },
        error: null,
      });

      // Act
      const id = await getCurrentSupabaseUserId();

      // Assert
      expect(id).toBe(mockUserId);
    });

    it('getCurrentSupabaseUserId_quandoUsuarioNaoAutenticado_deveRetornarNull', async () => {
      // Arrange
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: new AuthError('No session'),
      } as never);

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
});

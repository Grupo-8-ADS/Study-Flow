import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStoredSession,
  getCurrentSupabaseUserId,
  salvarSessaoLocal,
  enxugarSessaoLocal,
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

  describe('salvarSessaoLocal', () => {
    it('salvarSessaoLocal_quandoSessaoTemImagens_deveGravarSemElas', () => {
      // Arrange
      const sessao = { email: 'a@b.com', nome: 'Ana', username: 'ana', loginTime: 1, avatar_url: 'data:image/png;base64,AAA', banner_url: 'data:x', moldura: 'ouro' };

      // Act
      salvarSessaoLocal(sessao);

      // Assert
      expect(JSON.parse(localStorage.getItem('studyflow_session') ?? 'null')).toEqual({ email: 'a@b.com', nome: 'Ana', username: 'ana', loginTime: 1 });
    });

    it('enxugarSessaoLocal_quandoVersaoAntigaGuardouImagens_deveRemovelas', () => {
      // Arrange
      localStorage.setItem('studyflow_session', JSON.stringify({ email: 'a@b.com', nome: 'Ana', username: 'ana', banner_url: 'data:x' }));

      // Act
      enxugarSessaoLocal();

      // Assert
      expect(getStoredSession()).toEqual({ email: 'a@b.com', nome: 'Ana', username: 'ana' });
    });
  });
});

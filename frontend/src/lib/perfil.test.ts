import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/lib/supabase';
import { CHAVES, MENSAGEM_SEM_SESSAO, buscarConsulta, estadoConsulta, limparConsultas } from './consultas';
import { atualizarPerfilEmCache, carregarPerfil, type PerfilUsuario } from './perfil';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() },
    from: vi.fn(),
  },
}));

const PERFIL: PerfilUsuario = {
  id: 'u1',
  nome: 'Ana Souza',
  username: 'ana',
  email: 'ana@exemplo.com',
  avatar_url: null,
  banner_url: null,
  moldura: null,
  nivel_atual: 3,
  xp: 320,
  last_achievement: null,
  bg_color: null,
  horas_diarias: 2,
  recebe_notificacao_pref: true,
};

/** Stub da consulta `from('profiles').select().eq().maybeSingle()`. */
function respostaDoBanco(resposta: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(resposta);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  vi.mocked(supabase.from).mockReturnValue({ select } as never);
  return { select, eq };
}

function logado(id: string | null) {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: id ? ({ user: { id } } as never) : null },
    error: null,
  } as never);
}

describe('perfil.ts - perfil do usuário no site', () => {
  const armazenamento = new Map<string, string>();

  beforeEach(() => {
    vi.clearAllMocks();
    limparConsultas();
    armazenamento.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => armazenamento.get(k) ?? null,
        setItem: (k: string, v: string) => armazenamento.set(k, v),
        removeItem: (k: string) => armazenamento.delete(k),
      },
      writable: true,
    });
  });

  it('carregarPerfil_quandoLogado_deveBuscarSoAsColunasDoPerfilDoUsuario', async () => {
    // Arrange
    logado('u1');
    const { select, eq } = respostaDoBanco({ data: PERFIL, error: null });

    // Act
    const perfil = await carregarPerfil();

    // Assert
    expect(perfil).toEqual(PERFIL);
    expect(select.mock.calls[0]).toEqual([expect.not.stringContaining('*')]);
    expect(eq).toHaveBeenCalledWith('id', 'u1');
  });

  it('carregarPerfil_quandoNivelOuXpVemNulo_deveUsarNivel1EZeroXp', async () => {
    // Arrange
    logado('u1');
    respostaDoBanco({ data: { ...PERFIL, nivel_atual: null, xp: null }, error: null });

    // Act
    const perfil = await carregarPerfil();

    // Assert
    expect(perfil.nivel_atual).toBe(1);
    expect(perfil.xp).toBe(0);
  });

  it('carregarPerfil_quandoSemSessao_deveAvisarQueASessaoExpirou', async () => {
    // Arrange
    logado(null);

    // Act & Assert
    await expect(carregarPerfil()).rejects.toThrow(MENSAGEM_SEM_SESSAO);
  });

  it('carregarPerfil_quandoBancoFalhaOuNaoAchaPerfil_deveDarErroClaro', async () => {
    // Arrange
    logado('u1');

    // Act & Assert
    respostaDoBanco({ data: null, error: { message: 'boom' } });
    await expect(carregarPerfil()).rejects.toThrow('Não foi possível carregar o seu perfil.');
    respostaDoBanco({ data: null, error: null });
    await expect(carregarPerfil()).rejects.toThrow('Perfil não encontrado.');
  });

  it('atualizarPerfilEmCache_quandoMudaNome_deveAtualizarCacheESessaoSemImagens', async () => {
    // Arrange
    await buscarConsulta(CHAVES.perfil, async () => PERFIL);
    armazenamento.set(
      'studyflow_session',
      JSON.stringify({ email: 'ana@exemplo.com', nome: 'Ana Souza', username: 'ana', avatar_url: 'data:image/png;base64,AAA' }),
    );

    // Act
    atualizarPerfilEmCache({ nome: 'Ana S.', avatar_url: 'https://x/y.png' });

    // Assert
    expect(estadoConsulta<PerfilUsuario>(CHAVES.perfil).dados).toMatchObject({ nome: 'Ana S.', avatar_url: 'https://x/y.png' });
    expect(JSON.parse(armazenamento.get('studyflow_session') ?? '{}')).toEqual({ email: 'ana@exemplo.com', nome: 'Ana S.', username: 'ana' });
  });

  it('atualizarPerfilEmCache_quandoSoMudaMoldura_naoDeveReescreverASessao', async () => {
    // Arrange
    await buscarConsulta(CHAVES.perfil, async () => PERFIL);
    const sessao = JSON.stringify({ email: 'ana@exemplo.com', nome: 'Ana Souza', username: 'ana' });
    armazenamento.set('studyflow_session', sessao);

    // Act
    atualizarPerfilEmCache({ moldura: 'ouro' });

    // Assert
    expect(estadoConsulta<PerfilUsuario>(CHAVES.perfil).dados?.moldura).toBe('ouro');
    expect(armazenamento.get('studyflow_session')).toBe(sessao);
  });
});

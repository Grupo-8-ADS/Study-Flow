import { describe, expect, it, vi } from 'vitest';
import { codigoDoErroAuth, ehEmail, entrar, MENSAGENS_LOGIN, type EntrarPorUsuario } from './login';

const USER = { id: 'u1', email: 'ana@gmail.com' } as never;

function criarAuth(resposta: { user: unknown; error: unknown } = { user: USER, error: null }) {
  const comoSupabase = { data: { user: resposta.user, session: null }, error: resposta.error };
  return {
    signInWithPassword: vi.fn().mockResolvedValue(comoSupabase),
    setSession: vi.fn().mockResolvedValue(comoSupabase),
  };
}

const rotaNaoChamada: EntrarPorUsuario = () => {
  throw new Error('não deveria chamar a rota');
};

describe('login', () => {
  it('ehEmail_distingueEmailDeUsername', () => {
    expect(ehEmail('ana@gmail.com')).toBe(true);
    expect(ehEmail('ana')).toBe(false);
  });

  it('entrar_comEmail_vaiDiretoAoSupabaseSemChamarARota', async () => {
    const auth = criarAuth();

    const resultado = await entrar(auth, rotaNaoChamada, '  ana@gmail.com ', 'segredo');

    expect(resultado).toEqual({ ok: true, user: USER });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@gmail.com', password: 'segredo' });
  });

  it('entrar_comUsername_usaARotaEAbreASessaoDevolvida', async () => {
    const auth = criarAuth();
    const rota = vi.fn<EntrarPorUsuario>().mockResolvedValue({ status: 200, corpo: { access_token: 'a', refresh_token: 'r' } });

    const resultado = await entrar(auth, rota, 'ana', 'segredo');

    expect(resultado.ok).toBe(true);
    expect(rota).toHaveBeenCalledWith('ana', 'segredo');
    expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('entrar_quandoARotaRecusa_devolveOCodigoDela', async () => {
    const rota: EntrarPorUsuario = async () => ({ status: 401, corpo: { codigo: 'credenciais_invalidas' } });

    const resultado = await entrar(criarAuth(), rota, 'ana', 'errada');

    expect(resultado).toEqual({ ok: false, codigo: 'credenciais_invalidas', mensagem: MENSAGENS_LOGIN.credenciais_invalidas });
  });

  it('entrar_quandoARotaFalhaSemCorpoConhecido_ficaIndisponivel', async () => {
    const rota: EntrarPorUsuario = async () => ({ status: 500, corpo: '<html>' });
    expect(await entrar(criarAuth(), rota, 'ana', 'x')).toMatchObject({ ok: false, codigo: 'indisponivel' });
  });

  it('entrar_quandoARedeCai_ficaIndisponivel', async () => {
    const rota: EntrarPorUsuario = async () => {
      throw new TypeError('Failed to fetch');
    };
    expect(await entrar(criarAuth(), rota, 'ana', 'x')).toMatchObject({ ok: false, codigo: 'indisponivel' });
  });

  it('entrar_emailNaoConfirmado_avisaParaConfirmar', async () => {
    const auth = criarAuth({ user: null, error: { status: 400, code: 'email_not_confirmed' } });
    expect(await entrar(auth, rotaNaoChamada, 'ana@gmail.com', 'x')).toMatchObject({ ok: false, codigo: 'email_nao_confirmado' });
  });

  it('entrar_camposVazios_recusaSemChamarNada', async () => {
    const auth = criarAuth();
    expect(await entrar(auth, rotaNaoChamada, '  ', 'x')).toMatchObject({ ok: false, codigo: 'credenciais_invalidas' });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('codigoDoErroAuth_traduzOsErrosDoSupabase', () => {
    expect(codigoDoErroAuth({ status: 400, code: 'invalid_credentials' })).toBe('credenciais_invalidas');
    expect(codigoDoErroAuth({ status: 400, code: 'email_not_confirmed' })).toBe('email_nao_confirmado');
    expect(codigoDoErroAuth({ status: 429, code: 'over_request_rate_limit' })).toBe('muitas_tentativas');
    expect(codigoDoErroAuth({ status: 500 })).toBe('indisponivel');
    expect(codigoDoErroAuth(null)).toBe('indisponivel');
  });
});

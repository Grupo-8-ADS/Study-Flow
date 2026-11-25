import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Login por e-mail ou nome de usuário, igual na web e no mobile.
 *
 * - E-mail: direto no Supabase Auth.
 * - Nome de usuário: pela rota do servidor `POST /api/auth/entrar`, que descobre o e-mail
 *   com a chave secreta e devolve a sessão. O e-mail nunca sai do servidor, então não dá
 *   para descobrir o e-mail de alguém a partir do username.
 */

/** Rota do site que entra por nome de usuário (o mobile chama a mesma, pelo SITE_URL). */
export const ROTA_ENTRAR_POR_USUARIO = '/api/auth/entrar';

export type CodigoErroLogin =
  | 'credenciais_invalidas'
  | 'email_nao_confirmado'
  | 'muitas_tentativas'
  | 'indisponivel';

export const MENSAGENS_LOGIN: Record<CodigoErroLogin, string> = {
  credenciais_invalidas: 'E-mail/usuário ou senha inválidos.',
  email_nao_confirmado: 'Confirme seu e-mail antes de entrar: abra o link que enviamos no cadastro.',
  muitas_tentativas: 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.',
  indisponivel: 'Não foi possível entrar agora. Verifique sua conexão e tente de novo.',
};

export type ResultadoLogin =
  | { ok: true; user: User }
  | { ok: false; codigo: CodigoErroLogin; mensagem: string };

/** Corpo que a rota devolve: a sessão em caso de sucesso ou o código do erro. */
export type RespostaEntrarPorUsuario =
  | { access_token: string; refresh_token: string }
  | { codigo: CodigoErroLogin };

/** Chamada HTTP à rota do servidor; cada plataforma injeta a sua (fetch relativo ou SITE_URL). */
export type EntrarPorUsuario = (
  usuario: string,
  senha: string,
) => Promise<{ status: number; corpo: unknown }>;

export const ehEmail = (identificador: string) => identificador.includes('@');

/** Traduz o erro do Supabase Auth (status/código) para o código de erro do login. */
export function codigoDoErroAuth(erro: { status?: number; code?: string } | null | undefined): CodigoErroLogin {
  if (!erro) return 'indisponivel';
  if (erro.code === 'email_not_confirmed') return 'email_nao_confirmado';
  if (erro.status === 429 || erro.code === 'over_request_rate_limit') return 'muitas_tentativas';
  if (erro.code === 'invalid_credentials' || erro.status === 400) return 'credenciais_invalidas';
  return 'indisponivel';
}

const falha = (codigo: CodigoErroLogin): ResultadoLogin => ({ ok: false, codigo, mensagem: MENSAGENS_LOGIN[codigo] });

const ehCodigo = (valor: unknown): valor is CodigoErroLogin =>
  typeof valor === 'string' && valor in MENSAGENS_LOGIN;

type AuthDoLogin = Pick<SupabaseClient['auth'], 'signInWithPassword' | 'setSession'>;

export async function entrar(
  auth: AuthDoLogin,
  entrarPorUsuario: EntrarPorUsuario,
  identificador: string,
  senha: string,
): Promise<ResultadoLogin> {
  const login = identificador.trim();
  if (!login || !senha) return falha('credenciais_invalidas');

  try {
    let sessao: { data: { user: User | null; session?: Session | null }; error: { status?: number; code?: string } | null };

    if (ehEmail(login)) {
      sessao = await auth.signInWithPassword({ email: login, password: senha });
    } else {
      const { status, corpo } = await entrarPorUsuario(login, senha);
      const dados = (corpo ?? {}) as Partial<{ access_token: string; refresh_token: string; codigo: unknown }>;
      if (status !== 200 || !dados.access_token || !dados.refresh_token) {
        return falha(ehCodigo(dados.codigo) ? dados.codigo : 'indisponivel');
      }
      sessao = await auth.setSession({ access_token: dados.access_token, refresh_token: dados.refresh_token });
    }

    if (sessao.error || !sessao.data.user) return falha(codigoDoErroAuth(sessao.error));
    return { ok: true, user: sessao.data.user };
  } catch {
    return falha('indisponivel');
  }
}

/**
 * Página de Login do aplicativo Study Flow.
 * Esta tela permite a autenticação de usuários via Supabase Auth
 * e realiza o redirecionamento automático caso já exista uma sessão ativa.
 * @packageDocumentation
 */

"use client";

import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useEffect, useSyncExternalStore } from "react";
import { ehEmail } from "@studyflow/shared";
import { entrarNoStudyFlow, reenviarConfirmacao, supabase } from "@/lib/supabase";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";

/** A URL não muda enquanto a tela está aberta: não há o que assinar. */
const semAssinatura = () => () => {};

/**
 * Interface que representa a estrutura de um usuário autenticado.
 */
interface SessionUser {
  /** Nome completo do usuário */
  nome: string;
  /** Nome de usuário/apelido único */
  username: string;
  /** Endereço de e-mail utilizado no login */
  email: string;
}

/**
 * Componente da página de Login.
 * Gerencia o formulário de credenciais, tratamento de erros, lembrança de sessão
 * e redirecionamento para o Início (dashboard).
 */
const Login: NextPage = () => {
  const router = useRouter();

  /** Estado do campo de entrada do e-mail ou username */
  const [email, setEmail] = useState("");

  /** Estado do campo de entrada da senha */
  const [senha, setSenha] = useState("");


  /** Estado do checkbox "Me manter conectado" para estender a sessão */
  const [rememberMe, setRememberMe] = useState(false);


  /** Estado indicador de erro de autenticação (credenciais inválidas ou campos vazios) */
  const [error, setError] = useState("");

  /** Estado de envio do formulário para evitar logins duplicados */
  const [isLoading, setIsLoading] = useState(false);

  /** E-mail de uma conta que ainda não confirmou o cadastro (oferece reenviar o link). */
  const [naoConfirmado, setNaoConfirmado] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");

  /**
   * Efeito de inicialização para verificar se o usuário já possui uma sessão ativa.
   * Caso sim, redireciona-o automaticamente para o Início.
   */
  useEffect(() => {
    const session = localStorage.getItem("studyflow_session");
    if (session) {
      router.replace("/dashboard");
    }
  }, [router]);

  /** Volta do link de confirmação do cadastro (?confirmado=1). No servidor é sempre false. */
  const veioDaConfirmacao = useSyncExternalStore(
    semAssinatura,
    () => new URLSearchParams(window.location.search).has("confirmado"),
    () => false,
  );

  /**
   * Trata o envio do formulário de login via Supabase Auth.
   *
   * @param e - Evento de envio do formulário React
   */
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setAviso("");
    setNaoConfirmado(null);

    if (!email.trim() || !senha) {
      setError("Preencha e-mail/usuário e senha.");
      return;
    }

    setIsLoading(true);

    try {
      const resultado = await entrarNoStudyFlow(email, senha);
      if (!resultado.ok) {
        setError(resultado.mensagem);
        // Reenviar o link só quando a pessoa digitou o e-mail: pelo username ele não é revelado.
        if (resultado.codigo === "email_nao_confirmado" && ehEmail(email)) setNaoConfirmado(email.trim());
        return;
      }

      const { user } = resultado;
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, username, email")
        .eq("id", user.id)
        .maybeSingle();

      const sessionUser: SessionUser = {
        nome:
          profile?.nome ||
          user.user_metadata?.full_name ||
          user.user_metadata?.nome ||
          user.email?.split("@")[0] ||
          "Usuário Study Flow",
        username:
          profile?.username ||
          user.user_metadata?.username ||
          user.email?.split("@")[0] ||
          "usuario",
        email: profile?.email || user.email || email.trim(),
      };

      localStorage.setItem(
        "studyflow_session",
        JSON.stringify({
          email: sessionUser.email,
          nome: sessionUser.nome,
          username: sessionUser.username,
          loginTime: new Date().getTime(),
          rememberMe,
        })
      );
      router.replace("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao conectar com o servidor.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [email, senha, rememberMe, router]);

  return (
    <AuthLayout title="Entrar">
      <form className="flex flex-col gap-4" noValidate onSubmit={handleLogin}>
        {aviso ? <Alert tone="success">{aviso}</Alert> : null}
        {veioDaConfirmacao && !aviso && !error ? <Alert tone="success">E-mail confirmado! Entre com seu e-mail e senha.</Alert> : null}
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {naoConfirmado ? (
          <Button
            onClick={async () => {
              const erro = await reenviarConfirmacao(naoConfirmado);
              setError(erro ?? "");
              setAviso(erro ? "" : `Enviamos um novo link para ${naoConfirmado}.`);
              if (!erro) setNaoConfirmado(null);
            }}
            variant="secondary"
          >
            Reenviar e-mail de confirmação
          </Button>
        ) : null}

        <Field htmlFor="login-usuario" label="E-mail ou usuário">
          <Input
            autoComplete="username"
            id="login-usuario"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email ou usuário"
            required
            type="text"
            value={email}
          />
        </Field>

        <Field htmlFor="login-senha" label="Senha">
          <PasswordInput
            autoComplete="current-password"
            id="login-senha"
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha"
            required
            value={senha}
          />
        </Field>

        <div className="flex items-center justify-between gap-3">
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-ink-700">
            <input
              checked={rememberMe}
              className="h-4 w-4 cursor-pointer rounded accent-primary-700"
              onChange={(e) => setRememberMe(e.target.checked)}
              type="checkbox"
            />
            Me manter conectado
          </label>
          <Link className="text-sm font-medium text-primary-700 underline-offset-2 hover:underline" href="/recuperar-senha">
            Esqueci minha senha
          </Link>
        </div>

        <Button className="mt-2 w-full" disabled={isLoading} size="lg" type="submit">
          {isLoading ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      <p className="mt-8 border-t border-line pt-6 text-center text-sm text-ink-500">
        Ainda não tem conta?{" "}
        <Link className="font-semibold text-primary-700 underline-offset-2 hover:underline" href="/cadastro">
          Criar cadastro
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Login;

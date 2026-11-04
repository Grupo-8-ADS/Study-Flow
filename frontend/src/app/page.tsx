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
import { useCallback, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";

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
 * e redirecionamento para o dashboard/timer.
 */
const Login: NextPage = () => {
  const router = useRouter();

  /** Estado do campo de entrada do e-mail ou username */
  const [email, setEmail] = useState("");

  /** Estado do campo de entrada da senha */
  const [senha, setSenha] = useState("");


  /** Estado do checkbox "Me manter conectado" para estender a sessão */
  const [rememberMe, setRememberMe] = useState(false);

  /** Exibe a orientação de "Problemas para logar?" */
  const [showHelp, setShowHelp] = useState(false);

  /** Estado indicador de erro de autenticação (credenciais inválidas ou campos vazios) */
  const [error, setError] = useState("");

  /** Estado de envio do formulário para evitar logins duplicados */
  const [isLoading, setIsLoading] = useState(false);

  const resolveLoginEmail = useCallback(async () => {
    const login = email.trim();

    if (login.includes("@")) {
      return login;
    }

    try {
      const { data } = await supabase.rpc("get_email_by_username", {
        login_username: login,
      });

      if (typeof data === "string" && data.includes("@")) {
        return data;
      }
    } catch {
      // Fallback
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .ilike("username", login)
        .maybeSingle();

      if (profile?.email) {
        return profile.email;
      }
    } catch {
      // Fallback
    }

    return login;
  }, [email]);

  /**
   * Efeito de inicialização para verificar se o usuário já possui uma sessão ativa.
   * Caso sim, redireciona-o automaticamente para a tela do Timer.
   */
  useEffect(() => {
    const session = localStorage.getItem("studyflow_session");
    if (session) {
      router.push("/timer");
    }
  }, [router]);

  /**
   * Trata o envio do formulário de login via Supabase Auth.
   *
   * @param e - Evento de envio do formulário React
   */
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !senha) {
      setError("Preencha e-mail/usuário e senha.");
      return;
    }

    setIsLoading(true);

    try {
      const loginEmail = await resolveLoginEmail();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: senha,
      });

      if (signInError || !data.user) {
        setError("Email/usuário ou senha informados são inválidos.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, username, email")
        .eq("id", data.user.id)
        .maybeSingle();

      const sessionUser: SessionUser = {
        nome:
          profile?.nome ||
          data.user.user_metadata?.full_name ||
          data.user.user_metadata?.nome ||
          data.user.email?.split("@")[0] ||
          "Usuário Study Flow",
        username:
          profile?.username ||
          data.user.user_metadata?.username ||
          data.user.email?.split("@")[0] ||
          "usuario",
        email: profile?.email || data.user.email || loginEmail,
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
      router.push("/timer");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao conectar com o servidor.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [email, senha, rememberMe, resolveLoginEmail, router]);

  return (
    <AuthLayout description="Entre para continuar de onde parou." title="Entrar">
      <form className="flex flex-col gap-4" noValidate onSubmit={handleLogin}>
        {error ? <Alert tone="danger">{error}</Alert> : null}

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
          <button
            aria-expanded={showHelp}
            className="text-sm font-medium text-primary-700 underline-offset-2 hover:underline"
            onClick={() => setShowHelp((current) => !current)}
            type="button"
          >
            Problemas para logar?
          </button>
        </div>

        {showHelp ? (
          <Alert tone="info">Para redefinir sua senha, entre em contato com o suporte: suporte@studyflow.com</Alert>
        ) : null}

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

/**
 * Página de Cadastro de novos usuários no aplicativo Study Flow.
 * Esta tela valida as informações fornecidas e cadastra o novo usuário via Supabase Auth.
 * @packageDocumentation
 */

"use client";

import type { NextPage } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";

/**
 * Componente da página de Cadastro.
 * Gerencia a entrada de dados (nome, username, email, senha e confirmação de senha),
 * validações de igualdade e tamanho de senha, e integração com Supabase Auth.
 */
const Cadastro: NextPage = () => {
  const router = useRouter();

  /** Estado do campo de entrada de Nome Completo */
  const [nome, setNome] = useState("");

  /** Estado do campo de entrada de Nome de Usuário */
  const [username, setUsername] = useState("");

  /** Estado do campo de entrada de E-mail */
  const [email, setEmail] = useState("");

  /** Estado do campo de entrada de Senha */
  const [senha, setSenha] = useState("");

  /** Estado do campo de entrada de Confirmação de Senha */
  const [confirmarSenha, setConfirmarSenha] = useState("");



  /** Estado para armazenar mensagens de erro de validação ou cadastro */
  const [errorMsg, setErrorMsg] = useState("");

  /** Estado para armazenar mensagens de sucesso após cadastro bem-sucedido */
  const [successMsg, setSuccessMsg] = useState("");

  /** Estado de envio do formulário para evitar cadastros duplicados */
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Executa o fluxo de registro do usuário via Supabase Auth.
   * Valida se todos os campos estão preenchidos, se as senhas coincidem e possuem tamanho mínimo.
   *
   * @param e - Evento de envio do formulário React
   */
  const handleRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg("");
      setSuccessMsg("");

      const cleanNome = nome.trim();
      const cleanUsername = username.trim().toLowerCase();
      const cleanEmail = email.trim().toLowerCase();

      if (!cleanNome || !cleanUsername || !cleanEmail || !senha || !confirmarSenha) {
        setErrorMsg("Todos os campos são obrigatórios.");
        return;
      }

      if (senha !== confirmarSenha) {
        setErrorMsg("As senhas não coincidem.");
        return;
      }

      if (senha.length < 6) {
        setErrorMsg("A senha deve ter pelo menos 6 caracteres.");
        return;
      }

      setIsLoading(true);

      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: senha,
          options: {
            data: {
              nome: cleanNome,
              full_name: cleanNome,
              username: cleanUsername,
            },
          },
        });

        if (error) {
          const authMessage = error.message.toLowerCase();
          if (authMessage.includes("already registered") || authMessage.includes("already in use") || authMessage.includes("duplicate")) {
            setErrorMsg("Este e-mail já está cadastrado.");
          } else {
            setErrorMsg(error.message || "Erro ao realizar cadastro.");
          }
          return;
        }

        if (data.user) {
          localStorage.setItem(
            "studyflow_session",
            JSON.stringify({
              email: cleanEmail,
              nome: cleanNome,
              username: cleanUsername,
              loginTime: new Date().getTime(),
              rememberMe: true,
              pendingEmailConfirmation: !data.session,
            })
          );

          setSuccessMsg("Cadastro realizado com sucesso! Entrando...");
          setTimeout(() => {
            router.push("/timer");
          }, 1000);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao conectar com o servidor.";
        setErrorMsg(message);
      } finally {
        setIsLoading(false);
      }
    },
    [nome, username, email, senha, confirmarSenha, router]
  );

  return (
    <AuthLayout description="Leva menos de um minuto. Você já entra direto no app." title="Criar cadastro">
      <form className="flex flex-col gap-4" noValidate onSubmit={handleRegister}>
        {errorMsg ? <Alert tone="danger">{errorMsg}</Alert> : null}
        {successMsg ? <Alert tone="success">{successMsg}</Alert> : null}

        <Field htmlFor="cad-nome" label="Nome completo">
          <Input autoComplete="name" id="cad-nome" onChange={(e) => setNome(e.target.value)} placeholder="Nome Completo" required type="text" value={nome} />
        </Field>

        <Field htmlFor="cad-usuario" label="Nome de usuário">
          <Input
            autoCapitalize="none"
            autoComplete="username"
            id="cad-usuario"
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nome de Usuário"
            required
            type="text"
            value={username}
          />
        </Field>

        <Field htmlFor="cad-email" label="E-mail">
          <Input autoComplete="email" id="cad-email" onChange={(e) => setEmail(e.target.value)} placeholder="Email" required type="email" value={email} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field hint="Mínimo de 6 caracteres." htmlFor="cad-senha" label="Senha">
            <PasswordInput autoComplete="new-password" id="cad-senha" onChange={(e) => setSenha(e.target.value)} placeholder="Senha" required value={senha} />
          </Field>
          <Field htmlFor="cad-confirmar" label="Confirmar senha">
            <PasswordInput
              autoComplete="new-password"
              id="cad-confirmar"
              onChange={(e) => setConfirmarSenha(e.target.value)}
              placeholder="Confirmar Senha"
              required
              toggleLabel="confirmação de senha"
              value={confirmarSenha}
            />
          </Field>
        </div>

        <Button className="mt-2 w-full" disabled={isLoading} size="lg" type="submit">
          {isLoading ? "Cadastrando..." : "Cadastrar"}
        </Button>
      </form>

      <p className="mt-8 border-t border-line pt-6 text-center text-sm text-ink-500">
        Já tem conta?{" "}
        <Link className="font-semibold text-primary-700 underline-offset-2 hover:underline" href="/">
          Voltar ao login
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Cadastro;

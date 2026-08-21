/**
 * Página de Cadastro de novos usuários no aplicativo Study Flow.
 * Esta tela valida as informações fornecidas, verifica a unicidade do e-mail/username
 * no localStorage e persiste o novo cadastro.
 * @packageDocumentation
 */

"use client";

import type { NextPage } from "next";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Eye, EyeOff, AlertCircle, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Interface que representa a estrutura de um usuário registrado no sistema.
 */
interface RegisteredUser {
  /** Nome completo do usuário */
  nome: string;
  /** Nome de usuário/apelido único no sistema */
  username: string;
  /** Endereço de e-mail único do usuário */
  email: string;
  /** Senha criptografada/plana de acesso */
  senha?: string;
}

/**
 * Componente da página de Cadastro.
 * Gerencia a entrada de dados (nome, username, email, senha e confirmação de senha),
 * validações de igualdade e tamanho de senha, e tratamento de mensagens de sucesso/erro.
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

  /** Estado para controlar a visibilidade da senha (exibir/ocultar) */
  const [showSenha, setShowSenha] = useState(false);

  /** Estado para controlar a visibilidade do campo de confirmação de senha */
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  /** Estado para armazenar mensagens de erro de validação ou cadastro */
  const [errorMsg, setErrorMsg] = useState("");

  /** Estado para armazenar mensagens de sucesso após cadastro bem-sucedido */
  const [successMsg, setSuccessMsg] = useState("");

  /** Estado de envio do formulário para evitar cadastros duplicados */
  const [isLoading, setIsLoading] = useState(false);

  const createDemoAccount = useCallback(() => {
    const usersJson = localStorage.getItem("studyflow_users");
    const users: RegisteredUser[] = usersJson ? JSON.parse(usersJson) : [];
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    const emailExists = users.some((user) => user.email.toLowerCase() === normalizedEmail);
    const usernameExists = users.some((user) => user.username.toLowerCase() === normalizedUsername);

    if (emailExists) {
      setErrorMsg("Este e-mail já está cadastrado neste dispositivo.");
      return false;
    }

    if (usernameExists) {
      setErrorMsg("Este nome de usuário já está em uso neste dispositivo.");
      return false;
    }

    users.push({
      nome,
      username,
      email,
      senha,
    });

    localStorage.setItem("studyflow_users", JSON.stringify(users));
    localStorage.setItem(
      "studyflow_session",
      JSON.stringify({
        email,
        nome,
        username,
        loginTime: new Date().getTime(),
        rememberMe: true,
        demoMode: true,
      })
    );

    setSuccessMsg("Cadastro demo criado com sucesso! Entrando...");
    setTimeout(() => {
      router.push("/timer");
    }, 1000);
    return true;
  }, [email, nome, router, senha, username]);

  /**
   * Executa o fluxo de registro do usuário.
   * Valida se todos os campos estão preenchidos, se as senhas coincidem, se possuem tamanho mínimo,
   * e se o e-mail ou username já estão cadastrados no localStorage.
   * Em caso de sucesso, adiciona o novo registro ao banco local simulado (localStorage) e redireciona para a tela de login.
   *
   * @param e - Evento de envio do formulário React
   */
  const handleRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg("");
      setSuccessMsg("");

      if (!nome || !username || !email || !senha || !confirmarSenha) {
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
          email,
          password: senha,
          options: {
            data: {
              full_name: nome,
              username,
            },
          },
        });

        if (error) {
          const authMessage = error.message.toLowerCase();

          if (authMessage.includes("already registered")) {
            createDemoAccount();
            return;
          }

          createDemoAccount();
          return;
        }

        if (data.session) {
          localStorage.setItem(
            "studyflow_session",
            JSON.stringify({
              email,
              nome,
              username,
              loginTime: new Date().getTime(),
              rememberMe: true,
            })
          );
          setSuccessMsg("Cadastro realizado com sucesso! Entrando...");
          setTimeout(() => {
            router.push("/timer");
          }, 1000);
          return;
        }

        localStorage.setItem(
          "studyflow_session",
          JSON.stringify({
            email,
            nome,
            username,
            loginTime: new Date().getTime(),
            rememberMe: true,
            pendingEmailConfirmation: true,
          })
        );

        setSuccessMsg("Cadastro realizado com sucesso! Entrando...");
        setTimeout(() => {
          router.push("/timer");
        }, 1000);
      } finally {
        setIsLoading(false);
      }
    },
    [createDemoAccount, nome, username, email, senha, confirmarSenha, router]
  );

  return (
    <div className="w-full min-h-screen bg-[#29645e] lg:bg-[#f2fcfb] flex flex-col lg:flex-row leading-[normal] tracking-[normal] font-[Roboto]">
      {/* PAINEL ESQUERDO: Identidade Visual (Verde) */}
      <section className="w-full lg:w-[45%] bg-[#29645e] flex flex-col justify-center items-center py-10 lg:py-0 px-6 box-border text-white lg:min-h-screen select-none">
        <div className="flex flex-row items-center justify-center gap-4 max-w-full">
          <h1 className="m-0 text-5xl lg:text-7xl font-normal font-['Rubik_Bubbles'] tracking-wider drop-shadow-md">
            Study Flow
          </h1>
          <Image
            className="w-[120px] lg:w-[190px] h-auto object-cover filter drop-shadow-lg"
            priority
            width={190}
            height={255}
            alt="Study Flow Logo"
            src={`${basePath}/Picsart-25-06-23-14-17-57-475-1@2x.png`}
          />
        </div>
      </section>

      {/* PAINEL DIREITO: Formulário de Cadastro (Branco) */}
      <section className="flex-1 bg-white rounded-t-[30px] lg:rounded-t-none lg:rounded-l-[40px] shadow-[-10px_0px_30px_rgba(0,0,0,0.05)] flex flex-col justify-center items-center py-10 px-6 lg:px-16 box-border min-h-[70vh] lg:min-h-screen">
        <div className="w-full max-w-[480px] flex flex-col gap-6">
          {/* Cabeçalho verde do Cadastro */}
          <div className="w-full bg-[#29645e] rounded-[20px] py-4 px-6 text-center shadow-[0px_4px_10px_rgba(0,0,0,0.1)]">
            <h2 className="m-0 text-2xl lg:text-3xl font-medium text-white tracking-wide">
              Criar Cadastro
            </h2>
          </div>

          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            {/* Mensagem de Erro */}
            {errorMsg && (
              <div className="w-full border border-red-500 rounded-[15px] bg-red-50 text-red-600 px-4 py-2 text-sm flex items-center gap-2 font-medium">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Mensagem de Sucesso */}
            {successMsg && (
              <div className="w-full border border-green-500 rounded-[15px] bg-green-50 text-green-700 px-4 py-2 text-sm flex items-center gap-2 font-medium">
                <Check size={16} className="shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Campo Nome Completo */}
            <div className="relative w-full shadow-[0px_4px_10px_rgba(0,0,0,0.05)] rounded-[20px] bg-white border border-gray-200 focus-within:border-[#29645e] focus-within:ring-1 focus-within:ring-[#29645e] transition duration-200">
              <input
                className="w-full bg-transparent border-none outline-none text-base lg:text-lg py-3 px-6 text-center text-gray-800 placeholder-gray-400"
                placeholder="Nome Completo"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>

            {/* Campo Nome de Usuário */}
            <div className="relative w-full shadow-[0px_4px_10px_rgba(0,0,0,0.05)] rounded-[20px] bg-white border border-gray-200 focus-within:border-[#29645e] focus-within:ring-1 focus-within:ring-[#29645e] transition duration-200">
              <input
                className="w-full bg-transparent border-none outline-none text-base lg:text-lg py-3 px-6 text-center text-gray-800 placeholder-gray-400"
                placeholder="Nome de Usuário"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            {/* Campo E-mail */}
            <div className="relative w-full shadow-[0px_4px_10px_rgba(0,0,0,0.05)] rounded-[20px] bg-white border border-gray-200 focus-within:border-[#29645e] focus-within:ring-1 focus-within:ring-[#29645e] transition duration-200">
              <input
                className="w-full bg-transparent border-none outline-none text-base lg:text-lg py-3 px-6 text-center text-gray-800 placeholder-gray-400"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Campo Senha */}
            <div className="relative w-full shadow-[0px_4px_10px_rgba(0,0,0,0.05)] rounded-[20px] bg-white border border-gray-200 focus-within:border-[#29645e] focus-within:ring-1 focus-within:ring-[#29645e] transition duration-200 flex items-center">
              <input
                className="w-full bg-transparent border-none outline-none text-base lg:text-lg py-3 pl-6 pr-12 text-center text-gray-800 placeholder-gray-400"
                placeholder="Senha"
                type={showSenha ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-4 text-gray-400 hover:text-[#29645e] focus:outline-none"
                onClick={() => setShowSenha(!showSenha)}
              >
                {showSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Campo Confirmar Senha */}
            <div className="relative w-full shadow-[0px_4px_10px_rgba(0,0,0,0.05)] rounded-[20px] bg-white border border-gray-200 focus-within:border-[#29645e] focus-within:ring-1 focus-within:ring-[#29645e] transition duration-200 flex items-center">
              <input
                className="w-full bg-transparent border-none outline-none text-base lg:text-lg py-3 pl-6 pr-12 text-center text-gray-800 placeholder-gray-400"
                placeholder="Confirmar Senha"
                type={showConfirmarSenha ? "text" : "password"}
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-4 text-gray-400 hover:text-[#29645e] focus:outline-none"
                onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
              >
                {showConfirmarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Botões */}
            <div className="flex flex-col gap-3 w-full mt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full cursor-pointer bg-[#29645e] text-white hover:bg-[#1e4b47] active:scale-95 transition duration-300 font-medium text-lg py-3 rounded-[20px] text-center shadow-[0px_4px_10px_rgba(0,0,0,0.15)]"
              >
                {isLoading ? "Cadastrando..." : "Cadastrar"}
              </button>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full cursor-pointer border border-[#29645e] bg-[#fafffe] text-[#29645e] hover:bg-[#e0f2f0] transition duration-300 font-medium text-lg py-3 rounded-[20px] text-center active:scale-95"
              >
                Voltar ao Login
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
};

export default Cadastro;


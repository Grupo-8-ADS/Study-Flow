/**
 * Página de Login do aplicativo Study Flow.
 * Esta tela permite a autenticação de usuários cadastrados no localStorage
 * e realiza o redirecionamento automático caso já exista uma sessão ativa.
 * @packageDocumentation
 */

"use client";

import type { NextPage } from "next";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Interface que representa a estrutura de um usuário registrado.
 */
interface RegisteredUser {
  /** Nome completo do usuário */
  nome: string;
  /** Nome de usuário/apelido único */
  username: string;
  /** Endereço de e-mail utilizado no login */
  email: string;
  /** Senha de acesso do usuário (opcional na busca do localStorage) */
  senha?: string;
}

/**
 * Componente da página de Login.
 * Gerencia o formulário de credenciais, tratamento de erros, lembrança de sessão
 * e redirecionamento para o dashboard/timer.
 */
const Login: NextPage = () => {
  const router = useRouter();

  /** Estado do campo de entrada do e-mail */
  const [email, setEmail] = useState("");

  /** Estado do campo de entrada da senha */
  const [senha, setSenha] = useState("");

  /** Estado para controlar a visibilidade da senha (exibir/ocultar texto) */
  const [showSenha, setShowSenha] = useState(false);

  /** Estado do checkbox "Me manter conectado" para estender a sessão */
  const [rememberMe, setRememberMe] = useState(false);

  /** Estado indicador de erro de autenticação (credenciais inválidas ou campos vazios) */
  const [error, setError] = useState("");

  /** Estado de envio do formulário para evitar logins duplicados */
  const [isLoading, setIsLoading] = useState(false);

  const signInDemoUser = useCallback(() => {
    const usersJson = localStorage.getItem("studyflow_users");
    const users: RegisteredUser[] = usersJson ? JSON.parse(usersJson) : [];
    const login = email.trim().toLowerCase();
    const user = users.find(
      (registeredUser) =>
        (registeredUser.email.toLowerCase() === login ||
          registeredUser.username.toLowerCase() === login) &&
        registeredUser.senha === senha
    );

    if (!user) {
      return false;
    }

    localStorage.setItem(
      "studyflow_session",
      JSON.stringify({
        email: user.email,
        nome: user.nome,
        username: user.username,
        loginTime: new Date().getTime(),
        rememberMe,
        demoMode: true,
      })
    );
    router.push("/timer");
    return true;
  }, [email, rememberMe, router, senha]);

  const resolveLoginEmail = useCallback(async () => {
    const login = email.trim();

    if (login.includes("@")) {
      return login;
    }

    const { data } = await supabase.rpc("get_email_by_username", {
      login_username: login,
    });

    if (typeof data === "string" && data.includes("@")) {
      return data;
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
   * Trata o envio do formulário de login.
   * Valida se os campos estão preenchidos, verifica as credenciais cadastradas no localStorage
   * (incluindo uma conta padrão "admin" como seed se não houver usuários cadastrados)
   * e, em caso de sucesso, salva os dados da sessão no localStorage e redireciona para a tela do Timer.
   *
   * @param e - Evento de envio do formulário React
   */
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !senha) {
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
        if (signInDemoUser()) {
          return;
        }

        setError("Email e/ou senha informados são inválidos.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, username, email")
        .eq("id", data.user.id)
        .maybeSingle();

      const sessionUser: RegisteredUser = {
        nome:
          profile?.nome ||
          data.user.user_metadata?.full_name ||
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
          rememberMe
        })
      );
      router.push("/timer");
    } finally {
      setIsLoading(false);
    }
  }, [email, senha, rememberMe, resolveLoginEmail, router, signInDemoUser]);

  /**
   * Navega para a página de cadastro de novas contas.
   */
  const navigateToCadastro = useCallback(() => {
    router.push("/cadastro");
  }, [router]);

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

      {/* PAINEL DIREITO: Formulário de Login (Branco) */}
      <section className="flex-1 bg-white rounded-t-[30px] lg:rounded-t-none lg:rounded-l-[40px] shadow-[-10px_0px_30px_rgba(0,0,0,0.05)] flex flex-col justify-center items-center py-12 px-6 lg:px-16 box-border min-h-[60vh] lg:min-h-screen">
        <div className="w-full max-w-[480px] flex flex-col gap-8">
          
          {/* Título do formulário */}
          <div className="text-center">
            <h2 className="m-0 text-4xl lg:text-5xl font-medium text-[#29645e] tracking-tight">
              Study Flow
            </h2>
          </div>

          {/* Formulário de Login */}
          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            
            {/* Banner de Erro Figma (Desktop - 38) */}
            {error && (
              <div className="w-full border border-red-500 rounded-[10px] bg-red-50 text-red-600 px-4 py-2 text-sm flex items-center justify-center gap-2 animate-fade-in font-medium">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Campo E-mail */}
            <div className="relative w-full shadow-[0px_4px_10px_rgba(0,0,0,0.1)] rounded-[20px] bg-white border border-gray-100 focus-within:border-[#29645e] focus-within:ring-1 focus-within:ring-[#29645e] transition duration-200">
              <input
                className="w-full bg-transparent border-none outline-none text-lg lg:text-xl py-4 px-6 text-center text-gray-800 placeholder-gray-400"
                placeholder="Email ou usuário"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Campo Senha */}
            <div className="relative w-full shadow-[0px_4px_10px_rgba(0,0,0,0.1)] rounded-[20px] bg-white border border-gray-100 focus-within:border-[#29645e] focus-within:ring-1 focus-within:ring-[#29645e] transition duration-200 flex items-center">
              <input
                className="w-full bg-transparent border-none outline-none text-lg lg:text-xl py-4 pl-6 pr-12 text-center text-gray-800 placeholder-gray-400"
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
                {showSenha ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {/* Checkbox Me manter conectado */}
            <div className="flex items-center gap-3 px-2">
              <label className="flex items-center gap-2 cursor-pointer text-gray-600 hover:text-gray-800 select-none text-base">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-5 h-5 accent-[#29645e] cursor-pointer rounded"
                />
                <span>Me manter conectado</span>
              </label>
            </div>

            {/* Ações (Botões) */}
            <div className="flex flex-col sm:flex-row gap-4 w-full mt-2">
              {/* Botão Entrar */}
              <button
                type="submit"
                disabled={isLoading}
                className="cursor-pointer border-none bg-[#29645e] text-white hover:bg-[#1e4b47] transition duration-300 font-medium text-xl py-4 px-8 rounded-[20px] flex-1 shadow-[0px_4px_10px_rgba(0,0,0,0.15)] flex justify-center items-center active:scale-95"
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </button>

              {/* Botão Criar Cadastro */}
              <button
                type="button"
                onClick={navigateToCadastro}
                className="cursor-pointer border border-[#29645e] bg-[#fafffe] text-[#29645e] hover:bg-[#e0f2f0] transition duration-300 font-medium text-xl py-4 px-6 rounded-[20px] flex-1 shadow-[0px_4px_10px_rgba(0,0,0,0.1)] flex justify-center items-center active:scale-95"
              >
                Criar cadastro
              </button>
            </div>

            {/* Link Problemas para Logar */}
            <div className="text-center mt-2">
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  alert("Para redefinir sua senha, entre em contato com o suporte: suporte@studyflow.com");
                }}
                className="text-gray-500 hover:text-[#29645e] text-sm transition font-normal underline decoration-dotted"
              >
                Problemas para logar?
              </a>
            </div>

          </form>
        </div>
      </section>

    </div>
  );
};

export default Login;


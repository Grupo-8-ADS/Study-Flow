/**
 * Redefinição de senha: aberta pelo link do e-mail de recuperação.
 * O Supabase cria uma sessão temporária a partir do link e aqui o usuário escolhe a nova senha.
 * @packageDocumentation
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "@/components/auth-layout";
import { Button, buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";

type Estado = "verificando" | "pronto" | "invalido";

/**
 * Lido ao carregar o módulo, antes de o cliente do Supabase consumir e limpar o hash:
 * só um link de recuperação (type=recovery ou ?code=) libera a troca de senha, para que
 * uma sessão já aberta no navegador não permita trocar a senha sem a senha atual.
 */
const LINK_DE_RECUPERACAO =
  typeof window !== "undefined" &&
  (/(^|[#&])type=recovery(&|$)/.test(window.location.hash) || new URLSearchParams(window.location.search).has("code"));

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;

    void (async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);
      if (hash.get("error") || query.get("error")) {
        if (ativo) setEstado("invalido");
        return;
      }

      // Fluxo PKCE (?code=...): troca o código pela sessão.
      const code = query.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!ativo) return;
        setEstado(error ? "invalido" : "pronto");
        return;
      }

      // Fluxo implícito (#access_token=...&type=recovery): o cliente já lê o hash ao iniciar.
      const { data } = await supabase.auth.getSession();
      if (ativo) setEstado(LINK_DE_RECUPERACAO && data.session ? "pronto" : "invalido");
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && ativo) setEstado("pronto");
    });

    return () => {
      ativo = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const salvar = async (event: FormEvent) => {
    event.preventDefault();
    setErro("");
    if (senha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }

    setSalvando(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password: senha });
      if (error || !data.user) {
        setErro(
          error?.message?.toLowerCase().includes("different")
            ? "A nova senha precisa ser diferente da atual."
            : "Não foi possível salvar a nova senha. Peça um novo link e tente de novo.",
        );
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("nome, username, email").eq("id", data.user.id).maybeSingle();
      const email = profile?.email || data.user.email || "";
      localStorage.setItem(
        "studyflow_session",
        JSON.stringify({
          email,
          nome: profile?.nome || data.user.user_metadata?.nome || email.split("@")[0] || "Usuário Study Flow",
          username: profile?.username || data.user.user_metadata?.username || email.split("@")[0] || "usuario",
          loginTime: Date.now(),
          rememberMe: false,
        }),
      );
      router.replace("/dashboard");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AuthLayout title="Criar nova senha">
      {estado === "verificando" ? (
        <p className="text-sm text-ink-500" role="status">Validando link...</p>
      ) : estado === "invalido" ? (
        <div className="flex flex-col gap-4">
          <Alert tone="danger">Este link de redefinição é inválido ou já expirou.</Alert>
          <Link className={buttonClass("primary", "lg")} href="/recuperar-senha">
            Pedir um novo link
          </Link>
        </div>
      ) : (
        <form className="flex flex-col gap-4" noValidate onSubmit={salvar}>
          {erro ? <Alert tone="danger">{erro}</Alert> : null}
          <Field hint="Mínimo de 6 caracteres." htmlFor="nova-senha" label="Nova senha">
            <PasswordInput autoComplete="new-password" id="nova-senha" onChange={(e) => setSenha(e.target.value)} value={senha} />
          </Field>
          <Field htmlFor="confirmar-senha" label="Confirmar nova senha">
            <PasswordInput
              autoComplete="new-password"
              id="confirmar-senha"
              onChange={(e) => setConfirmar(e.target.value)}
              toggleLabel="confirmação"
              value={confirmar}
            />
          </Field>
          <Button className="mt-2 w-full" disabled={salvando} size="lg" type="submit">
            {salvando ? "Salvando..." : "Salvar e entrar"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

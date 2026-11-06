/**
 * Recuperação de senha: envia, pelo Supabase Auth, um e-mail com o link
 * que abre a tela /redefinir-senha.
 * @packageDocumentation
 */

"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    setErro("");
    const limpo = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpo)) {
      setErro("Informe um e-mail válido.");
      return;
    }

    setEnviando(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(limpo, {
        redirectTo: `${window.location.origin}${basePath}/redefinir-senha`,
      });
      if (error) {
        setErro(
          error.status === 429
            ? "Muitas tentativas. Aguarde alguns minutos e tente de novo."
            : "Não foi possível enviar o e-mail agora. Tente novamente.",
        );
        return;
      }
      // Mesmo se o e-mail não existir mostramos sucesso, para não revelar quem tem conta.
      setEnviado(true);
    } catch {
      setErro("Erro ao conectar com o servidor.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AuthLayout title="Recuperar senha">
      {enviado ? (
        <div className="flex flex-col gap-4">
          <Alert tone="success">
            Se houver uma conta com <strong>{email.trim()}</strong>, você vai receber um e-mail com o link para criar uma nova senha.
            Confira também a caixa de spam.
          </Alert>
          <Button onClick={() => setEnviado(false)} variant="secondary">
            Enviar de novo
          </Button>
        </div>
      ) : (
        <form className="flex flex-col gap-4" noValidate onSubmit={enviar}>
          {erro ? <Alert tone="danger">{erro}</Alert> : null}
          <Field htmlFor="recuperar-email" label="E-mail da conta">
            <Input
              autoComplete="email"
              id="recuperar-email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              type="email"
              value={email}
            />
          </Field>
          <Button className="mt-2 w-full" disabled={enviando} size="lg" type="submit">
            {enviando ? "Enviando..." : "Enviar link de redefinição"}
          </Button>
        </form>
      )}

      <p className="mt-8 border-t border-line pt-6 text-center text-sm text-ink-500">
        Lembrou a senha?{" "}
        <Link className="font-semibold text-primary-700 underline-offset-2 hover:underline" href="/">
          Voltar ao login
        </Link>
      </p>
    </AuthLayout>
  );
}

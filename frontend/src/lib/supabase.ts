import { createClient } from "@supabase/supabase-js";

export const SUPABASE_FALLBACK_URL = "https://fsevgdeegpaxdhcwkkcz.supabase.co";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_FALLBACK_URL;
export const SUPABASE_FALLBACK_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZXZnZGVlZ3BheGRoY3dra2N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2Mjg2MDYsImV4cCI6MjA5OTIwNDYwNn0.J8rWkpAeueZ2-ji4gG4-IFlrq1Z4Na0K73muaySkf-4";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  SUPABASE_FALLBACK_KEY;

export const supabase = createClient(supabaseUrl, supabasePublishableKey);


/** Para onde o link de confirmação de cadastro leva (a tela de login avisa que deu certo). */
export const urlConfirmacaoEmail = () => `${window.location.origin}/?confirmado=1`;

/** Reenvia o e-mail de confirmação de cadastro. Devolve a mensagem de erro ou null. */
export async function reenviarConfirmacao(email: string): Promise<string | null> {
  const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: urlConfirmacaoEmail() } });
  if (!error) return null;
  return error.status === 429 ? "Aguarde um pouco antes de pedir outro e-mail." : "Não foi possível reenviar o e-mail. Tente novamente.";
}

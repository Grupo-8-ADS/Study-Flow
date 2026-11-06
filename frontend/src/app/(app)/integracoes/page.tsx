"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Plus, RefreshCw, Tags, Trash2 } from "lucide-react";
import type { LocalizacaoPalavra } from "@studyflow/shared";
import { supabase } from "@/lib/supabase";
import { getCurrentSupabaseUserId, getStoredSession } from "@/lib/studyflow-data";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Alert, PageLoading } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";

type UserSession = { email: string; nome: string; username: string; avatar_url?: string | null };
type Palavra = { id: string; palavra: string; localizacao: LocalizacaoPalavra };
type StatusGmail = { email_sinc: string | null; data_ultima_sinc: string | null } | null;
type Aviso = { tipo: "sucesso" | "erro"; texto: string } | null;

const LOCALIZACOES: Array<{ valor: LocalizacaoPalavra; rotulo: string }> = [
  { valor: "assunto", rotulo: "Assunto" },
  { valor: "corpo", rotulo: "Corpo do e-mail" },
  { valor: "remetente", rotulo: "Remetente" },
  { valor: "destinatario", rotulo: "Destinatário" },
];

const RETORNO_OAUTH: Record<string, Aviso> = {
  conectado: { tipo: "sucesso", texto: "Gmail conectado! Agora é só sincronizar." },
  cancelado: { tipo: "erro", texto: "A conexão com o Gmail foi cancelada." },
  erro: { tipo: "erro", texto: "Não foi possível conectar o Gmail. Tente novamente." },
  "nao-configurado": { tipo: "erro", texto: "A integração com o Gmail ainda não foi configurada no servidor." },
};

async function chamarApi(caminho: string, metodo: "POST" | "DELETE") {
  const { data } = await supabase.auth.getSession();
  const resposta = await fetch(caminho, {
    method: metodo,
    headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
  });
  const corpo = resposta.status === 204 ? {} : await resposta.json().catch(() => ({}));
  return { ok: resposta.ok, corpo: corpo as Record<string, unknown> };
}

function IntegracoesConteudo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserSession | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [palavras, setPalavras] = useState<Palavra[]>([]);
  const [status, setStatus] = useState<StatusGmail>(null);
  const [novaPalavra, setNovaPalavra] = useState("");
  const [localizacao, setLocalizacao] = useState<LocalizacaoPalavra>("assunto");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(() => RETORNO_OAUTH[searchParams.get("gmail") ?? ""] ?? null);

  const carregar = useCallback(async (id: string) => {
    const [lista, sinc] = await Promise.all([
      supabase.from("palavras_chave").select("id, palavra, localizacao").eq("user_id", id).order("created_at"),
      supabase.from("sinc_gmail").select("email_sinc, data_ultima_sinc").eq("user_id", id).maybeSingle(),
    ]);
    setPalavras((lista.data ?? []) as Palavra[]);
    setStatus((sinc.data as StatusGmail) ?? null);
  }, []);

  useEffect(() => {
    const sessao = getStoredSession();
    if (!sessao) {
      router.push("/");
      return;
    }
    async function iniciar() {
      setUser(sessao as UserSession);
      const id = await getCurrentSupabaseUserId();
      setUserId(id);
      if (id) await carregar(id);
    }
    void iniciar();
  }, [router, carregar]);

  const adicionar = async (e: FormEvent) => {
    e.preventDefault();
    const palavra = novaPalavra.trim();
    if (!userId || !palavra) return;
    if (palavras.some((p) => p.palavra.toLowerCase() === palavra.toLowerCase() && p.localizacao === localizacao)) {
      setAviso({ tipo: "erro", texto: `"${palavra}" já está cadastrada para ${LOCALIZACOES.find((l) => l.valor === localizacao)?.rotulo.toLowerCase()}.` });
      return;
    }
    const { error } = await supabase.from("palavras_chave").insert({ user_id: userId, palavra, localizacao });
    if (error) {
      setAviso({ tipo: "erro", texto: "Não foi possível salvar a palavra-chave." });
      return;
    }
    setNovaPalavra("");
    setAviso(null);
    await carregar(userId);
  };

  const remover = async (id: string) => {
    if (!userId) return;
    await supabase.from("palavras_chave").delete().eq("id", id);
    await carregar(userId);
  };

  const conectar = async () => {
    setOcupado(true);
    const { ok, corpo } = await chamarApi("/api/gmail/conectar", "POST");
    if (ok && typeof corpo.url === "string") {
      window.location.assign(corpo.url);
      return;
    }
    setOcupado(false);
    setAviso({ tipo: "erro", texto: String(corpo.message ?? "Não foi possível iniciar a conexão com o Gmail.") });
  };

  const sincronizar = async () => {
    if (!userId) return;
    setOcupado(true);
    const { ok, corpo } = await chamarApi("/api/gmail/sincronizar", "POST");
    setOcupado(false);
    if (!ok) {
      setAviso({ tipo: "erro", texto: String(corpo.message ?? "Não foi possível sincronizar.") });
      return;
    }
    const criados = Number(corpo.criados ?? 0);
    setAviso({
      tipo: "sucesso",
      texto:
        criados > 0
          ? `Sincronizado! ${criados} ${criados === 1 ? "item adicionado" : "itens adicionados"} ao cronograma.`
          : `Sincronizado! Nenhum item novo (${Number(corpo.encontrados ?? 0)} e-mails analisados).`,
    });
    await carregar(userId);
  };

  const desconectar = async () => {
    if (!userId) return;
    setOcupado(true);
    const { ok } = await chamarApi("/api/gmail/conexao", "DELETE");
    setOcupado(false);
    setAviso(ok ? { tipo: "sucesso", texto: "Gmail desconectado." } : { tipo: "erro", texto: "Não foi possível desconectar." });
    await carregar(userId);
  };

  if (!user) return <PageLoading label="Carregando integrações..." />;

  return (
    <>
      <PageHeader
        title="Integrações"
      />

      <div className="grid max-w-4xl gap-6">
        {aviso ? <Alert tone={aviso.tipo === "sucesso" ? "success" : "danger"}>{aviso.texto}</Alert> : null}

        {!userId ? (
          <div className="rounded-control border border-warning/20 bg-warning-soft px-3.5 py-3 text-sm text-[#8a4006]">
            Entre com uma conta para usar as integrações. No modo local elas ficam indisponíveis.
          </div>
        ) : null}

        <Card aria-labelledby="titulo-gmail">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-primary-100 text-primary-700">
                <Mail size={22} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-ink-900" id="titulo-gmail">
                    Gmail
                  </h2>
                  <Badge tone={status ? "success" : "neutral"}>{status ? "Conectado" : "Desconectado"}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-500" data-testid="status-gmail">
                  {status
                    ? `Conectado${status.email_sinc ? ` como ${status.email_sinc}` : ""}. ${status.data_ultima_sinc ? `Última sincronização: ${new Date(status.data_ultima_sinc).toLocaleString("pt-BR")}.` : "Ainda não sincronizado."}`
                    : "Não conectado. O Study Flow pede só permissão de leitura."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {status ? (
                <>
                  <Button disabled={ocupado} onClick={desconectar} variant="secondary">
                    Desconectar
                  </Button>
                  <Button disabled={ocupado || palavras.length === 0} onClick={sincronizar}>
                    <RefreshCw aria-hidden className={ocupado ? "animate-spin" : ""} size={16} />
                    Sincronizar agora
                  </Button>
                </>
              ) : (
                <Button disabled={!userId || ocupado} onClick={conectar}>
                  <Mail aria-hidden size={16} />
                  Conectar Gmail
                </Button>
              )}
            </div>
          </div>
          {status && palavras.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">Cadastre ao menos uma palavra-chave abaixo para sincronizar.</p>
          ) : null}
        </Card>

        <Card aria-labelledby="titulo-palavras">
          <CardHeader
            description="O Study Flow procura estas palavras nos seus e-mails para identificar provas e entregas."
            icon={<Tags size={18} />}
            id="titulo-palavras"
            title="Palavras-chave"
          />
          <form className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end" onSubmit={adicionar}>
            <Field htmlFor="palavra-chave" label="Palavra-chave">
              <Input
                disabled={!userId}
                id="palavra-chave"
                maxLength={60}
                onChange={(e) => setNovaPalavra(e.target.value)}
                placeholder="Ex.: prova, entrega, P1"
                value={novaPalavra}
              />
            </Field>
            <Field htmlFor="palavra-onde" label="Onde procurar">
              <Select disabled={!userId} id="palavra-onde" onChange={(e) => setLocalizacao(e.target.value as LocalizacaoPalavra)} value={localizacao}>
                {LOCALIZACOES.map((l) => (
                  <option key={l.valor} value={l.valor}>
                    {l.rotulo}
                  </option>
                ))}
              </Select>
            </Field>
            <Button disabled={!userId || !novaPalavra.trim()} type="submit" variant="secondary">
              <Plus aria-hidden size={16} />
              Adicionar palavra-chave
            </Button>
          </form>

          {palavras.length === 0 ? (
            <p className="mt-5 text-sm text-ink-500">Nenhuma palavra-chave cadastrada ainda.</p>
          ) : (
            <ul aria-label="Palavras-chave cadastradas" className="mt-5 flex flex-wrap gap-2">
              {palavras.map((p) => (
                <li className="flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 py-1 pl-3.5 pr-1 text-sm text-primary-800" key={p.id}>
                  <span>
                    <strong className="font-semibold">{p.palavra}</strong> · {LOCALIZACOES.find((l) => l.valor === p.localizacao)?.rotulo}
                  </span>
                  <button
                    aria-label={`Remover ${p.palavra}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-primary-700 transition-colors hover:bg-white hover:text-danger"
                    onClick={() => remover(p.id)}
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

// useSearchParams exige um limite de Suspense para a rota continuar pré-renderizada.
export default function IntegracoesPage() {
  return (
    <Suspense fallback={null}>
      <IntegracoesConteudo />
    </Suspense>
  );
}

"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  BarChart3,
  BookOpen,
  Calendar,
  CalendarClock,
  Gift,
  LayoutDashboard,
  LogOut,
  Mail,
  Plug,
  Plus,
  RefreshCw,
  Settings,
  Timer,
  Trash2,
  User,
} from "lucide-react";
import type { LocalizacaoPalavra } from "@studyflow/shared";
import { supabase } from "@/lib/supabase";
import { getCurrentSupabaseUserId, getStoredSession } from "@/lib/studyflow-data";

type UserSession = { email: string; nome: string; username: string; avatar_url?: string | null };
type Palavra = { id: string; palavra: string; localizacao: LocalizacaoPalavra };
type StatusGmail = { email_sinc: string | null; data_ultima_sinc: string | null } | null;
type Aviso = { tipo: "sucesso" | "erro"; texto: string } | null;

const menuItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Calendário", href: "/calendario", icon: Calendar },
  { name: "Atividade", href: "/atividade", icon: Activity },
  { name: "Disciplinas", href: "/disciplinas", icon: BookOpen },
  { name: "Rotina", href: "/rotina", icon: CalendarClock },
  { name: "Timer", href: "/timer", icon: Timer },
  { name: "Estatísticas", href: "/estatisticas", icon: BarChart3 },
  { name: "Recompensas", href: "/rewards", icon: Gift },
  { name: "Integrações", href: "/integracoes", icon: Plug },
  { name: "Configurações", href: "/configuracoes", icon: Settings },
];

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

const inputClass = "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#29645e]";
const labelClass = "grid gap-1.5 text-sm font-semibold text-gray-600";
const cardClass = "rounded-[28px] border border-gray-100 bg-white p-6 shadow-[0_8px_30px_rgba(41,100,94,0.05)]";

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

  if (!user) return <div className="flex min-h-screen items-center justify-center bg-[#f7fdfd] text-[#29645e]">Carregando integrações...</div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#f7fdfd] font-[Roboto] lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col justify-between bg-[#29645e] px-4 py-6 text-white shadow-lg lg:min-h-screen lg:w-[260px]">
        <div className="flex flex-col gap-8">
          <h1 className="px-2 font-['Rubik_Bubbles'] text-2xl font-normal tracking-wider">Study Flow</h1>
          <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={`flex shrink-0 cursor-pointer items-center gap-3 rounded-[15px] px-4 py-3 text-base font-medium lg:w-full ${item.name === "Integrações" ? "bg-white text-[#29645e] shadow-md" : "text-gray-100 hover:bg-[#347871]"}`}
                  key={item.name}
                  onClick={() => router.push(item.href)}
                  type="button"
                >
                  <Icon size={20} />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>
        <button
          className="mt-8 flex cursor-pointer items-center gap-3 rounded-[15px] px-4 py-3 text-red-200 hover:bg-[#a83232]"
          onClick={() => {
            localStorage.removeItem("studyflow_session");
            router.push("/");
          }}
          type="button"
        >
          <LogOut size={20} />
          Sair
        </button>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col overflow-y-auto px-4 py-6 lg:px-8">
        <header className="mb-7 flex justify-end gap-4 border-b border-gray-100 pb-6">
          <button aria-label="Perfil" className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#eaf6f4] text-[#29645e]" onClick={() => router.push("/perfil")} type="button">
            {user.avatar_url ? <img src={user.avatar_url} alt={user.nome || "Avatar"} className="h-full w-full object-cover" /> : <User size={22} />}
          </button>
        </header>

        <div className="mx-auto grid w-full max-w-4xl gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5f8d87]">Automação</p>
            <h2 className="mt-1 text-2xl font-bold text-gray-800 lg:text-3xl">Integrações</h2>
            <p className="mt-2 text-sm text-gray-500">
              Cadastre palavras-chave e conecte seu Gmail: e-mails sobre provas, trabalhos e entregas viram itens no seu cronograma.
            </p>
          </div>

          {aviso ? (
            <p
              className={`rounded-2xl border p-3.5 text-sm font-medium ${aviso.tipo === "sucesso" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}
              role={aviso.tipo === "erro" ? "alert" : "status"}
            >
              {aviso.texto}
            </p>
          ) : null}

          {!userId ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">
              Entre com uma conta para usar as integrações. No modo local elas ficam indisponíveis.
            </p>
          ) : null}

          <section aria-labelledby="titulo-palavras" className={cardClass}>
            <h3 className="text-xl font-bold text-gray-800" id="titulo-palavras">Palavras-chave</h3>
            <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end" onSubmit={adicionar}>
              <label className={labelClass}>
                Palavra-chave
                <input className={inputClass} disabled={!userId} maxLength={60} onChange={(e) => setNovaPalavra(e.target.value)} placeholder="ex.: prova, entrega, P1" value={novaPalavra} />
              </label>
              <label className={labelClass}>
                Onde procurar
                <select className={inputClass} disabled={!userId} onChange={(e) => setLocalizacao(e.target.value as LocalizacaoPalavra)} value={localizacao}>
                  {LOCALIZACOES.map((l) => (
                    <option key={l.valor} value={l.valor}>{l.rotulo}</option>
                  ))}
                </select>
              </label>
              <button
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#29645e] px-5 py-3 font-bold text-white hover:bg-[#21524d] disabled:opacity-50"
                disabled={!userId || !novaPalavra.trim()}
                type="submit"
              >
                <Plus size={18} /> Adicionar palavra-chave
              </button>
            </form>

            {palavras.length === 0 ? (
              <p className="mt-5 text-sm text-gray-500">Nenhuma palavra-chave cadastrada ainda.</p>
            ) : (
              <ul aria-label="Palavras-chave cadastradas" className="mt-5 flex flex-wrap gap-2">
                {palavras.map((p) => (
                  <li className="flex items-center gap-2 rounded-full border border-[#cfe7e3] bg-[#eaf6f4] py-1.5 pl-4 pr-2 text-sm text-[#29645e]" key={p.id}>
                    <span>
                      <strong>{p.palavra}</strong> · {LOCALIZACOES.find((l) => l.valor === p.localizacao)?.rotulo}
                    </span>
                    <button aria-label={`Remover ${p.palavra}`} className="rounded-full p-1 hover:bg-white" onClick={() => remover(p.id)} type="button">
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="titulo-gmail" className={cardClass}>
            <div className="flex items-start gap-4">
              <span className="rounded-2xl bg-[#eaf6f4] p-3 text-[#29645e]"><Mail size={24} /></span>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-800" id="titulo-gmail">Gmail</h3>
                <p className="mt-1 text-sm text-gray-500" data-testid="status-gmail">
                  {status
                    ? `Conectado${status.email_sinc ? ` como ${status.email_sinc}` : ""}. ${status.data_ultima_sinc ? `Última sincronização: ${new Date(status.data_ultima_sinc).toLocaleString("pt-BR")}.` : "Ainda não sincronizado."}`
                    : "Não conectado. O Study Flow pede só permissão de leitura."}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {status ? (
                <>
                  <button
                    className="flex items-center gap-2 rounded-2xl bg-[#29645e] px-5 py-3 font-bold text-white hover:bg-[#21524d] disabled:opacity-50"
                    disabled={ocupado || palavras.length === 0}
                    onClick={sincronizar}
                    type="button"
                  >
                    <RefreshCw className={ocupado ? "animate-spin" : ""} size={18} /> Sincronizar agora
                  </button>
                  <button className="rounded-2xl border border-gray-200 px-5 py-3 font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50" disabled={ocupado} onClick={desconectar} type="button">
                    Desconectar
                  </button>
                </>
              ) : (
                <button
                  className="flex items-center gap-2 rounded-2xl bg-[#29645e] px-5 py-3 font-bold text-white hover:bg-[#21524d] disabled:opacity-50"
                  disabled={!userId || ocupado}
                  onClick={conectar}
                  type="button"
                >
                  <Mail size={18} /> Conectar Gmail
                </button>
              )}
            </div>
            {status && palavras.length === 0 ? (
              <p className="mt-3 text-xs text-gray-500">Cadastre ao menos uma palavra-chave para sincronizar.</p>
            ) : null}
          </section>
        </div>
      </main>
    </div>
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

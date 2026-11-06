"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Gift, Image as ImageIcon, Lock, Palette, Sparkles, Trophy } from "lucide-react";
import {
  BANNERS,
  MOLDURAS,
  PREFIXO_BANNER,
  desbloqueado,
  gradienteCss,
  nomeConquista,
  progressoNivel,
} from "@studyflow/shared";
import { supabase } from "@/lib/supabase";
import { limparAgenda } from "@/lib/agenda";
import { getCurrentSupabaseUserId, getStoredSession } from "@/lib/studyflow-data";
import { ConquistaIcone } from "@/components/conquista-icone";
import { MolduraAvatar } from "@/components/moldura-avatar";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState, PageLoading } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";

type UserSession = {
  avatar_url?: string | null;
  email: string;
  nome: string;
  username: string;
};

type ConquistaLinha = {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  tier: number | null;
};

type Perfil = {
  nivel: number;
  xp: number;
  avatar_url: string | null;
  banner_url: string | null;
  moldura: string | null;
};

type Aba = "conquistas" | "molduras" | "banners";

const ABAS: { id: Aba; titulo: string; descricao: string; icon: typeof Trophy; cores: string[] }[] = [
  {
    id: "conquistas",
    titulo: "Conquistas",
    descricao: "Medalhas por horas, sequências e disciplinas que você mais estuda.",
    icon: Trophy,
    cores: ["#29645e", "#65bfaa"],
  },
  {
    id: "molduras",
    titulo: "Molduras de perfil",
    descricao: "Aros para o seu avatar, liberados conforme você sobe de nível.",
    icon: Palette,
    cores: ["#705c9d", "#b09cda"],
  },
  {
    id: "banners",
    titulo: "Banners de fundo",
    descricao: "Cenários prontos para o topo do seu perfil.",
    icon: ImageIcon,
    cores: ["#c08032", "#e6bd72"],
  },
];

export default function RewardsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("conquistas");
  const [perfil, setPerfil] = useState<Perfil>({ nivel: 1, xp: 0, avatar_url: null, banner_url: null, moldura: null });
  const [conquistas, setConquistas] = useState<ConquistaLinha[]>([]);
  const [ganhas, setGanhas] = useState<Map<string, string | null>>(new Map());
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function loadRewards() {
      const parsedSession = getStoredSession();

      if (!parsedSession) {
        router.push("/");
        return;
      }

      try {
        setUser(parsedSession);
        const currentUserId = await getCurrentSupabaseUserId(parsedSession);
        if (!currentUserId) return;
        setUserId(currentUserId);

        const [{ data: unlocked }, { data: todas }, { data: profile }] = await Promise.all([
          supabase.from("user_conquistas").select("conquista_id,detalhe").eq("user_id", currentUserId),
          supabase.from("conquistas").select("id,nome,descricao,icone,tier").order("tier", { ascending: true }),
          supabase.from("profiles").select("avatar_url,banner_url,moldura,nivel_atual,xp").eq("id", currentUserId).maybeSingle(),
        ]);

        if (profile) {
          setPerfil({
            nivel: profile.nivel_atual ?? progressoNivel(profile.xp ?? 0).nivel,
            xp: profile.xp ?? 0,
            avatar_url: profile.avatar_url,
            banner_url: profile.banner_url,
            moldura: profile.moldura,
          });
        }
        setConquistas((todas ?? []) as ConquistaLinha[]);
        setGanhas(new Map((unlocked ?? []).map((u) => [u.conquista_id as string, (u.detalhe as string | null) ?? null])));
      } catch {
        localStorage.removeItem("studyflow_session");
        limparAgenda();
        router.push("/");
      }
    }

    void loadRewards();
  }, [router]);

  if (!user) {
    return <PageLoading label="Carregando recompensas..." />;
  }

  const contagem: Record<Aba, { feitos: number; total: number }> = {
    conquistas: { feitos: conquistas.filter((c) => ganhas.has(c.id)).length, total: conquistas.length },
    molduras: { feitos: MOLDURAS.filter((m) => desbloqueado(m, perfil.nivel)).length, total: MOLDURAS.length },
    banners: { feitos: BANNERS.filter((b) => desbloqueado(b, perfil.nivel)).length, total: BANNERS.length },
  };
  const total = Object.values(contagem).reduce((s, c) => s + c.total, 0);
  const feitos = Object.values(contagem).reduce((s, c) => s + c.feitos, 0);
  const progressoGeral = total > 0 ? Math.round((feitos / total) * 100) : 0;
  const proximo = [...MOLDURAS, ...BANNERS].filter((i) => i.nivel > perfil.nivel).sort((a, b) => a.nivel - b.nivel)[0];
  const xpParaProximo = proximo ? Math.max(0, (proximo.nivel - 1) * 100 - perfil.xp) : 0;

  async function equipar(campo: "moldura" | "banner_url", valor: string | null) {
    if (!userId) return;
    setErro(null);
    setSalvando(`${campo}:${valor}`);
    const { error } = await supabase.from("profiles").update({ [campo]: valor }).eq("id", userId);
    setSalvando(null);
    if (error) {
      setErro(error.code === "42501" ? "Esse item ainda está bloqueado para o seu nível." : "Não foi possível equipar agora. Tente de novo.");
      return;
    }
    setPerfil((p) => ({ ...p, [campo]: valor }));
    // O menu lateral relê a sessão para mostrar a moldura nova.
    const sessao = getStoredSession();
    if (sessao) {
      localStorage.setItem("studyflow_session", JSON.stringify({ ...sessao, [campo]: valor }));
      window.dispatchEvent(new Event("studyflow:sessao"));
    }
  }

  const inicial = user.nome?.trim()?.[0]?.toUpperCase() ?? "?";
  const avatar = (moldura: string | null, tamanho = 56) => (
    <MolduraAvatar espessura={3} moldura={moldura}>
      <span
        className="flex items-center justify-center overflow-hidden rounded-full bg-primary-100 text-lg font-semibold text-primary-800 ring-2 ring-white"
        style={{ height: tamanho, width: tamanho }}
      >
        {perfil.avatar_url ? <img alt="" className="h-full w-full object-cover" src={perfil.avatar_url} /> : inicial}
      </span>
    </MolduraAvatar>
  );

  return (
    <>
      <PageHeader title="Recompensas" />

      <Card className="relative overflow-hidden !border-primary-800 !bg-primary-800 text-white">
        <div aria-hidden className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/[0.06]" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-white/10">
              <Gift size={22} />
            </span>
            <div>
              <h2 className="text-lg font-semibold !text-white">Nível {perfil.nivel}</h2>
              <p className="mt-1 max-w-xl text-sm text-primary-100">
                {proximo
                  ? `Faltam ${xpParaProximo} XP para liberar ${MOLDURAS.some((m) => m === proximo) ? "a moldura" : "o banner"} ${proximo.nome} (nível ${proximo.nivel}).`
                  : "Você liberou todas as molduras e banners."}
              </p>
            </div>
          </div>
          <div className="min-w-[220px] rounded-card bg-white/10 p-4">
            <p className="text-xs font-medium text-primary-100">Progresso geral</p>
            <p className="tabular mt-1 text-2xl font-semibold">
              {feitos} de {total}
            </p>
            <div
              aria-label="Progresso geral da coleção"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={progressoGeral}
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15"
              role="progressbar"
            >
              <div className="h-full rounded-full bg-primary-300" style={{ width: `${progressoGeral}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-primary-100">{progressoGeral}% desbloqueado</p>
          </div>
        </div>
      </Card>

      <section aria-label="Coleções" className="mt-6 grid gap-4 md:grid-cols-3">
        {ABAS.map((colecao) => {
          const Icon = colecao.icon;
          const { feitos: f, total: t } = contagem[colecao.id];
          const progresso = t > 0 ? Math.round((f / t) * 100) : 0;
          const ativo = aba === colecao.id;
          return (
            <button
              aria-pressed={ativo}
              className={`rounded-card border bg-surface p-5 text-left shadow-card transition-colors hover:border-primary-300 ${
                ativo ? "border-primary-500 ring-2 ring-primary-100" : "border-line"
              }`}
              key={colecao.id}
              onClick={() => setAba(colecao.id)}
              type="button"
            >
              <div className="flex items-start justify-between">
                <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-[12px] text-white" style={{ background: gradienteCss(colecao.cores) }}>
                  <Icon size={20} />
                </span>
                <Badge>
                  {f}/{t}
                </Badge>
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink-900">{colecao.titulo}</h3>
              <p className="mt-1 min-h-10 text-sm text-ink-500">{colecao.descricao}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div className="h-full rounded-full bg-primary-600" style={{ width: `${progresso}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-ink-500">
                {progresso}% · {Math.max(0, t - f)} bloqueados
              </p>
            </button>
          );
        })}
      </section>

      {erro ? (
        <div className="mt-6">
          <Alert tone="danger">{erro}</Alert>
        </div>
      ) : null}

      <Card className="mt-6">
        {aba === "conquistas" ? (
          <>
            <CardHeader icon={<Sparkles size={18} />} title="Conquistas" />
            {conquistas.length === 0 ? (
              <EmptyState className="!py-8" description="Continue estudando para desbloquear as primeiras medalhas." title="Nenhuma conquista ainda" />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {conquistas.map((c) => {
                  const ganha = ganhas.has(c.id);
                  return (
                    <li
                      className={`flex items-center gap-3 rounded-control border p-3 ${ganha ? "border-line bg-white" : "border-dashed border-ink-200 bg-ink-50/60"}`}
                      key={c.id}
                    >
                      <ConquistaIcone bloqueada={!ganha} icone={c.icone} tamanho={40} tier={c.tier} />
                      <div className="min-w-0">
                        <strong className={`block truncate text-sm font-medium ${ganha ? "text-ink-900" : "text-ink-600"}`}>
                          {nomeConquista(c.nome, ganhas.get(c.id) ?? null)}
                        </strong>
                        <small className={`block truncate text-xs ${ganha ? "text-success" : "text-ink-500"}`}>
                          {ganha ? "Desbloqueada" : c.descricao ?? "Continue estudando"}
                        </small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}

        {aba === "molduras" ? (
          <>
            <CardHeader
              action={
                perfil.moldura ? (
                  <Button disabled={salvando !== null} onClick={() => void equipar("moldura", null)} size="sm" variant="ghost">
                    Tirar moldura
                  </Button>
                ) : null
              }
              icon={<Palette size={18} />}
              title="Molduras de perfil"
            />
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MOLDURAS.map((m) => {
                const livre = desbloqueado(m, perfil.nivel);
                const equipada = perfil.moldura === m.id;
                return (
                  <li className={`flex items-center gap-4 rounded-control border p-4 ${equipada ? "border-primary-500 bg-primary-50" : "border-line bg-white"}`} key={m.id}>
                    <div className={livre ? "" : "opacity-40 grayscale"}>{avatar(m.id)}</div>
                    <div className="min-w-0 flex-1">
                      <strong className="block text-sm font-semibold text-ink-900">{m.nome}</strong>
                      <small className="text-xs text-ink-500">Nível {m.nivel}</small>
                      <div className="mt-2">
                        {equipada ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
                            <Check size={14} /> Equipada
                          </span>
                        ) : livre ? (
                          <Button disabled={salvando !== null} onClick={() => void equipar("moldura", m.id)} size="sm" variant="secondary">
                            Equipar
                          </Button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                            <Lock size={13} /> Bloqueada
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        {aba === "banners" ? (
          <>
            <CardHeader icon={<ImageIcon size={18} />} title="Banners de fundo" />
            <p className="-mt-2 mb-4 text-sm text-ink-500">Equipar um banner pronto substitui a imagem enviada no perfil. Você pode enviar outra imagem quando quiser.</p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BANNERS.map((b) => {
                const livre = desbloqueado(b, perfil.nivel);
                const valor = `${PREFIXO_BANNER}${b.id}`;
                const equipado = perfil.banner_url === valor;
                return (
                  <li className={`overflow-hidden rounded-control border ${equipado ? "border-primary-500 ring-2 ring-primary-100" : "border-line"}`} key={b.id}>
                    <div className={`relative h-20 ${livre ? "" : "opacity-40 grayscale"}`} style={{ background: gradienteCss(b.cores) }}>
                      {livre ? null : (
                        <span className="absolute inset-0 flex items-center justify-center text-white">
                          <Lock size={18} />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-white p-3">
                      <div className="min-w-0">
                        <strong className="block truncate text-sm font-semibold text-ink-900">{b.nome}</strong>
                        <small className="text-xs text-ink-500">Nível {b.nivel}</small>
                      </div>
                      {equipado ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
                          <Check size={14} /> Equipado
                        </span>
                      ) : livre ? (
                        <Button disabled={salvando !== null} onClick={() => void equipar("banner_url", valor)} size="sm" variant="secondary">
                          Equipar
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </Card>
    </>
  );
}

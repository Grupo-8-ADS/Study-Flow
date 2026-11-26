"use client";

import { useState } from "react";
import { Check, Gift, Image as ImageIcon, Lock, Palette, Sparkles, Trophy } from "lucide-react";
import {
  BANNERS,
  MOLDURAS,
  desbloqueado,
  equiparRecompensa,
  gradienteCss,
  nomeConquista,
  resumoColecao,
  textoProximaRecompensa,
  valorBanner,
  type CampoRecompensa,
} from "@studyflow/shared";
import { supabase } from "@/lib/supabase";
import { getCurrentSupabaseUserId } from "@/lib/studyflow-data";
import { CHAVES, SemSessaoError, useConsulta } from "@/lib/consultas";
import { atualizarPerfilEmCache, usePerfil } from "@/lib/perfil";
import { ConquistaIcone } from "@/components/conquista-icone";
import { MolduraAvatar, PreviaBanner } from "@/components/moldura-avatar";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState, PageLoading } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";

type ConquistaLinha = {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  tier: number | null;
};

type ConquistasUsuario = {
  todas: ConquistaLinha[];
  /** Conquistas ganhas: id → disciplina gravada no desbloqueio (nomes com {disciplina}). */
  ganhas: Map<string, string | null>;
};

async function carregarConquistas(): Promise<ConquistasUsuario> {
  const userId = await getCurrentSupabaseUserId();
  if (!userId) throw new SemSessaoError();
  const [ganhas, todas] = await Promise.all([
    supabase.from("user_conquistas").select("conquista_id,detalhe").eq("user_id", userId),
    supabase.from("conquistas").select("id,nome,descricao,icone,tier").order("tier", { ascending: true }),
  ]);
  if (ganhas.error || todas.error) throw new Error("Não foi possível carregar as conquistas.");
  return {
    todas: (todas.data ?? []) as ConquistaLinha[],
    ganhas: new Map((ganhas.data ?? []).map((u) => [u.conquista_id as string, (u.detalhe as string | null) ?? null])),
  };
}

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
  const { dados: perfil, erro: erroPerfil } = usePerfil();
  const { dados: dadosConquistas, erro: erroConquistas } = useConsulta(CHAVES.conquistas, carregarConquistas);
  const [aba, setAba] = useState<Aba>("conquistas");
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (!perfil || !dadosConquistas) {
    const falha = erroPerfil ?? erroConquistas;
    return falha ? <Alert tone="danger">{falha}</Alert> : <PageLoading label="Carregando recompensas..." />;
  }

  const { todas: conquistas, ganhas } = dadosConquistas;
  const nivel = perfil.nivel_atual;
  const resumo = resumoColecao(nivel, { feitos: conquistas.filter((c) => ganhas.has(c.id)).length, total: conquistas.length });
  const contagem: Record<Aba, { feitos: number; total: number }> = resumo;
  const { feitos, total, percentual: progressoGeral } = resumo;

  async function equipar(campo: CampoRecompensa, valor: string | null) {
    if (!perfil) return;
    setErro(null);
    setSalvando(`${campo}:${valor}`);
    const falha = await equiparRecompensa(supabase, perfil.id, campo, valor);
    setSalvando(null);
    if (falha) {
      setErro(falha);
      return;
    }
    // O menu e o perfil leem o mesmo cache: a moldura nova aparece neles na hora.
    atualizarPerfilEmCache(campo === "moldura" ? { moldura: valor } : { banner_url: valor });
  }

  const inicial = perfil.nome.trim()[0]?.toUpperCase() ?? "?";
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
              <h2 className="text-lg font-semibold !text-white">Nível {nivel}</h2>
              <p className="mt-1 max-w-xl text-sm text-primary-100">{textoProximaRecompensa(nivel, perfil.xp)}</p>
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
                const livre = desbloqueado(m, nivel);
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
                const livre = desbloqueado(b, nivel);
                const valor = valorBanner(b);
                const equipado = perfil.banner_url === valor;
                return (
                  <li className={`overflow-hidden rounded-control border ${equipado ? "border-primary-500 ring-2 ring-primary-100" : "border-line"}`} key={b.id}>
                    <div className={`relative h-20 ${livre ? "" : "opacity-40 grayscale"}`}>
                      <PreviaBanner banner={b} miniatura />
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

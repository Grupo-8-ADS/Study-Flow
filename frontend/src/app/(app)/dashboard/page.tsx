"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarCheck, CheckCircle2, Circle, Clock, Flame, Plus, Sparkles, Timer } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  buildDistribution,
  calculateStreak,
  getCurrentSupabaseUserId,
  getLocalStudyMinutes,
  getStoredSession,
  type StudyDistribution,
} from "@/lib/studyflow-data";
import {
  ROTULO_TIPO,
  alternarConcluido,
  dataLocal,
  formatarData,
  hojeStr,
  useAgenda,
  type Compromisso,
  type CompromissoForm,
} from "@/lib/agenda";
import { ESTILO_TIPO } from "@/lib/agenda-estilos";
import { CompromissoEditor } from "@/components/compromisso-editor";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge, Card, CardHeader, Stat } from "@/components/ui/card";
import { EmptyState, PageLoading } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";

type Resumo = { horas: number; sequencia: number; distribuicao: StudyDistribution[] };

/** Prazos (prova, trabalho, atividade) pendentes: atrasados + próximos 14 dias. */
const JANELA_DIAS = 14;

const diasAte = (data: string) => {
  const hoje = dataLocal(hojeStr());
  return Math.round((dataLocal(data).getTime() - hoje.getTime()) / 86_400_000);
};

export default function DashboardPage() {
  const { dados } = useAgenda();
  const [nome, setNome] = useState<string | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [editor, setEditor] = useState<Compromisso | Partial<CompromissoForm> | null>(null);

  useEffect(() => {
    const sessao = getStoredSession();
    if (!sessao) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNome(sessao.nome);

    void (async () => {
      const userId = await getCurrentSupabaseUserId();
      if (!userId) {
        setResumo({ horas: Number((getLocalStudyMinutes(sessao.email) / 60).toFixed(1)), sequencia: 0, distribuicao: [] });
        return;
      }
      const { data: sessoes } = await supabase
        .from("sessoes_estudo")
        .select("duracao_efetiva_min,status,data_inicio,disciplinas(nome)")
        .eq("user_id", userId)
        .eq("status", "concluida");
      const lista = sessoes ?? [];
      const minutos = lista.reduce((s, x) => s + (x.duracao_efetiva_min ?? 0), 0);
      setResumo({
        horas: Number((minutos / 60).toFixed(1)),
        sequencia: calculateStreak(lista.map((x) => String(x.data_inicio))),
        distribuicao: buildDistribution(
          lista.map((x) => {
            const d = Array.isArray(x.disciplinas) ? x.disciplinas[0] : x.disciplinas;
            return { disciplina: d?.nome ?? null, minutes: x.duracao_efetiva_min ?? 0 };
          }),
        ),
      });
    })();
  }, []);

  const prazos = useMemo(
    () =>
      (dados?.compromissos ?? []).filter((c) => c.tipo !== "estudo" && !c.concluido && diasAte(c.data) <= JANELA_DIAS),
    [dados],
  );

  const sugestao = useMemo(() => {
    if (!dados) return null;
    const prova = dados.compromissos.find((c) => c.tipo === "prova" && !c.concluido && diasAte(c.data) >= 0 && diasAte(c.data) <= 7);
    if (prova) {
      const disc = dados.disciplinas.find((d) => d.id === prova.disciplinaId)?.nome;
      const quando = diasAte(prova.data) === 0 ? "hoje" : diasAte(prova.data) === 1 ? "amanhã" : `em ${diasAte(prova.data)} dias`;
      return `${prova.titulo}${disc ? ` (${disc})` : ""} é ${quando}. Priorize essa matéria.`;
    }
    const estudado = new Set(resumo?.distribuicao.map((d) => d.name));
    const semEstudo = dados.disciplinas.find((d) => !estudado.has(d.nome));
    if (semEstudo) return `Você ainda não registrou sessões de ${semEstudo.nome}.`;
    const menos = resumo?.distribuicao.at(-1);
    return menos ? `${menos.name} é a disciplina com menos horas registradas.` : null;
  }, [dados, resumo]);

  if (!nome) return <PageLoading label="Carregando painel..." />;

  const primeiroNome = nome.trim().split(/\s+/)[0] || nome;
  const nomeDisciplina = (id: string | null) => dados?.disciplinas.find((d) => d.id === id)?.nome;

  return (
    <>
      <PageHeader
        actions={
          <Link className={buttonClass("primary", "md")} href="/timer">
            <Timer aria-hidden size={18} />
            Iniciar sessão de foco
          </Link>
        }
        title={`Olá, ${primeiroNome}!`}
      />

      <section aria-label="Resumo" className="grid grid-cols-3 gap-3 sm:gap-4">
        <Stat icon={<Clock size={22} />} label="Horas estudadas" value={resumo ? `${resumo.horas.toLocaleString("pt-BR")}h` : "—"} />
        <Stat icon={<CalendarCheck size={22} />} label="Prazos pendentes" tone="warning" value={dados ? prazos.length : "—"} />
        <Stat
          icon={<Flame size={22} />}
          label="Sequência atual"
          tone="danger"
          value={resumo ? `${resumo.sequencia} ${resumo.sequencia === 1 ? "dia" : "dias"}` : "—"}
        />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader
            action={
              <Button onClick={() => setEditor({ tipo: "trabalho" })} size="sm" variant="secondary">
                <Plus aria-hidden size={16} />
                Novo prazo
              </Button>
            }
            icon={<CalendarCheck size={18} />}
            title="Próximos prazos"
          />

          {!dados ? (
            <div className="h-40 animate-pulse rounded-control bg-ink-100" />
          ) : prazos.length === 0 ? (
            <EmptyState icon={<CalendarCheck size={22} />} title={`Nada para os próximos ${JANELA_DIAS} dias`} />
          ) : (
            <ul className="-mx-2 flex max-h-[380px] flex-col overflow-y-auto">
              {prazos.map((c) => (
                <li className="flex items-center gap-2 rounded-control px-2 py-2 transition-colors hover:bg-ink-50" key={c.id}>
                  <button
                    aria-label={`Concluir "${c.titulo}"`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-primary-100 hover:text-primary-700"
                    onClick={() => void alternarConcluido(c.id)}
                    type="button"
                  >
                    {c.concluido ? <CheckCircle2 className="text-primary-600" size={22} /> : <Circle size={22} />}
                  </button>
                  <button className="min-w-0 flex-1 text-left" onClick={() => setEditor(c)} type="button">
                    <p className="truncate text-sm font-medium text-ink-900">{c.titulo}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                      <Badge tone={ESTILO_TIPO[c.tipo].tone}>{ROTULO_TIPO[c.tipo]}</Badge>
                      {nomeDisciplina(c.disciplinaId) ? <Badge>{nomeDisciplina(c.disciplinaId)}</Badge> : null}
                      <Prazo compromisso={c} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link className="mt-4 inline-block text-sm font-medium text-primary-700 underline-offset-2 hover:underline" href="/atividade">
            Ver todos os compromissos
          </Link>
        </Card>

        <Card className="flex flex-col lg:col-span-5">
          <CardHeader icon={<BookOpen size={18} />} title="Distribuição de estudos" />

          {!resumo ? (
            <div className="h-32 animate-pulse rounded-control bg-ink-100" />
          ) : resumo.distribuicao.length === 0 ? (
            <EmptyState
              action={
                <Link className={buttonClass("secondary", "sm")} href="/timer">
                  Abrir o Timer
                </Link>
              }
              description="Conclua uma sessão no Timer para ver como suas horas se dividem."
              icon={<Clock size={22} />}
              title="Nenhuma sessão concluída ainda"
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {resumo.distribuicao.map((item) => {
                const percentage = item.max > 0 ? (item.hours / item.max) * 100 : 0;
                return (
                  <li className="flex flex-col gap-1.5" key={item.name}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-ink-800">{item.name}</span>
                      <span className="tabular shrink-0 text-xs text-ink-500">{item.hours.toLocaleString("pt-BR")}h</span>
                    </div>
                    <div
                      aria-label={`${item.name}: ${item.hours} horas`}
                      aria-valuemax={item.max}
                      aria-valuemin={0}
                      aria-valuenow={item.hours}
                      className="h-2 w-full overflow-hidden rounded-full bg-ink-100"
                      role="progressbar"
                    >
                      <div className={`h-full rounded-full ${item.color} transition-all duration-500`} style={{ width: `${percentage}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {sugestao ? (
            <div className="mt-auto pt-5">
              <div className="flex items-start gap-3 rounded-control bg-primary-50 p-4 ring-1 ring-primary-100">
                <Sparkles aria-hidden className="mt-0.5 shrink-0 text-primary-700" size={18} />
                <div>
                  <p className="text-sm font-semibold text-primary-800">Foco sugerido</p>
                  <p className="mt-0.5 text-sm text-primary-800/80">{sugestao}</p>
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      {editor && dados ? <CompromissoEditor disciplinas={dados.disciplinas} inicial={editor} onClose={() => setEditor(null)} /> : null}
    </>
  );
}

/** Prazo relativo ("Hoje", "Amanhã", "Em 5 dias", "Atrasado"). */
function Prazo({ compromisso }: { compromisso: Compromisso }) {
  const diff = diasAte(compromisso.data);
  const data = formatarData(compromisso.data);
  const hora = compromisso.horaInicio ? ` às ${compromisso.horaInicio}` : "";
  if (diff < 0) return <span className="font-medium text-danger">Atrasado · {data}</span>;
  if (diff === 0) return <span className="font-medium text-warning">Hoje{hora}</span>;
  if (diff === 1) return <span className="font-medium text-warning">Amanhã{hora}</span>;
  return (
    <span>
      Em {diff} dias · {data}
    </span>
  );
}

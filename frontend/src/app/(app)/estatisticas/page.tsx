"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Check, Download, FileText, Share2, Sparkles, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { limparAgenda } from "@/lib/agenda";
import {
  buildDistribution,
  getCurrentSupabaseUserId,
  getLocalStudyMinutes,
  getStoredSession,
} from "@/lib/studyflow-data";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState, PageLoading } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import {
  dataLocalISO,
  gerarRelatorioPeriodo,
  intervaloDoPeriodo,
  intervaloPersonalizado,
  progressoConquista,
  progressoNivel,
  relatorioParaCSV,
  textoCompartilhamento,
  type CriterioConquista,
  type SessaoRelatorio,
} from "@studyflow/shared";

type Period = "semana" | "mes" | "acumulado";
type ReportMode = "semana" | "mes" | "personalizado";

// Metas sugeridas (horas) usadas quando o usuário ainda não definiu horas diárias no perfil.
const DEFAULT_WEEKLY_GOAL = 28;
const DEFAULT_MONTHLY_GOAL = 80;

const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h${String(rest).padStart(2, "0")}` : `${rest}min`;
};

type UserSession = {
  avatar_url?: string | null;
  email: string;
  nome: string;
  username: string;
};


type PeriodStats = Record<Period, { chart: Array<{ label: string; value: number }>; label: string; topic: string; topicHours: string }>;

const emptyPeriodData: PeriodStats = {
  semana: {
    label: "Semana",
    topic: "Sem dados",
    topicHours: "0H",
    chart: [],
  },
  mes: {
    label: "Mês",
    topic: "Sem dados",
    topicHours: "0H",
    chart: [],
  },
  acumulado: {
    label: "Acumulado",
    topic: "Sem dados",
    topicHours: "0H",
    chart: [],
  },
};

const emptyAchievements = { available: [], completed: [], inProgress: [] } as {
  available: AchievementItem[];
  completed: AchievementItem[];
  inProgress: AchievementItem[];
};

function buildStats(sessoes: Array<{ data_inicio: string; duracao_efetiva_min: number | null; disciplinas: { nome?: string | null } | Array<{ nome?: string | null }> | null }>): PeriodStats {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const makePeriod = (label: string, predicate: (date: Date) => boolean) => {
    const rows = sessoes
      .filter((sessao) => predicate(new Date(sessao.data_inicio)))
      .map((sessao) => {
        const disciplina = Array.isArray(sessao.disciplinas) ? sessao.disciplinas[0] : sessao.disciplinas;

        return {
          disciplina: disciplina?.nome ?? "Sem disciplina",
          minutes: sessao.duracao_efetiva_min ?? 0,
        };
      });
    const distribution = buildDistribution(rows);
    const top = distribution[0];

    return {
      chart: distribution.map((item) => ({ label: item.name, value: item.hours })),
      label,
      topic: top?.name ?? "Sem dados",
      topicHours: `${top?.hours ?? 0}H`,
    };
  };

  return {
    acumulado: makePeriod("Acumulado", () => true),
    mes: makePeriod("Mês", (date) => date >= startOfMonth),
    semana: makePeriod("Semana", (date) => date >= startOfWeek),
  };
}

export default function EstatisticasPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [period, setPeriod] = useState<Period>("semana");
  const [shared, setShared] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [statsData, setStatsData] = useState<PeriodStats>(emptyPeriodData);
  const [featuredAchievements, setFeaturedAchievements] = useState<AchievementItem[]>([]);
  const [allAchievements, setAllAchievements] = useState(emptyAchievements);
  const [level, setLevel] = useState(progressoNivel(0));
  const [dailyHours, setDailyHours] = useState(0);
  const [reportSessions, setReportSessions] = useState<SessaoRelatorio[]>([]);
  const [reportMode, setReportMode] = useState<ReportMode>("semana");
  const [customStart, setCustomStart] = useState(() => dataLocalISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customEnd, setCustomEnd] = useState(() => dataLocalISO(new Date()));

  useEffect(() => {
    async function loadStats() {
      const parsedSession = getStoredSession();

      if (!parsedSession) {
        router.push("/");
        return;
      }

      try {
        setUser(parsedSession);
        const currentUserId = await getCurrentSupabaseUserId(parsedSession);

        if (!currentUserId) {
          const localMinutes = getLocalStudyMinutes(parsedSession.email);
          const localHours = Number((localMinutes / 60).toFixed(1));
          setStatsData({
            acumulado: { chart: localHours ? [{ label: "Sessões locais", value: localHours }] : [], label: "Acumulado", topic: localHours ? "Sessões locais" : "Sem dados", topicHours: `${localHours}H` },
            mes: { chart: [], label: "Mês", topic: "Sem dados", topicHours: "0H" },
            semana: { chart: [], label: "Semana", topic: "Sem dados", topicHours: "0H" },
          });
          return;
        }

        const [{ data: sessoes }, { data: conquistas }, { data: todasConquistas }, { data: profile }] = await Promise.all([
          supabase
            .from("sessoes_estudo")
            .select("duracao_efetiva_min,status,data_inicio,disciplinas(nome)")
            .eq("user_id", currentUserId),
          supabase
            .from("user_conquistas")
            .select("conquistas(nome,descricao)")
            .eq("user_id", currentUserId)
            .order("data_conquista", { ascending: false }),
          supabase.from("conquistas").select("nome,descricao,criterio"),
          supabase.from("profiles").select("avatar_url,xp,horas_diarias").eq("id", currentUserId).maybeSingle(),
        ]);

        if (profile?.avatar_url) {
          setUser((curr) => curr ? { ...curr, avatar_url: profile.avatar_url } : null);
        }

        // O XP e o nível são mantidos pelo banco (trigger); aqui só leitura.
        setLevel(progressoNivel(profile?.xp ?? 0));
        setDailyHours(profile?.horas_diarias ?? 0);

        const completedSessions = (sessoes ?? []).filter((sessao) => sessao.status === "concluida");
        setReportSessions(
          completedSessions.map((sessao) => {
            const disciplina = Array.isArray(sessao.disciplinas) ? sessao.disciplinas[0] : sessao.disciplinas;
            return {
              data_inicio: sessao.data_inicio,
              disciplina_nome: disciplina?.nome ?? null,
              duracao_efetiva_min: sessao.duracao_efetiva_min,
              status: sessao.status,
            };
          }),
        );
        const achievementStats = {
          minutosEstudados: 0,
          sessoesConcluidas: completedSessions.length,
          sessoesPorDisciplina: {} as Record<string, number>,
        };
        for (const sessao of completedSessions) {
          const disciplina = Array.isArray(sessao.disciplinas) ? sessao.disciplinas[0] : sessao.disciplinas;
          const nome = disciplina?.nome ?? "";
          achievementStats.minutosEstudados += sessao.duracao_efetiva_min ?? 0;
          if (nome) achievementStats.sessoesPorDisciplina[nome] = (achievementStats.sessoesPorDisciplina[nome] ?? 0) + 1;
        }
        const periodStats = buildStats(completedSessions);
        const completedAchievements = (conquistas ?? []).map((item) => {
          const conquista = Array.isArray(item.conquistas) ? item.conquistas[0] : item.conquistas;
          return {
            detail: conquista?.descricao ?? "Conquista desbloqueada",
            name: conquista?.nome ?? "Conquista",
          };
        });
        const completedNames = new Set(completedAchievements.map((achievement) => achievement.name));
        // Conquistas ainda bloqueadas: progresso real calculado das sessões concluídas (RF004).
        const lockedAchievements = (todasConquistas ?? [])
          .filter((achievement) => !completedNames.has(achievement.nome))
          .map((achievement) => {
            const progress = progressoConquista(achievement.criterio as CriterioConquista | null, achievementStats);
            return {
              detail: achievement.descricao ?? "Continue estudando para desbloquear",
              name: achievement.nome,
              progress: progress.percentual,
              progressLabel: `${Math.floor(progress.atual)} / ${progress.alvo}`,
            };
          });
        const inProgressAchievements = lockedAchievements.filter((achievement) => achievement.progress > 0);
        const availableAchievements = lockedAchievements.filter((achievement) => achievement.progress === 0);

        setStatsData(periodStats);
        setFeaturedAchievements(completedAchievements.slice(0, 4));
        setAllAchievements({ available: availableAchievements, completed: completedAchievements, inProgress: inProgressAchievements });
      } catch {
        localStorage.removeItem("studyflow_session");
        limparAgenda();
        router.push("/");
      }
    }

    void loadStats();
  }, [router]);


  const shareStats = async () => {
    const current = statsData[period];
    const hours = current.chart.reduce((sum, item) => sum + item.value, 0);
    const text = textoCompartilhamento({
      horas: Number(hours.toFixed(1)),
      nivel: level.nivel,
      periodo: current.label,
      topico: current.chart.length > 0 ? current.topic : null,
    });

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Study Flow", text });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch (error) {
      // Cancelar o compartilhamento não é erro: sem feedback.
      if (error instanceof DOMException && error.name === "AbortError") return;
      // O feedback visual permanece útil caso a API de clipboard não esteja disponível.
    }

    setShared(true);
    setTimeout(() => setShared(false), 2200);
  };

  const buildReport = () => {
    try {
      const range = reportMode === "personalizado"
        ? intervaloPersonalizado(customStart, customEnd)
        : intervaloDoPeriodo(reportMode, new Date());
      return { report: gerarRelatorioPeriodo(reportSessions, range), error: "" };
    } catch (error) {
      return { report: null, error: error instanceof Error ? error.message : "Período inválido" };
    }
  };

  const exportCsv = () => {
    const { report } = buildReport();
    if (!report) return;

    // BOM UTF-8 para o Excel exibir os acentos corretamente.
    const blob = new Blob(["\uFEFF", relatorioParaCSV(report)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-studyflow-${report.inicio}-a-${report.fim}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (!user) {
    return <PageLoading label="Carregando estatísticas..." />;
  }

  const current = statsData[period];
  const maxValue = Math.max(1, ...current.chart.map((item) => item.value));
  const weeklyHours = statsData.semana.chart.reduce((sum, item) => sum + item.value, 0);
  const monthlyHours = statsData.mes.chart.reduce((sum, item) => sum + item.value, 0);
  // Metas derivadas das horas diárias do perfil (semana = 7 dias, mês = 30 dias).
  const hasGoal = dailyHours > 0;
  const weeklyGoal = hasGoal ? dailyHours * 7 : DEFAULT_WEEKLY_GOAL;
  const monthlyGoal = hasGoal ? dailyHours * 30 : DEFAULT_MONTHLY_GOAL;
  const weeklyProgress = Math.min(100, Math.round((weeklyHours / weeklyGoal) * 100));
  const monthlyProgress = Math.min(100, Math.round((monthlyHours / monthlyGoal) * 100));
  const { report, error: reportError } = buildReport();

  return (
    <>
      <PageHeader
        actions={
          <Button onClick={shareStats} variant={shared ? "secondary" : "primary"}>
            {shared ? <Check aria-hidden size={18} /> : <Share2 aria-hidden size={18} />}
            {shared ? "Resumo copiado" : "Compartilhar progresso"}
          </Button>
        }
        title="Estatísticas"
      />

      <section aria-label="Total de horas estudadas" className="grid gap-4 sm:grid-cols-3">
        <SummaryRing label="Semana" note={`${hasGoal ? "Meta" : "Meta sugerida"}: ${formatHours(weeklyGoal)}`} progress={weeklyProgress} value={formatHours(weeklyHours)} />
        <SummaryRing label="Mês" note={`${hasGoal ? "Meta" : "Meta sugerida"}: ${formatHours(monthlyGoal)}`} progress={monthlyProgress} value={formatHours(monthlyHours)} />
        <Card as="article" aria-label="Nível" className="flex items-center gap-4 !p-5">
          <LevelRing level={level.nivel} progress={Math.round(level.progresso * 100)} />
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink-500">Nível atual</p>
            <p className="text-lg font-semibold text-ink-900">Nível {level.nivel}</p>
            <p className="tabular text-xs text-ink-500">
              {level.xpNoNivel}/100 XP · faltam {level.faltam}
            </p>
          </div>
        </Card>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            action={
              <Segmented
                label="Período do gráfico"
                onChange={(value) => setPeriod(value as Period)}
                options={(Object.keys(statsData) as Period[]).map((item) => [item, statsData[item].label])}
                value={period}
              />
            }
            description={
              current.chart.length > 0 ? `Mais estudado: ${current.topic} (${current.topicHours.replace("H", " h")})` : undefined
            }
            icon={<BarChart3 size={18} />}
            title="Disciplinas mais estudadas"
          />

          {current.chart.length === 0 ? (
            <EmptyState
              className="h-[300px]"
              description="Conclua sessões no Timer para gerar estatísticas reais."
              icon={<BarChart3 size={22} />}
              title="Sem sessões neste período"
            />
          ) : (
            <div className="relative h-[300px] pt-6">
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-12 top-6 flex flex-col justify-between">
                {[0, 1, 2, 3].map((line) => (
                  <span className="border-t border-dashed border-ink-200" key={line} />
                ))}
              </div>
              <ul className="relative z-10 flex h-full items-end justify-around gap-3">
                {current.chart.map((item) => {
                  const height = Math.max(6, Math.round((item.value / maxValue) * 82));
                  return (
                    <li className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" key={item.label}>
                      <span className="tabular mb-1.5 text-xs font-semibold text-primary-800">{item.value.toLocaleString("pt-BR")} h</span>
                      <div
                        aria-label={`${item.label}: ${item.value} horas`}
                        className="w-full max-w-[64px] rounded-t-[8px] bg-primary-600 transition-all duration-500"
                        role="img"
                        style={{ height: `${height}%` }}
                      />
                      <span className="mt-2 line-clamp-2 min-h-10 text-center text-xs leading-4 text-ink-600">{item.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Card>

        <Card className="flex flex-col xl:col-span-4">
          <CardHeader
            action={<Trophy aria-hidden className="text-gold" size={20} />}
            title="Conquistas"
          />
          <ul className="flex flex-col gap-2">
            {featuredAchievements.map((achievement) => (
              <li className="flex items-center gap-3 rounded-control border border-line p-3" key={achievement.name}>
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gold-soft text-gold">
                  <Trophy size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm font-medium text-ink-900">{achievement.name}</strong>
                  <small className="block truncate text-xs text-ink-500">{achievement.detail}</small>
                </span>
              </li>
            ))}
          </ul>
          <Button className="mt-auto w-full" onClick={() => setShowAchievements(true)} variant="secondary">
            Ver todas as conquistas
          </Button>
        </Card>
      </div>

      <Card aria-labelledby="report-title" className="mt-6">
        <CardHeader
          action={
            <>
              <Segmented
                label="Período do relatório"
                onChange={(value) => setReportMode(value as ReportMode)}
                options={[
                  ["semana", "Semana"],
                  ["mes", "Mês"],
                  ["personalizado", "Personalizado"],
                ]}
                value={reportMode}
              />
              <Button disabled={!report} onClick={exportCsv} variant="secondary">
                <Download aria-hidden size={16} />
                Exportar CSV
              </Button>
            </>
          }
          description={report ? `De ${formatIsoDate(report.inicio)} a ${formatIsoDate(report.fim)}` : "Escolha o período."}
          icon={<FileText size={18} />}
          id="report-title"
          title="Relatório de estudos"
        />

        {reportMode === "personalizado" ? (
          <div className="mb-4 grid max-w-md grid-cols-2 gap-3">
            <Field htmlFor="relatorio-inicio" label="Data inicial">
              <Input id="relatorio-inicio" onChange={(event) => setCustomStart(event.target.value)} type="date" value={customStart} />
            </Field>
            <Field htmlFor="relatorio-fim" label="Data final">
              <Input id="relatorio-fim" onChange={(event) => setCustomEnd(event.target.value)} type="date" value={customEnd} />
            </Field>
          </div>
        ) : null}

        {reportError ? (
          <Alert className="mb-4" tone="danger">
            {reportError}
          </Alert>
        ) : null}

        {report ? (
          <>
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Total de horas", formatHours(report.totalMinutos / 60)],
                ["Sessões", String(report.totalSessoes)],
                ["Dias estudados", String(report.diasEstudados)],
                ["Média por dia", formatMinutes(report.mediaMinutosPorDia)],
              ].map(([label, value]) => (
                <div className="rounded-control bg-ink-50 p-4" key={label}>
                  <dt className="text-xs font-medium text-ink-500">{label}</dt>
                  <dd className="tabular mt-1 text-lg font-semibold text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-ink-500">
                    <th className="py-2 pr-4 font-medium" scope="col">Disciplina</th>
                    <th className="py-2 pr-4 font-medium" scope="col">Tempo</th>
                    <th className="py-2 pr-4 font-medium" scope="col">Sessões</th>
                    <th className="py-2 font-medium" scope="col">%</th>
                  </tr>
                </thead>
                <tbody>
                  {report.porDisciplina.length === 0 ? (
                    <tr>
                      <td className="py-6 text-center text-ink-500" colSpan={4}>
                        Nenhuma sessão concluída neste período.
                      </td>
                    </tr>
                  ) : (
                    report.porDisciplina.map((linha) => (
                      <tr className="border-b border-line text-ink-700 last:border-0" key={linha.disciplina}>
                        <td className="py-2.5 pr-4 font-medium text-ink-900">{linha.disciplina}</td>
                        <td className="tabular py-2.5 pr-4">{formatMinutes(linha.minutos)}</td>
                        <td className="tabular py-2.5 pr-4">{linha.sessoes}</td>
                        <td className="tabular py-2.5">{linha.percentual}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </Card>

      {showAchievements ? (
        <Modal
          onClose={() => setShowAchievements(false)}
          size="lg"
          title="Todas as conquistas"
          titleId="all-achievements-title"
        >
          <div className="flex flex-col gap-7">
            <AchievementGroup achievements={allAchievements.completed} title="Concluídas" type="completed" />
            <AchievementGroup achievements={allAchievements.inProgress} title="Em andamento" type="progress" />
            <AchievementGroup achievements={allAchievements.available} title="Disponíveis" type="available" />
          </div>
        </Modal>
      ) : null}
    </>
  );
}

/** Horas no formato brasileiro: "1,5 h". */
function formatHours(hours: number) {
  return `${Number(hours.toFixed(1)).toLocaleString("pt-BR")} h`;
}

function formatIsoDate(value: string) {
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<[string, string]>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div aria-label={label} className="flex rounded-control bg-ink-100 p-0.5" role="group">
      {options.map(([key, text]) => (
        <button
          aria-pressed={value === key}
          className={`h-8 rounded-[8px] px-3 text-[13px] font-medium transition-colors ${
            value === key ? "bg-white text-ink-900 shadow-card" : "text-ink-600 hover:text-ink-900"
          }`}
          key={key}
          onClick={() => onChange(key)}
          type="button"
        >
          {text}
        </button>
      ))}
    </div>
  );
}

type AchievementItem = {
  detail: string;
  name: string;
  progress?: number;
  progressLabel?: string;
};

function AchievementGroup({
  achievements,
  title,
  type,
}: {
  achievements: AchievementItem[];
  title: string;
  type: "available" | "completed" | "progress";
}) {
  return (
    <section>
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-ink-900">{title}</h3>
          <Badge>{achievements.length}</Badge>
        </div>
      </div>

      {achievements.length === 0 ? (
        <p className="rounded-control border border-dashed border-ink-200 px-4 py-3 text-sm text-ink-500">Nada por aqui ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {achievements.map((achievement) => (
            <li
              className={`flex items-center gap-3 rounded-control border p-3 ${type === "available" ? "border-dashed border-ink-200 bg-ink-50/60" : "border-line bg-white"}`}
              key={achievement.name}
            >
              <span
                aria-hidden
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${
                  type === "completed" ? "bg-gold-soft text-gold" : type === "progress" ? "bg-primary-100 text-primary-700" : "bg-ink-100 text-ink-400"
                }`}
              >
                {type === "progress" ? <Sparkles size={19} /> : <Trophy size={19} />}
              </span>

              <span className="min-w-0 flex-1">
                <strong className="block text-sm font-medium text-ink-900">{achievement.name}</strong>
                <small className="mt-0.5 block text-xs leading-5 text-ink-500">{achievement.detail}</small>

                {type === "progress" && achievement.progress !== undefined ? (
                  <span className="mt-2 flex items-center gap-3">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                      <span className="block h-full rounded-full bg-primary-600" style={{ width: `${achievement.progress}%` }} />
                    </span>
                    <span className="tabular text-xs font-medium text-ink-600">
                      {achievement.progressLabel ? `${achievement.progressLabel} · ` : ""}
                      {achievement.progress}%
                    </span>
                  </span>
                ) : null}
              </span>

              {type === "completed" ? (
                <span aria-label="Concluída" className="flex h-7 w-7 items-center justify-center rounded-full bg-success-soft text-success">
                  <Check size={15} />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SummaryRing({ label, note, progress, value }: { label: string; note?: string; progress: number; value: string }) {
  return (
    <Card aria-label={`Tempo: ${label}`} as="article" className="flex items-center gap-4 !p-5">
      <div
        aria-hidden
        className="grid h-16 w-16 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(var(--color-primary-500) ${progress}%, var(--color-ink-100) ${progress}% 100%)` }}
      >
        <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-white">
          <span className="tabular text-xs font-semibold text-primary-800">{progress}%</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink-500">{label}</p>
        <p className="tabular text-lg font-semibold text-ink-900">{value}</p>
        {note ? <p className="text-xs text-ink-500">{note}</p> : null}
      </div>
    </Card>
  );
}

function LevelRing({ level, progress }: { level: number; progress: number }) {
  return (
    <div
      aria-hidden
      className="grid h-16 w-16 shrink-0 place-items-center rounded-full"
      style={{ background: `conic-gradient(var(--color-gold) ${progress}%, var(--color-ink-100) ${progress}% 100%)` }}
    >
      <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-white">
        <span className="text-lg font-semibold text-ink-900">{level}</span>
      </div>
    </div>
  );
}

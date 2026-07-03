"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  Check,
  Gift,
  LayoutDashboard,
  LogOut,
  Settings,
  Share2,
  Sparkles,
  Timer,
  Trophy,
  User,
  X,
} from "lucide-react";

type Period = "semana" | "mes" | "acumulado";

type UserSession = {
  email: string;
  nome: string;
  username: string;
};

const menuItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Calendário", href: "/calendario", icon: Calendar },
  { name: "Atividade", href: "/atividade", icon: Activity },
  { name: "Disciplinas", href: "/disciplinas", icon: BookOpen },
  { name: "Timer", href: "/timer", icon: Timer },
  { name: "Estatísticas", href: "/estatisticas", icon: BarChart3 },
  { name: "Recompensas", href: "/rewards", icon: Gift },
  { name: "Configurações", href: "/configuracoes", icon: Settings },
];

const periodData = {
  semana: {
    label: "Semana",
    topic: "História",
    topicHours: "8H",
    chart: [
      { label: "História", value: 8 },
      { label: "Matemática", value: 6 },
      { label: "Banco de Dados", value: 5 },
      { label: "Algoritmos", value: 4 },
      { label: "Redes", value: 2 },
    ],
  },
  mes: {
    label: "Mês",
    topic: "Matemática",
    topicHours: "22H",
    chart: [
      { label: "Matemática", value: 22 },
      { label: "História", value: 18 },
      { label: "Algoritmos", value: 15 },
      { label: "Banco de Dados", value: 12 },
      { label: "Redes", value: 8 },
    ],
  },
  acumulado: {
    label: "Acumulado",
    topic: "História",
    topicHours: "110H",
    chart: [
      { label: "História", value: 110 },
      { label: "Matemática", value: 92 },
      { label: "Banco de Dados", value: 76 },
      { label: "Algoritmos", value: 61 },
      { label: "Redes", value: 45 },
    ],
  },
} satisfies Record<Period, { chart: Array<{ label: string; value: number }>; label: string; topic: string; topicHours: string }>;

const featuredAchievements = [
  { name: "Especialista em História I", detail: "10 horas estudadas em História" },
  { name: "Iniciante em Ciências", detail: "Primeira sessão concluída" },
  { name: "Especialista em Geografia", detail: "Meta semanal alcançada" },
  { name: "Sequência de Foco", detail: "5 dias consecutivos estudando" },
];

const allAchievements = {
  completed: [
    { name: "Especialista em História I", detail: "10 horas estudadas em História" },
    { name: "Iniciante em Ciências", detail: "Primeira sessão concluída" },
    { name: "Especialista em Geografia", detail: "Meta semanal alcançada" },
    { name: "Sequência de Foco", detail: "5 dias consecutivos estudando" },
  ],
  available: [
    { name: "Mestre de Matemática", detail: "Estude Matemática por 20 horas" },
    { name: "Explorador de Disciplinas", detail: "Estude cinco disciplinas diferentes" },
    { name: "Madrugador", detail: "Conclua uma sessão antes das 8h" },
  ],
  inProgress: [
    { name: "Especialista Multidisciplinar", detail: "Complete 10 horas em três disciplinas", progress: 70 },
    { name: "Mestre de Hábitos", detail: "Estude durante 15 dias consecutivos", progress: 53 },
    { name: "Iniciante em Compartilhamento", detail: "Compartilhe três resultados", progress: 33 },
  ],
};

export default function EstatisticasPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [period, setPeriod] = useState<Period>("semana");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [shared, setShared] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);

  useEffect(() => {
    const storedSession = localStorage.getItem("studyflow_session");

    if (!storedSession) {
      router.push("/");
      return;
    }

    try {
      const parsedSession = JSON.parse(storedSession) as UserSession;
      setTimeout(() => setUser(parsedSession), 0);
    } catch {
      localStorage.removeItem("studyflow_session");
      router.push("/");
    }
  }, [router]);

  const logout = () => {
    localStorage.removeItem("studyflow_session");
    router.push("/");
  };

  const shareStats = async () => {
    const current = periodData[period];
    const text = `Estou no nível 12 no Study Flow! Meu tópico mais estudado em ${current.label.toLowerCase()} foi ${current.topic}, com ${current.topicHours}.`;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // O feedback visual permanece útil caso a API de clipboard não esteja disponível.
    }

    setShared(true);
    setTimeout(() => setShared(false), 2200);
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7fdfd]">
        <p className="animate-pulse text-lg font-medium text-[#29645e]">Carregando estatísticas...</p>
      </div>
    );
  }

  const current = periodData[period];
  const maxValue = Math.max(...current.chart.map((item) => item.value));

  return (
    <div className="flex min-h-screen flex-col bg-[#f7fdfd] font-[Roboto] lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col justify-between bg-[#29645e] px-4 py-6 text-white shadow-lg lg:min-h-screen lg:w-[260px]">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3 px-2">
            <h1 className="font-['Rubik_Bubbles'] text-2xl font-normal tracking-wider">Study Flow</h1>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.name === "Estatísticas";

              return (
                <button
                  className={`flex shrink-0 cursor-pointer items-center gap-3 rounded-[15px] px-4 py-3 text-base font-medium transition duration-200 lg:w-full ${
                    isActive
                      ? "bg-white text-[#29645e] shadow-md lg:scale-[1.02]"
                      : "text-gray-100 hover:bg-[#347871] hover:text-white"
                  }`}
                  key={item.name}
                  onClick={() => router.push(item.href)}
                  type="button"
                >
                  <Icon className="shrink-0" size={20} />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <button
          className="mt-8 flex w-full cursor-pointer items-center gap-3 rounded-[15px] px-4 py-3 text-base font-medium text-red-200 transition duration-200 hover:bg-[#a83232] hover:text-white"
          onClick={logout}
          type="button"
        >
          <LogOut className="shrink-0" size={20} />
          <span>Sair</span>
        </button>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col overflow-y-auto px-4 py-6 lg:px-8">
        <header className="relative flex items-center justify-between border-b border-gray-100 pb-6">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[#5f8d87]">Seu progresso</p>
            <h2 className="text-2xl font-bold text-gray-800 lg:text-3xl">Estatísticas</h2>
          </div>

          <div className="relative flex items-center gap-4">
            <div className="relative">
              <button
                aria-label="Abrir notificações"
                className="relative cursor-pointer rounded-full border border-gray-100 bg-white p-2.5 text-gray-600 shadow-sm transition hover:bg-[#eaf6f4] hover:text-[#29645e]"
                onClick={() => {
                  setShowNotifications((currentValue) => !currentValue);
                  setShowProfile(false);
                }}
                type="button"
              >
                <Bell size={20} />
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
              </button>

              {showNotifications ? (
                <div className="absolute right-0 z-40 mt-3 w-72 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl">
                  <p className="font-semibold text-gray-700">Notificações</p>
                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    Você completou 5 horas de estudo hoje. Continue assim!
                  </p>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                aria-label="Abrir perfil"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-[#eaf6f4] text-[#29645e] shadow-sm transition hover:border-[#29645e]"
                onClick={() => {
                  setShowProfile((currentValue) => !currentValue);
                  setShowNotifications(false);
                }}
                type="button"
              >
                <User size={22} />
              </button>

              {showProfile ? (
                <div className="absolute right-0 z-40 mt-3 w-64 rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-xl">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#29645e] text-xl font-bold text-white shadow-md">
                    {user.nome.charAt(0).toUpperCase()}
                  </div>
                  <p className="font-semibold text-gray-800">{user.nome}</p>
                  <p className="text-xs text-gray-500">@{user.username}</p>
                  <p className="mt-1 break-all text-xs text-gray-400">{user.email}</p>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="mx-auto mt-7 flex w-full max-w-6xl flex-col gap-6">
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5f8d87]">Resumo</p>
                <h3 className="mt-1 text-xl font-bold text-gray-800">Total de horas estudadas</h3>
              </div>
              <p className="hidden text-sm text-gray-400 sm:block">Atualizado hoje</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryRing label="Semana" progress={54} value="15H" />
              <SummaryRing label="Meta semanal" progress={100} value="28H" />
              <SummaryRing label="Hoje" progress={72} value="5H" />
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
            <section className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(41,100,94,0.05)] lg:p-7">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5f8d87]">Desempenho</p>
                    <h3 className="mt-1 text-xl font-bold text-gray-800">Disciplinas/Tópicos mais estudados</h3>
                  </div>

                  <div className="flex rounded-2xl bg-[#eef6f4] p-1">
                    {(Object.keys(periodData) as Period[]).map((item) => (
                      <button
                        className={`cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold transition sm:px-4 ${
                          period === item ? "bg-[#29645e] text-white shadow-sm" : "text-[#4f716c] hover:bg-white/70"
                        }`}
                        key={item}
                        onClick={() => setPeriod(item)}
                        type="button"
                      >
                        {periodData[item].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative mt-3 h-[360px] rounded-[24px] border border-[#edf3f2] bg-[#fbfdfc] px-4 pb-4 pt-8 sm:px-7">
                  <div className="pointer-events-none absolute inset-x-4 bottom-14 top-8 flex flex-col justify-between sm:inset-x-7">
                    {[0, 1, 2, 3, 4].map((line) => (
                      <span className="border-t border-dashed border-[#dce8e5]" key={line} />
                    ))}
                  </div>

                  <div className="relative z-10 flex h-full items-end justify-around gap-3">
                    {current.chart.map((item, index) => {
                      const height = Math.max(18, Math.round((item.value / maxValue) * 88));

                      return (
                        <div className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" key={item.label}>
                          <span className="mb-2 text-xs font-bold text-[#29645e]">{item.value}H</span>
                          <div
                            className="w-full max-w-[72px] rounded-t-[18px] bg-gradient-to-t from-[#29645e] to-[#73c7b4] shadow-[0_8px_18px_rgba(41,100,94,0.12)] transition-all duration-500"
                            style={{ height: `${height}%`, opacity: 1 - index * 0.055 }}
                          />
                          <span className="mt-3 line-clamp-2 min-h-8 text-center text-[10px] font-semibold leading-4 text-gray-500 sm:text-xs">
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <aside className="flex flex-col gap-6">
              <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-[0_8px_30px_rgba(41,100,94,0.05)]">
                <div className="flex flex-col items-center text-center">
                  <LevelRing level={12} progress={76} />
                  <div className="mt-5 grid w-full grid-cols-2 gap-3 text-left">
                    <div className="rounded-2xl bg-[#f7fbfa] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tópico mais estudado</p>
                      <p className="mt-2 font-bold text-gray-800">{current.topic}</p>
                    </div>
                    <div className="rounded-2xl bg-[#f7fbfa] p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Horas no tópico</p>
                      <p className="mt-2 font-bold text-gray-800">{current.topicHours}</p>
                    </div>
                  </div>

                  <button
                    className={`mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl px-5 py-3 font-semibold text-white shadow-sm transition ${
                      shared ? "bg-[#3f8c72]" : "bg-[#29645e] hover:bg-[#1f514d]"
                    }`}
                    onClick={shareStats}
                    type="button"
                  >
                    {shared ? <Check size={18} /> : <Share2 size={18} />}
                    {shared ? "Resumo copiado" : "Compartilhar progresso"}
                  </button>
                </div>
              </section>

              <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-[0_8px_30px_rgba(41,100,94,0.05)]">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5f8d87]">Conquistas</p>
                    <h3 className="mt-1 text-lg font-bold text-gray-800">Últimas 4</h3>
                  </div>
                  <Sparkles className="text-[#c58b14]" size={21} />
                </div>

                <div className="flex flex-col gap-3">
                  {featuredAchievements.map((achievement, index) => (
                    <div className="flex items-center gap-3 rounded-2xl bg-[#f7f9f8] p-3" key={achievement.name}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fff4d6] text-[#b57d0b]">
                        <Trophy size={19} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm text-gray-800">{achievement.name}</strong>
                        <small className="mt-0.5 block truncate text-xs text-gray-400">{achievement.detail}</small>
                      </span>
                      <span className="text-xs font-bold text-[#8aa29e]">0{index + 1}</span>
                    </div>
                  ))}
                </div>

                <button
                  className="mt-4 w-full cursor-pointer rounded-2xl border border-[#cfe2df] bg-white px-4 py-3 text-sm font-bold text-[#29645e] transition hover:bg-[#f1f8f6]"
                  onClick={() => setShowAchievements(true)}
                  type="button"
                >
                  Todas as Conquistas
                </button>
              </section>
            </aside>
          </div>
        </div>
      </main>

      {showAchievements ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142421]/45 p-4 backdrop-blur-sm">
          <section
            aria-labelledby="all-achievements-title"
            aria-modal="true"
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[30px] border border-white/80 bg-[#f8fcfb] shadow-2xl"
            role="dialog"
          >
            <header className="flex items-start justify-between border-b border-[#dfecea] bg-white px-6 py-5 sm:px-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5f8d87]">Seu progresso</p>
                <h2 className="mt-1 text-2xl font-bold text-gray-800" id="all-achievements-title">
                  Todas as Conquistas
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Veja o que você já conquistou e os próximos desafios.
                </p>
              </div>
              <button
                aria-label="Fechar conquistas"
                className="cursor-pointer rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                onClick={() => setShowAchievements(false)}
                type="button"
              >
                <X size={21} />
              </button>
            </header>

            <div className="flex flex-col gap-7 overflow-y-auto p-5 sm:p-7">
              <AchievementGroup
                achievements={allAchievements.completed}
                description="Conquistas que já fazem parte do seu perfil."
                title="Concluídas"
                type="completed"
              />
              <AchievementGroup
                achievements={allAchievements.inProgress}
                description="Desafios que estão avançando conforme você estuda."
                title="Em andamento"
                type="progress"
              />
              <AchievementGroup
                achievements={allAchievements.available}
                description="Novos objetivos que você pode começar a completar."
                title="Disponíveis"
                type="available"
              />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

type AchievementItem = {
  detail: string;
  name: string;
  progress?: number;
};

function AchievementGroup({
  achievements,
  description,
  title,
  type,
}: {
  achievements: AchievementItem[];
  description: string;
  title: string;
  type: "available" | "completed" | "progress";
}) {
  return (
    <section>
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <span className="rounded-full bg-[#e5f1ef] px-2.5 py-1 text-[10px] font-bold text-[#547771]">
            {achievements.length}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      <div className="flex flex-col gap-3">
        {achievements.map((achievement) => (
          <article
            className={`flex items-center gap-4 rounded-2xl border p-4 ${
              type === "completed"
                ? "border-[#d8e9e5] bg-white"
                : type === "progress"
                  ? "border-[#dfe9e7] bg-white"
                  : "border-dashed border-[#d7e3e1] bg-white/65"
            }`}
            key={achievement.name}
          >
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                type === "completed"
                  ? "bg-[#fff3d2] text-[#b57d0b]"
                  : type === "progress"
                    ? "bg-[#e5f3f0] text-[#29645e]"
                    : "bg-[#eef2f1] text-[#879b97]"
              }`}
            >
              {type === "completed" ? <Trophy size={21} /> : type === "progress" ? <Sparkles size={21} /> : <Trophy size={21} />}
            </span>

            <span className="min-w-0 flex-1">
              <strong className="block text-sm text-gray-800">{achievement.name}</strong>
              <small className="mt-1 block text-xs leading-5 text-gray-500">{achievement.detail}</small>

              {type === "progress" && achievement.progress !== undefined ? (
                <span className="mt-3 flex items-center gap-3">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#e3ecea]">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-[#29645e] to-[#63c3ae]"
                      style={{ width: `${achievement.progress}%` }}
                    />
                  </span>
                  <span className="text-xs font-bold text-[#547771]">{achievement.progress}%</span>
                </span>
              ) : null}
            </span>

            {type === "completed" ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e4f3ea] text-[#31805d]">
                <Check size={16} />
              </span>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function SummaryRing({ label, progress, value }: { label: string; progress: number; value: string }) {
  return (
    <article className="flex items-center gap-4 rounded-[24px] border border-gray-100 bg-white p-5 shadow-[0_8px_25px_rgba(41,100,94,0.045)]">
      <div
        className="grid h-20 w-20 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(#57c7b2 ${progress}%, #dcece9 ${progress}% 100%)` }}
      >
        <div className="grid h-[66px] w-[66px] place-items-center rounded-full bg-white">
          <strong className="text-lg text-[#29645e]">{value}</strong>
        </div>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Tempo</p>
        <h4 className="mt-1 text-base font-bold text-gray-800">{label}</h4>
        <p className="mt-1 text-xs text-gray-400">{progress}% do objetivo</p>
      </div>
    </article>
  );
}

function LevelRing({ level, progress }: { level: number; progress: number }) {
  return (
    <div
      className="grid h-40 w-40 place-items-center rounded-full"
      style={{ background: `conic-gradient(#57c7b2 ${progress}%, #dcece9 ${progress}% 100%)` }}
    >
      <div className="flex h-[138px] w-[138px] flex-col items-center justify-center rounded-full bg-white shadow-inner">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#6c9791]">Nível</span>
        <strong className="mt-1 text-4xl font-bold text-[#29645e]">{level}</strong>
        <small className="mt-1 text-xs text-gray-400">{progress}% concluído</small>
      </div>
    </div>
  );
}

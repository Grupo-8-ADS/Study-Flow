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
  Image as ImageIcon,
  LayoutDashboard,
  Lock,
  LogOut,
  Palette,
  Settings,
  Sparkles,
  Timer,
  User,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentSupabaseUserId, getStoredSession } from "@/lib/studyflow-data";

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

const baseRewardCollections = [
  {
    title: "Ícones de perfil",
    description: "Personalize seu avatar com símbolos conquistados durante seus estudos.",
    unlocked: 0,
    total: 0,
    icon: User,
    colors: ["#29645e", "#65bfaa"],
    items: [] as string[],
  },
  {
    title: "Bordas de perfil",
    description: "Destaque seu perfil com molduras especiais de nível e conquistas.",
    unlocked: 0,
    total: 5,
    icon: Palette,
    colors: ["#705c9d", "#b09cda"],
    items: [] as string[],
  },
  {
    title: "Banners de fundo",
    description: "Desbloqueie cenários para deixar seu perfil com a sua cara.",
    unlocked: 0,
    total: 5,
    icon: ImageIcon,
    colors: ["#c08032", "#e6bd72"],
    items: [] as string[],
  },
];

export default function RewardsPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(0);
  const [rewardCollections, setRewardCollections] = useState(baseRewardCollections);

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

        const [{ data: unlocked }, { data: total }] = await Promise.all([
          supabase.from("user_conquistas").select("conquistas(nome)").eq("user_id", currentUserId),
          supabase.from("conquistas").select("nome"),
        ]);
        const unlockedNames = (unlocked ?? []).map((item) => {
          const conquista = Array.isArray(item.conquistas) ? item.conquistas[0] : item.conquistas;
          return conquista?.nome ?? "Conquista";
        });

        setRewardCollections([
          {
            ...baseRewardCollections[0],
            items: unlockedNames,
            total: total?.length ?? 0,
            unlocked: unlockedNames.length,
          },
          baseRewardCollections[1],
          baseRewardCollections[2],
        ]);
      } catch {
        localStorage.removeItem("studyflow_session");
        router.push("/");
      }
    }

    void loadRewards();
  }, [router]);

  const logout = () => {
    localStorage.removeItem("studyflow_session");
    router.push("/");
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7fdfd]">
        <p className="animate-pulse text-lg font-medium text-[#29645e]">Carregando recompensas...</p>
      </div>
    );
  }

  const selected = rewardCollections[selectedCollection];
  const totalRewards = rewardCollections.reduce((sum, collection) => sum + collection.total, 0);
  const unlockedRewards = rewardCollections.reduce((sum, collection) => sum + collection.unlocked, 0);
  const generalProgress = totalRewards > 0 ? Math.round((unlockedRewards / totalRewards) * 100) : 0;

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
              const isActive = item.name === "Recompensas";

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
          className="mt-8 flex w-full cursor-pointer items-center gap-3 rounded-[15px] px-4 py-3 text-base font-medium text-red-200 transition hover:bg-[#a83232] hover:text-white"
          onClick={logout}
          type="button"
        >
          <LogOut size={20} />
          <span>Sair</span>
        </button>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col overflow-y-auto px-4 py-6 lg:px-8">
        <header className="relative flex items-center justify-between border-b border-gray-100 pb-6">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[#5f8d87]">Sua coleção</p>
            <h2 className="text-2xl font-bold text-gray-800 lg:text-3xl">Recompensas</h2>
          </div>

          <div className="relative flex items-center gap-4">
            <div className="relative">
              <button
                aria-label="Abrir notificações"
                className="relative cursor-pointer rounded-full border border-gray-100 bg-white p-2.5 text-gray-600 shadow-sm transition hover:bg-[#eaf6f4] hover:text-[#29645e]"
                onClick={() => {
                  setShowNotifications((current) => !current);
                  setShowProfile(false);
                }}
                type="button"
              >
                <Bell size={20} />
                <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
              </button>

              {showNotifications ? (
                <div className="absolute right-0 z-40 mt-3 w-72 rounded-2xl border border-gray-100 bg-white p-4 shadow-xl">
                  <p className="font-semibold text-gray-700">Nova recompensa</p>
                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    Suas recompensas serão liberadas conforme você completa sessões e metas.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                aria-label="Abrir perfil"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-[#eaf6f4] text-[#29645e] shadow-sm transition hover:border-[#29645e]"
                onClick={() => {
                  setShowProfile((current) => !current);
                  setShowNotifications(false);
                }}
                type="button"
              >
                <User size={22} />
              </button>

              {showProfile ? (
                <div className="absolute right-0 z-40 mt-3 w-64 rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-xl">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#29645e] text-xl font-bold text-white">
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
          <section className="relative overflow-hidden rounded-[30px] bg-[#29645e] p-7 text-white shadow-[0_18px_45px_rgba(41,100,94,0.18)] lg:p-9">
            <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10" />
            <div className="absolute -bottom-24 right-36 h-52 w-52 rounded-full bg-[#65bfaa]/20" />
            <div className="relative flex flex-col justify-between gap-7 md:flex-row md:items-center">
              <div className="max-w-2xl">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                  <Gift size={25} />
                </div>
                <h3 className="text-2xl font-bold lg:text-3xl">Sua dedicação também vira coleção</h3>
                <p className="mt-3 max-w-xl leading-7 text-[#dcefeb]">
                  Estude, alcance metas e complete conquistas para liberar itens exclusivos para o seu perfil.
                </p>
              </div>

              <div className="min-w-[210px] rounded-[24px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#bfe5dc]">Progresso geral</p>
                <p className="mt-2 text-3xl font-bold">{unlockedRewards} de {totalRewards}</p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
                  <div className="h-full rounded-full bg-[#75d1bd]" style={{ width: `${generalProgress}%` }} />
                </div>
                <p className="mt-2 text-xs text-[#cfe8e3]">{generalProgress}% da coleção desbloqueada</p>
              </div>
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-3">
            {rewardCollections.map((collection, index) => {
              const Icon = collection.icon;
              const progress = Math.round((collection.unlocked / collection.total) * 100);
              const selectedCard = selectedCollection === index;

              return (
                <button
                  className={`overflow-hidden rounded-[26px] border bg-white text-left shadow-[0_8px_30px_rgba(41,100,94,0.05)] transition hover:-translate-y-1 hover:shadow-[0_14px_34px_rgba(41,100,94,0.12)] ${
                    selectedCard ? "border-[#72b9aa] ring-2 ring-[#d8eee9]" : "border-gray-100"
                  }`}
                  key={collection.title}
                  onClick={() => setSelectedCollection(index)}
                  type="button"
                >
                  <div
                    className="relative flex h-40 items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${collection.colors[0]}20, ${collection.colors[1]}55)` }}
                  >
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-[26px] text-white shadow-lg"
                      style={{ background: `linear-gradient(135deg, ${collection.colors[0]}, ${collection.colors[1]})` }}
                    >
                      <Icon size={35} />
                    </div>
                    <span className="absolute right-4 top-4 rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-gray-600">
                      {collection.unlocked}/{collection.total}
                    </span>
                  </div>

                  <div className="p-5">
                    <h3 className="text-lg font-bold text-gray-800">{collection.title}</h3>
                    <p className="mt-2 min-h-10 text-sm leading-5 text-gray-500">{collection.description}</p>
                    <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e5eeec]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#29645e] to-[#65bfaa]"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-xs">
                      <span className="font-semibold text-[#29645e]">{progress}% concluído</span>
                      <span className="text-gray-400">{collection.total - collection.unlocked} bloqueados</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
            <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-[0_8px_30px_rgba(41,100,94,0.05)] lg:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5f8d87]">Coleção selecionada</p>
                  <h3 className="mt-1 text-xl font-bold text-gray-800">{selected.title}</h3>
                </div>
                <Sparkles className="text-[#c78b18]" size={22} />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {selected.items.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[#d8e2e0] bg-[#fafbfb] p-5 text-sm text-gray-500">
                    Nenhuma recompensa desbloqueada ainda.
                  </p>
                ) : selected.items.map((item) => (
                  <article className="flex items-center gap-3 rounded-2xl border border-[#dce9e6] bg-[#f9fcfb] p-4" key={item}>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e4f4ee] text-[#2e795d]">
                      <Check size={18} />
                    </span>
                    <div>
                      <strong className="block text-sm text-gray-800">{item}</strong>
                      <small className="mt-1 text-xs text-[#568277]">Desbloqueado</small>
                    </div>
                  </article>
                ))}

                {Array.from({ length: selected.total - selected.unlocked }, (_, index) => (
                  <article className="flex items-center gap-3 rounded-2xl border border-dashed border-[#d8e2e0] bg-[#fafbfb] p-4 opacity-75" key={`locked-${index}`}>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf1f0] text-gray-400">
                      <Lock size={17} />
                    </span>
                    <div>
                      <strong className="block text-sm text-gray-500">Recompensa secreta</strong>
                      <small className="mt-1 text-xs text-gray-400">Continue estudando para descobrir</small>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="rounded-[28px] border border-[#dcebe8] bg-[#eef8f6] p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#29645e] shadow-sm">
                <Sparkles size={21} />
              </div>
              <h3 className="mt-5 text-lg font-bold text-gray-800">Como desbloquear?</h3>
              <ul className="mt-4 flex flex-col gap-4 text-sm leading-6 text-gray-600">
                {[
                  "Estude regularmente e mantenha suas sequências.",
                  "Atinja as metas semanais de horas.",
                  "Complete atividades e sessões Pomodoro.",
                  "Conquiste novos níveis e troféus.",
                ].map((tip) => (
                  <li className="flex gap-3" key={tip}>
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#56b8a3]" />
                    {tip}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

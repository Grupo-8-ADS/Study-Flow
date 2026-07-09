"use client";

import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  ClipboardList,
  Gift,
  LayoutDashboard,
  LogOut,
  Settings,
  Timer,
  User,
} from "lucide-react";

type PendingPageProps = {
  description: string;
  title: string;
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

export function PendingPage({ description, title }: PendingPageProps) {
  const router = useRouter();

  const logout = () => {
    localStorage.removeItem("studyflow_session");
    router.push("/");
  };

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
              const isActive = item.name === title || (title === "Atividades" && item.name === "Atividade");

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
        <header className="flex items-center justify-between border-b border-gray-100 pb-6">
          <h2 className="text-2xl font-bold text-gray-800 lg:text-3xl">{title}</h2>

          <div className="flex items-center gap-4">
            <button
              aria-label="Notificações"
              className="relative cursor-pointer rounded-full border border-gray-100 bg-white p-2.5 text-gray-600 shadow-sm transition hover:bg-[#eaf6f4] hover:text-[#29645e]"
              type="button"
            >
              <Bell size={20} />
              <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            <button
              aria-label="Perfil"
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-[#eaf6f4] text-[#29645e] shadow-sm transition hover:border-[#29645e]"
              onClick={() => router.push("/perfil")}
              type="button"
            >
              <User size={22} />
            </button>
          </div>
        </header>

        <section className="mt-6 flex flex-1 items-center justify-center rounded-[30px] border border-gray-100 bg-white p-8 text-center shadow-[0_4px_25px_rgba(0,0,0,0.02)]">
          <div className="max-w-md">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#eaf6f4] text-[#29645e]">
              <ClipboardList size={28} />
            </div>
            <h3 className="text-xl font-bold text-gray-800">{title}</h3>
            <p className="mt-3 text-sm leading-6 text-gray-500">{description}</p>
          </div>
        </section>
      </main>
    </div>
  );
}

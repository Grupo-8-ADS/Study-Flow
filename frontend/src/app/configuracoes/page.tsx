"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  ChevronRight,
  CircleHelp,
  Gift,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Timer,
  Trash2,
  TriangleAlert,
  User,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type UserSession = {
  email: string;
  nome: string;
  username: string;
};

type PrivacySettings = {
  allowSharing: boolean;
  publicProfile: boolean;
  showAchievements: boolean;
  showStudyHours: boolean;
};

const defaultPrivacy: PrivacySettings = {
  allowSharing: true,
  publicProfile: false,
  showAchievements: true,
  showStudyHours: true,
};

const faqItems = [
  ["Como adicionar uma disciplina?", "Abra a aba Disciplinas e use a opção de adicionar matéria quando essa integração estiver disponível."],
  ["Como funciona o Timer Pomodoro?", "Escolha o período de foco ou pausa, selecione uma disciplina e inicie o cronômetro."],
  ["Como as horas estudadas são registradas?", "As sessões concluídas serão usadas para alimentar seu histórico e a página de Estatísticas."],
  ["Como desbloquear conquistas?", "Conclua sessões, mantenha sequências de estudo e alcance metas relacionadas às disciplinas."],
  ["Como compartilhar meu progresso?", "Na página de Estatísticas, use o botão Compartilhar progresso para copiar um resumo."],
  ["Como excluir minha conta?", "Em Configurações, use Excluir minha conta e confirme a ação no aviso de segurança."],
];

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

export function ConfiguracoesView({ basic = false }: { basic?: boolean }) {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFaq, setShowFaq] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [privacy, setPrivacy] = useState<PrivacySettings>(defaultPrivacy);

  useEffect(() => {
    const storedSession = localStorage.getItem("studyflow_session");

    if (!storedSession) {
      router.push("/");
      return;
    }

    try {
      const parsedSession = JSON.parse(storedSession) as UserSession;
      setTimeout(() => setUser(parsedSession), 0);
      const storedPrivacy = localStorage.getItem(`studyflow_privacy_${parsedSession.email}`);
      if (storedPrivacy) {
        const parsedPrivacy = JSON.parse(storedPrivacy) as PrivacySettings;
        setTimeout(() => setPrivacy(parsedPrivacy), 0);
      }
    } catch {
      localStorage.removeItem("studyflow_session");
      router.push("/");
    }
  }, [router]);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignora se offline
    }
    localStorage.removeItem("studyflow_session");
    router.push("/");
  };

  const deleteAccount = async () => {
    if (!user) return;

    try {
      await supabase.auth.signOut();
    } catch {
      // Ignora erro se offline
    }

    localStorage.removeItem("studyflow_session");
    router.push("/");
  };

  const updatePrivacy = (key: keyof PrivacySettings) => {
    if (!user) return;

    setPrivacy((current) => {
      const next = { ...current, [key]: !current[key] };
      localStorage.setItem(`studyflow_privacy_${user.email}`, JSON.stringify(next));
      return next;
    });
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7fdfd]">
        <p className="animate-pulse text-lg font-medium text-[#29645e]">Carregando configurações...</p>
      </div>
    );
  }

  const isPresentationAccount =
    user.email.trim().toLowerCase() === "teste@teste.com" ||
    user.username.trim().toLowerCase() === "teste";

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
              const isActive = item.name === "Configurações";

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
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-[#5f8d87]">Preferências</p>
            <h2 className="text-2xl font-bold text-gray-800 lg:text-3xl">Configurações</h2>
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
                  <p className="font-semibold text-gray-700">Notificações</p>
                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    Suas notificações continuarão disponíveis aqui, sem duplicar essa opção nas configurações.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                aria-label="Abrir perfil"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-[#eaf6f4] text-[#29645e] shadow-sm transition hover:border-[#29645e]"
                onClick={() => router.push("/perfil")}
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

        <div className="mx-auto mt-7 flex w-full max-w-5xl flex-col gap-6">
          <section className="relative overflow-hidden rounded-[28px] border border-[#dcecea] bg-white p-6 shadow-[0_8px_30px_rgba(41,100,94,0.06)] lg:p-8">
            <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[#e3f3f0]" />
            <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] bg-[#29645e] text-3xl font-bold text-white shadow-lg shadow-[#29645e]/15">
                {user.nome.charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5f8d87]">Sua conta</p>
                <h3 className="mt-1 text-2xl font-bold text-gray-800">{user.nome}</h3>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#e1ecea] bg-[#f8fbfa] px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Nome de usuário</p>
                    <p className="mt-1 font-semibold text-gray-700">@{user.username}</p>
                  </div>
                  <div className="min-w-0 rounded-2xl border border-[#e1ecea] bg-[#f8fbfa] px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">E-mail</p>
                    <p className="mt-1 truncate font-semibold text-gray-700">{user.email}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-[0_8px_30px_rgba(41,100,94,0.05)] lg:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eaf6f4] text-[#29645e]">
                <Settings size={21} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Geral</h3>
                <p className="text-sm text-gray-500">Acessos e opções da sua conta.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                className={`group flex items-center gap-4 rounded-2xl border border-transparent bg-[#f8fbfa] p-4 text-left ${
                  basic ? "cursor-default opacity-80" : "cursor-pointer transition hover:border-[#cfe2df] hover:bg-[#f1f8f6]"
                }`}
                disabled={basic}
                onClick={() => setShowPrivacy(true)}
                type="button"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e7f3f1] text-[#29645e]">
                  <ShieldCheck size={21} />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-gray-800">Configurações de privacidade</strong>
                  <small className="mt-1 block text-sm text-gray-500">Controle de dados e visibilidade da conta.</small>
                </span>
                {basic ? (
                  <span className="rounded-full bg-[#e8f0ef] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#60716e]">
                    Em breve
                  </span>
                ) : (
                  <ChevronRight className="text-gray-400 transition group-hover:translate-x-1 group-hover:text-[#29645e]" size={21} />
                )}
              </button>

              <button
                className={`group flex items-center gap-4 rounded-2xl border border-transparent bg-[#f8fbfa] p-4 text-left ${
                  basic ? "cursor-default opacity-80" : "cursor-pointer transition hover:border-[#cfe2df] hover:bg-[#f1f8f6]"
                }`}
                disabled={basic}
                onClick={() => setShowFaq(true)}
                type="button"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e7f3f1] text-[#29645e]">
                  <CircleHelp size={21} />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-gray-800">Ajuda e FAQ</strong>
                  <small className="mt-1 block text-sm text-gray-500">Dúvidas frequentes e orientações de uso.</small>
                </span>
                {basic ? (
                  <span className="rounded-full bg-[#e8f0ef] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#60716e]">
                    Em breve
                  </span>
                ) : (
                  <ChevronRight className="text-gray-400 transition group-hover:translate-x-1 group-hover:text-[#29645e]" size={21} />
                )}
              </button>

              <button
                className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-transparent bg-[#f8fbfa] p-4 text-left transition hover:border-[#cfe2df] hover:bg-[#f1f8f6]"
                onClick={logout}
                type="button"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#edf4f3] text-[#29645e]">
                  <LogOut size={21} />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-gray-800">Sair da conta</strong>
                  <small className="mt-1 block text-sm text-gray-500">Encerrar esta sessão e voltar ao login.</small>
                </span>
                <ChevronRight className="text-gray-400 transition group-hover:translate-x-1 group-hover:text-[#29645e]" size={21} />
              </button>
            </div>
          </section>

          <section className="flex flex-col items-start justify-between gap-5 rounded-[28px] border border-red-100 bg-gradient-to-r from-white to-red-50/40 p-6 shadow-[0_8px_30px_rgba(120,40,40,0.04)] sm:flex-row sm:items-center lg:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-500">Zona de risco</p>
              <h3 className="mt-1 text-xl font-bold text-gray-800">Excluir conta</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-gray-500">
                {isPresentationAccount
                  ? "Esta é a conta de demonstração da apresentação. A exclusão foi bloqueada para manter os dados de exemplo disponíveis."
                  : "Remove seu cadastro e encerra a sessão. Essa ação não poderá ser desfeita."}
              </p>
            </div>
            <button
              className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-5 py-3 font-semibold transition sm:w-auto ${
                isPresentationAccount
                  ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                  : "cursor-pointer border-red-200 bg-white text-red-600 hover:border-red-400 hover:bg-red-50"
              }`}
              disabled={isPresentationAccount}
              onClick={() => {
                if (!isPresentationAccount) setShowDeleteModal(true);
              }}
              type="button"
            >
              <Trash2 size={18} />
              {isPresentationAccount ? "Conta demo protegida" : "Excluir minha conta"}
            </button>
          </section>
        </div>
      </main>

      {showDeleteModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142421]/45 p-5 backdrop-blur-sm">
          <section
            aria-describedby="delete-account-description"
            aria-labelledby="delete-account-title"
            aria-modal="true"
            className="relative w-full max-w-md rounded-[28px] border border-white/80 bg-white p-7 text-center shadow-2xl lg:p-8"
            role="dialog"
          >
            <button
              aria-label="Fechar confirmação"
              className="absolute right-5 top-5 cursor-pointer rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              onClick={() => setShowDeleteModal(false)}
              type="button"
            >
              <X size={20} />
            </button>

            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[20px] bg-red-50 text-red-500">
              <TriangleAlert size={30} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800" id="delete-account-title">Tem certeza?</h2>
            <p className="mt-3 leading-7 text-gray-500" id="delete-account-description">
              Seu cadastro será removido deste dispositivo e você precisará criar uma nova conta para voltar.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                className="cursor-pointer rounded-2xl border border-[#cfe0dd] bg-white px-4 py-3 font-semibold text-[#29645e] transition hover:bg-[#f3f9f8]"
                onClick={() => setShowDeleteModal(false)}
                type="button"
              >
                Manter conta
              </button>
              <button
                className="cursor-pointer rounded-2xl bg-red-500 px-4 py-3 font-semibold text-white transition hover:bg-red-600"
                onClick={deleteAccount}
                type="button"
              >
                Sim, excluir
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showPrivacy ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142421]/45 p-5 backdrop-blur-sm">
          <section
            aria-labelledby="privacy-title"
            aria-modal="true"
            className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-white/80 bg-[#f8fcfb] shadow-2xl"
            role="dialog"
          >
            <header className="flex items-start justify-between border-b border-[#deebe8] bg-white px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5f8d87]">Sua conta</p>
                <h2 className="mt-1 text-2xl font-bold text-gray-800" id="privacy-title">Configurações de privacidade</h2>
                <p className="mt-1 text-sm text-gray-500">Escolha quais informações poderão aparecer no seu perfil.</p>
              </div>
              <button
                aria-label="Fechar privacidade"
                className="cursor-pointer rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                onClick={() => setShowPrivacy(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex flex-col gap-3 p-5 sm:p-6">
              <PrivacyToggle
                checked={privacy.publicProfile}
                description="Permitir que outras pessoas visualizem seu perfil."
                label="Perfil público"
                onChange={() => updatePrivacy("publicProfile")}
              />
              <PrivacyToggle
                checked={privacy.showStudyHours}
                description="Mostrar o total de horas e seus resumos de estudo."
                label="Mostrar horas estudadas"
                onChange={() => updatePrivacy("showStudyHours")}
              />
              <PrivacyToggle
                checked={privacy.showAchievements}
                description="Exibir suas conquistas e evolução de nível."
                label="Mostrar conquistas"
                onChange={() => updatePrivacy("showAchievements")}
              />
              <PrivacyToggle
                checked={privacy.allowSharing}
                description="Habilitar os botões para compartilhar seu progresso."
                label="Permitir compartilhamentos"
                onChange={() => updatePrivacy("allowSharing")}
              />
            </div>

            <footer className="border-t border-[#deebe8] bg-white px-6 py-4 text-sm text-gray-500">
              As preferências são salvas automaticamente neste dispositivo.
            </footer>
          </section>
        </div>
      ) : null}

      {showFaq ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142421]/45 p-5 backdrop-blur-sm">
          <section
            aria-labelledby="faq-title"
            aria-modal="true"
            className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/80 bg-[#f8fcfb] shadow-2xl"
            role="dialog"
          >
            <header className="flex items-start justify-between border-b border-[#deebe8] bg-white px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5f8d87]">Central de ajuda</p>
                <h2 className="mt-1 text-2xl font-bold text-gray-800" id="faq-title">Ajuda e FAQ</h2>
                <p className="mt-1 text-sm text-gray-500">Respostas rápidas para as dúvidas mais comuns.</p>
              </div>
              <button
                aria-label="Fechar FAQ"
                className="cursor-pointer rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                onClick={() => setShowFaq(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </header>

            <div className="flex flex-col gap-3 overflow-y-auto p-5 sm:p-6">
              {faqItems.map(([question, answer], index) => {
                const expanded = openFaq === index;

                return (
                  <article className="overflow-hidden rounded-2xl border border-[#dce9e6] bg-white" key={question}>
                    <button
                      aria-expanded={expanded}
                      className="flex w-full cursor-pointer items-center justify-between gap-4 p-4 text-left"
                      onClick={() => setOpenFaq(expanded ? null : index)}
                      type="button"
                    >
                      <strong className="text-sm text-gray-800">{question}</strong>
                      <span className={`text-xl text-[#29645e] transition ${expanded ? "rotate-45" : ""}`}>+</span>
                    </button>
                    {expanded ? (
                      <p className="border-t border-[#edf3f1] px-4 py-4 text-sm leading-6 text-gray-500">{answer}</p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function PrivacyToggle({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      aria-pressed={checked}
      className="flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-[#dce9e6] bg-white p-4 text-left transition hover:border-[#bdd8d3]"
      onClick={onChange}
      type="button"
    >
      <span className="min-w-0 flex-1">
        <strong className="block text-sm text-gray-800">{label}</strong>
        <small className="mt-1 block text-xs leading-5 text-gray-500">{description}</small>
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-[#29645e]" : "bg-[#d6e1df]"}`}>
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}

export default function ConfiguracoesPage() {
  return <ConfiguracoesView />;
}

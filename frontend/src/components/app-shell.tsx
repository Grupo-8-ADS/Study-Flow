"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getStoredSession, type StudyFlowSession } from "@/lib/studyflow-data";
import { limparAgenda } from "@/lib/agenda";
import { NotificationBell } from "@/components/notification-bell";
import { MolduraAvatar } from "@/components/moldura-avatar";
import { ACCOUNT_MATCH, MAIN_NAV, isActive, sectionFor } from "@/components/navigation";

/** Logotipo textual com a fonte da marca. */
function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-brand tracking-wide ${className}`}>Study Flow</span>;
}

function Avatar({ user, size = 36 }: { user: StudyFlowSession | null; size?: number }) {
  const initial = user?.nome?.trim()?.[0]?.toUpperCase();
  return (
    <MolduraAvatar espessura={2} moldura={user?.moldura}>
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-sm font-semibold text-primary-800"
      style={{ height: size, width: size }}
    >
      {user?.avatar_url ? (
        <img alt="" className="h-full w-full object-cover" src={user.avatar_url} />
      ) : initial ? (
        initial
      ) : (
        <UserRound size={size * 0.5} aria-hidden />
      )}
    </span>
    </MolduraAvatar>
  );
}

/**
 * Estrutura comum das páginas autenticadas:
 * sidebar única no desktop, barra superior e barra de abas inferior no celular,
 * e abas de seção (Agenda, Progresso, Conta) quando a página pertence a um grupo.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [user, setUser] = useState<StudyFlowSession | null>(null);

  useEffect(() => {
    const session = getStoredSession();
    if (!session) {
      router.replace("/");
      return;
    }
    // Sessão lida do localStorage só existe no cliente; sincroniza após montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(session);

    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user?.id;
      if (!id) return;
      const { data: profile } = await supabase.from("profiles").select("nome,avatar_url,moldura").eq("id", id).maybeSingle();
      if (!cancelled && profile) {
        setUser((current) => (current ? { ...current, nome: profile.nome || current.nome, avatar_url: profile.avatar_url, moldura: profile.moldura } : current));
      }
    })();

    const reler = () => {
      const atual = getStoredSession();
      if (atual) setUser(atual);
    };
    window.addEventListener("studyflow:sessao", reler);

    return () => {
      cancelled = true;
      window.removeEventListener("studyflow:sessao", reler);
    };
    // Perfil (nome e foto) é buscado uma vez por sessão do shell, não a cada troca de aba.
  }, [router]);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Sem rede: ainda assim encerra a sessão local.
    }
    localStorage.removeItem("studyflow_session");
    limparAgenda();
    router.push("/");
  };

  const section = sectionFor(pathname);
  const inAccount = isActive(pathname, ACCOUNT_MATCH);

  return (
    <div className="min-h-dvh bg-canvas lg:pl-64">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-control focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-800 focus:shadow-raised"
        href="#conteudo"
      >
        Pular para o conteúdo
      </a>

      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-primary-800 text-white lg:flex">
        <Link className="flex h-16 items-center px-6 text-[22px] text-white" href="/dashboard">
          <Wordmark />
        </Link>

        <nav aria-label="Menu principal" className="flex flex-1 flex-col gap-1 px-3 pt-4">
          {MAIN_NAV.map((item) => {
            const active = isActive(pathname, item.match);
            const Icon = item.icon;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`group flex h-11 items-center gap-3 rounded-control px-3 text-[15px] font-medium transition-colors ${
                  active ? "bg-white/[0.14] text-white" : "text-primary-100/85 hover:bg-white/[0.07] hover:text-white"
                }`}
                href={item.href}
                key={item.href}
              >
                <Icon aria-hidden className={active ? "text-white" : "text-primary-200/80 group-hover:text-white"} size={19} />
                {item.label}
                {active ? <span aria-hidden className="ml-auto h-1.5 w-1.5 rounded-full bg-primary-300" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <Link
            aria-current={inAccount ? "page" : undefined}
            className={`flex items-center gap-3 rounded-control p-2 transition-colors ${inAccount ? "bg-white/[0.14]" : "hover:bg-white/[0.07]"}`}
            href="/perfil"
          >
            <Avatar size={34} user={user} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-white">{user?.nome ?? "Minha conta"}</span>
              <span className="block truncate text-xs text-primary-100/75">Conta e preferências</span>
            </span>
          </Link>
          <button
            className="mt-1 flex h-10 w-full items-center gap-3 rounded-control px-3 text-sm font-medium text-primary-100/85 transition-colors hover:bg-white/[0.07] hover:text-white"
            onClick={logout}
            type="button"
          >
            <LogOut aria-hidden size={18} />
            Sair
          </button>
        </div>
      </aside>

      {/* Barra superior */}
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:h-16 lg:px-8">
          <Link className="text-xl text-primary-800 lg:hidden" href="/dashboard">
            <Wordmark />
          </Link>

          {section ? (
            <nav aria-label={section.label} className="-mx-1 hidden min-w-0 items-center gap-1 overflow-x-auto px-1 lg:flex">
              {section.tabs.map((tab) => {
                const active = isActive(pathname === "/configuracoes-basico" ? "/configuracoes" : pathname, [tab.href]);
                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={`flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors ${
                      active ? "bg-primary-700 text-white" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                    }`}
                    href={tab.href}
                    key={tab.href}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <Link aria-label="Abrir conta e perfil" className="rounded-full lg:hidden" href="/perfil">
              <Avatar size={36} user={user} />
            </Link>
          </div>
        </div>

        {section ? (
          <nav aria-label={section.label} className="flex gap-1 overflow-x-auto px-4 pb-2.5 sm:px-6 lg:hidden">
            {section.tabs.map((tab) => {
              const active = isActive(pathname === "/configuracoes-basico" ? "/configuracoes" : pathname, [tab.href]);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`flex h-8 shrink-0 items-center rounded-full px-3.5 text-[13px] font-medium transition-colors ${
                    active ? "bg-primary-700 text-white" : "bg-white text-ink-600 ring-1 ring-line hover:text-ink-900"
                  }`}
                  href={tab.href}
                  key={tab.href}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8" id="conteudo" tabIndex={-1}>
        {children}
      </main>

      {/* Barra de abas (celular e tablet) */}
      <nav
        aria-label="Menu principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {MAIN_NAV.map((item) => {
            const active = isActive(pathname, item.match);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                    active ? "text-primary-700" : "text-ink-500 hover:text-ink-800"
                  }`}
                  href={item.href}
                >
                  <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? "bg-primary-100" : ""}`}>
                    <Icon aria-hidden size={20} strokeWidth={active ? 2.25 : 2} />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

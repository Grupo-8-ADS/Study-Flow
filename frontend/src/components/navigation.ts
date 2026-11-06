import {
  BarChart3,
  BookOpen,
  CalendarDays,
  House,
  Timer,
  type LucideIcon,
} from "lucide-react";

/** Item do menu principal. `match` lista as rotas que acendem o item. */
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  match: string[];
};

/** Abas internas de uma seção (ex.: Agenda → Calendário, Atividades, Rotina). */
export type SectionTab = { label: string; href: string };

/**
 * Menu principal do Study Flow, igual no web e no mobile.
 * As rotas antigas continuam existindo; só a forma de chegar nelas foi agrupada.
 */
export const MAIN_NAV: NavItem[] = [
  { label: "Início", href: "/dashboard", icon: House, match: ["/dashboard"] },
  { label: "Agenda", href: "/calendario", icon: CalendarDays, match: ["/calendario", "/atividade", "/rotina"] },
  { label: "Timer", href: "/timer", icon: Timer, match: ["/timer"] },
  { label: "Disciplinas", href: "/disciplinas", icon: BookOpen, match: ["/disciplinas"] },
  { label: "Progresso", href: "/estatisticas", icon: BarChart3, match: ["/estatisticas", "/rewards"] },
];

/** Área de conta, acessada pelo avatar e pelo rodapé da sidebar. */
export const ACCOUNT_MATCH = ["/perfil", "/configuracoes", "/configuracoes-basico", "/integracoes"];

export const SECTIONS: Array<{ label: string; tabs: SectionTab[] }> = [
  {
    label: "Agenda",
    tabs: [
      { label: "Calendário", href: "/calendario" },
      { label: "Compromissos", href: "/atividade" },
      { label: "Rotina e cronograma", href: "/rotina" },
    ],
  },
  {
    label: "Progresso",
    tabs: [
      { label: "Estatísticas", href: "/estatisticas" },
      { label: "Recompensas", href: "/rewards" },
    ],
  },
  {
    label: "Conta",
    tabs: [
      { label: "Perfil", href: "/perfil" },
      { label: "Preferências", href: "/configuracoes" },
      { label: "Integrações", href: "/integracoes" },
    ],
  },
];

export function isActive(pathname: string, match: string[]) {
  return match.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/** Seção (com abas) da rota atual, se houver. */
export function sectionFor(pathname: string) {
  const normalized = pathname === "/configuracoes-basico" ? "/configuracoes" : pathname;
  return SECTIONS.find((section) => section.tabs.some((tab) => isActive(normalized, [tab.href])));
}

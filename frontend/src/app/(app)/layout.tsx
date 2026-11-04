import { AppShell } from "@/components/app-shell";

/** Layout das páginas autenticadas: aplica o shell (menu, barra superior e abas de seção). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

type EmptyStateProps = {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** Estado vazio: explica o que falta e oferece a próxima ação. */
export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-card border border-dashed border-ink-200 bg-ink-50/60 px-6 py-10 text-center ${className}`}>
      {icon ? (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary-700 shadow-card" aria-hidden>
          {icon}
        </span>
      ) : null}
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Indicador de carregamento de página inteira, dentro do shell. */
export function PageLoading({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col gap-4" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-ink-100" />
      <div className="h-4 w-72 max-w-full animate-pulse rounded bg-ink-100" />
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div className="h-24 animate-pulse rounded-card bg-ink-100" key={item} />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-card bg-ink-100" />
    </div>
  );
}

type AlertProps = {
  tone?: "info" | "success" | "danger" | "warning";
  children: ReactNode;
  className?: string;
  role?: "alert" | "status";
};

const alertTone = {
  info: "border-info/20 bg-info-soft text-[#1e4fbf]",
  success: "border-success/20 bg-success-soft text-[#0b6b4a]",
  danger: "border-danger/20 bg-danger-soft text-[#9b2a24]",
  warning: "border-warning/20 bg-warning-soft text-[#8a4006]",
};

/** Mensagem de retorno em linha (erro, sucesso, aviso). */
export function Alert({ tone = "info", children, className = "", role }: AlertProps) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertCircle;
  return (
    <div
      className={`flex items-start gap-2.5 rounded-control border px-3.5 py-3 text-sm ${alertTone[tone]} ${className}`}
      role={role ?? (tone === "danger" ? "alert" : "status")}
    >
      <Icon className="mt-0.5 shrink-0" size={16} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

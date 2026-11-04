import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLElement> & {
  as?: "section" | "div" | "article" | "aside";
  padded?: boolean;
};

/** Superfície branca padrão (borda fina + sombra leve). */
export function Card({ as: Tag = "section", padded = true, className = "", ...props }: CardProps) {
  return (
    <Tag
      className={`rounded-card border border-line bg-surface shadow-card ${padded ? "p-5 sm:p-6" : ""} ${className}`}
      {...props}
    />
  );
}

type CardHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  id?: string;
  as?: "h2" | "h3";
  className?: string;
};

/** Cabeçalho de cartão: ícone opcional, título, descrição e ação à direita. */
export function CardHeader({ title, description, icon, action, id, as: Heading = "h2", className = "" }: CardHeaderProps) {
  return (
    <div className={`mb-5 flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-100 text-primary-700" aria-hidden>
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <Heading className="text-base font-semibold text-ink-900" id={id}>
            {title}
          </Heading>
          {description ? <p className="mt-0.5 text-sm text-ink-500">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

type StatProps = {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  tone?: "primary" | "warning" | "danger" | "gold" | "info";
  hint?: ReactNode;
};

const toneClass = {
  primary: "bg-primary-100 text-primary-700",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  gold: "bg-gold-soft text-gold",
  info: "bg-info-soft text-info",
};

/** Cartão de métrica (número em destaque com rótulo). */
export function Stat({ label, value, icon, tone = "primary", hint }: StatProps) {
  return (
    <Card as="div" className="flex flex-col items-start gap-2 !p-3.5 sm:flex-row sm:items-center sm:gap-4 sm:!p-5">
      {icon ? (
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] sm:h-11 sm:w-11 sm:rounded-[12px] [&>svg]:h-[18px] [&>svg]:w-[18px] sm:[&>svg]:h-[22px] sm:[&>svg]:w-[22px] ${toneClass[tone]}`}
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-xs font-medium leading-tight text-ink-500 sm:text-[13px]">{label}</p>
        <p className="tabular mt-0.5 text-lg font-semibold tracking-tight text-ink-900 sm:text-2xl">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-ink-500">{hint}</p> : null}
      </div>
    </Card>
  );
}

type BadgeProps = {
  children: ReactNode;
  tone?: "neutral" | "primary" | "warning" | "danger" | "success" | "gold" | "info";
  className?: string;
};

const badgeTone = {
  neutral: "bg-ink-100 text-ink-700",
  primary: "bg-primary-100 text-primary-800",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  success: "bg-success-soft text-success",
  gold: "bg-gold-soft text-gold",
  info: "bg-info-soft text-info",
};

/** Etiqueta pequena (tipo de evento, disciplina, status). */
export function Badge({ children, tone = "neutral", className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badgeTone[tone]} ${className}`}>
      {children}
    </span>
  );
}

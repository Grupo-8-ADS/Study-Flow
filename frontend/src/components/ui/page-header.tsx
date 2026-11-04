import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Cabeçalho padrão de página: título, descrição curta e ações à direita. */
export function PageHeader({ title, description, actions, className = "" }: PageHeaderProps) {
  return (
    <header className={`mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-[28px] sm:leading-9">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[15px] text-ink-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

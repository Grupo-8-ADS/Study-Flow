import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/** Classe base dos controles de formulário (input, select, textarea). */
export const controlClass =
  "w-full min-w-0 rounded-control border border-ink-200 bg-white px-3.5 text-sm text-ink-800 shadow-[inset_0_1px_1px_rgb(18_32_30/0.03)] transition-colors placeholder:text-ink-400 hover:border-ink-300 focus:border-primary-500 focus:outline-none focus:ring-3 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500 aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger-soft";

export const labelClass = "text-[13px] font-medium text-ink-700";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${controlClass} h-10 ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${controlClass} h-10 pr-8 ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${controlClass} py-2.5 leading-relaxed ${className}`} {...props} />;
}

type FieldProps = {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Agrupa rótulo, controle, dica e mensagem de erro com espaçamento consistente. */
export function Field({ label, htmlFor, hint, error, className = "", children }: FieldProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label className={labelClass} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

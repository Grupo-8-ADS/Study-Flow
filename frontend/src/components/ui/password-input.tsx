"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { controlClass } from "./field";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Nome curto do campo, usado no rótulo acessível do botão de mostrar/ocultar. */
  toggleLabel?: string;
};

/** Campo de senha com botão para mostrar ou ocultar o texto digitado. */
export function PasswordInput({ className = "", toggleLabel = "senha", ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input className={`${controlClass} h-10 pr-11 ${className}`} type={show ? "text" : "password"} {...props} />
      <button
        aria-label={show ? `Ocultar ${toggleLabel}` : `Mostrar ${toggleLabel}`}
        aria-pressed={show}
        className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700"
        onClick={() => setShow((current) => !current)}
        type="button"
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

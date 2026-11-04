import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost" | "inverse";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white shadow-sm hover:bg-primary-800 active:bg-primary-900",
  secondary: "border border-line bg-surface text-ink-800 shadow-sm hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800",
  ghost: "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
  danger: "bg-danger text-white shadow-sm hover:bg-[#a52d27]",
  "danger-ghost": "text-ink-500 hover:bg-danger-soft hover:text-danger",
  inverse: "bg-white text-primary-800 shadow-sm hover:bg-primary-50",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 rounded-[8px] px-3 text-[13px]",
  md: "h-10 rounded-control px-4 text-sm",
  lg: "h-12 rounded-control px-5 text-[15px]",
  icon: "h-10 w-10 rounded-control",
  "icon-sm": "h-8 w-8 rounded-[8px]",
};

/** Classes de botão para usar também em links (`<Link className={buttonClass(...)}>`). */
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

/** Botão padrão do sistema de design. Por padrão é `type="button"` para não enviar formulários por engano. */
export function Button({ variant = "primary", size = "md", className = "", type = "button", ...props }: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} type={type} {...props} />;
}

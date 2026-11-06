/** Cores por tipo de compromisso (mesmas famílias do app mobile). */
export const ESTILO_TIPO: Record<
  "prova" | "trabalho" | "atividade" | "estudo" | "aula",
  { dot: string; chip: string; tone: "danger" | "gold" | "success" | "primary" | "neutral" }
> = {
  prova: { dot: "bg-danger", chip: "bg-danger-soft text-[#9b2a24]", tone: "danger" },
  trabalho: { dot: "bg-gold", chip: "bg-gold-soft text-[#7a5408]", tone: "gold" },
  estudo: { dot: "bg-success", chip: "bg-success-soft text-[#0b6b4a]", tone: "success" },
  atividade: { dot: "bg-primary-600", chip: "bg-primary-100 text-primary-800", tone: "primary" },
  aula: { dot: "bg-ink-400", chip: "bg-ink-100 text-ink-700", tone: "neutral" },
};

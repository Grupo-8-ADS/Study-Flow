import {
  BookOpen,
  Clock,
  Compass,
  Crown,
  Flame,
  Footprints,
  GraduationCap,
  Lock,
  Mountain,
  Target,
  Timer,
  Trophy,
  User,
  type LucideIcon,
} from "lucide-react";

/** Ícone por chave gravada em conquistas.icone. */
const ICONES: Record<string, LucideIcon> = {
  book: BookOpen,
  clock: Clock,
  compass: Compass,
  crown: Crown,
  flame: Flame,
  footprints: Footprints,
  graduation: GraduationCap,
  mountain: Mountain,
  target: Target,
  timer: Timer,
  trophy: Trophy,
  user: User,
};

/** Medalha por nível: bronze, prata e ouro (com aro e brilho), cinza quando bloqueada. */
const TIER = {
  1: "from-[#f3d2b3] to-[#c98a55] text-[#6b3d16] ring-[#e7b98e]",
  2: "from-[#f1f4f6] to-[#aeb9c2] text-[#3c4a55] ring-[#cfd7dd]",
  3: "from-[#fff1b8] to-[#e0a92e] text-[#6b4a00] ring-[#f3cf63]",
} as const;

export function ConquistaIcone({
  icone,
  tier = 1,
  bloqueada = false,
  tamanho = 44,
}: {
  icone?: string | null;
  tier?: number | null;
  bloqueada?: boolean;
  tamanho?: number;
}) {
  const Icone = ICONES[icone ?? ""] ?? Trophy;
  const cor = TIER[(tier ?? 1) as 1 | 2 | 3] ?? TIER[1];
  return (
    <span
      aria-hidden
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br shadow-sm ring-2 ${
        bloqueada ? "from-ink-100 to-ink-200 text-ink-400 ring-ink-200" : cor
      }`}
      style={{ height: tamanho, width: tamanho }}
    >
      <Icone size={Math.round(tamanho * 0.46)} strokeWidth={2.2} />
      {bloqueada ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-ink-500 shadow">
          <Lock size={10} />
        </span>
      ) : null}
    </span>
  );
}

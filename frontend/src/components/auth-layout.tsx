import Image from "next/image";
import type { ReactNode } from "react";
import { CalendarDays, BarChart3, Timer } from "lucide-react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const highlights = [
  { icon: CalendarDays, text: "Provas, trabalhos e rotina em um só calendário" },
  { icon: Timer, text: "Sessões de foco com o método Pomodoro" },
  { icon: BarChart3, text: "Estatísticas e conquistas para manter o ritmo" },
];

/** Moldura das telas de entrada (login e cadastro): marca à esquerda, formulário à direita. */
export function AuthLayout({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas lg:flex-row">
      <aside className="relative flex shrink-0 flex-col justify-between overflow-hidden bg-primary-800 px-6 py-8 text-white lg:min-h-screen lg:w-[44%] lg:px-12 lg:py-12">
        <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[0.05]" />
        <div aria-hidden className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-white/[0.04]" />

        <div className="relative flex items-center gap-3">
          <Image alt="" className="h-10 w-auto lg:h-12" height={255} priority src={`${basePath}/logo.png`} style={{ width: "auto" }} width={190} />
          <span className="font-brand text-2xl tracking-wide lg:text-3xl">Study Flow</span>
        </div>

        <div className="relative hidden max-w-md lg:block">
          <p className="text-3xl font-semibold leading-tight tracking-tight">Organize os estudos sem perder o fio da meada.</p>
          <ul className="mt-8 flex flex-col gap-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li className="flex items-center gap-3 text-primary-100" key={text}>
                <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/10 text-white">
                  <Icon size={18} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative hidden text-sm text-primary-200 lg:block">Projeto acadêmico · ADS</p>
      </aside>

      <main className="-mt-4 flex flex-1 items-start justify-center rounded-t-[20px] bg-canvas px-5 py-10 sm:px-8 lg:mt-0 lg:items-center lg:rounded-none lg:py-12">
        <div className="w-full max-w-[400px]">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
          {description ? <p className="mt-1.5 text-sm text-ink-500">{description}</p> : null}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

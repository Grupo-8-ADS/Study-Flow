"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CalendarClock,
  Gift,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  Timer,
  Trash2,
  User,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentSupabaseUserId, getStoredSession } from "@/lib/studyflow-data";
import {
  CronogramaError,
  NOMES_DIAS_SEMANA,
  gerarCronograma,
  validarRotina,
  type BlocoEstudo,
  type DisciplinaPlanejamento,
  type RotinaSlot,
} from "@studyflow/shared";

type UserSession = { email: string; nome: string; username: string; avatar_url?: string | null };

type Slot = RotinaSlot & { id: string };

const menuItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Calendário", href: "/calendario", icon: Calendar },
  { name: "Atividade", href: "/atividade", icon: Activity },
  { name: "Disciplinas", href: "/disciplinas", icon: BookOpen },
  { name: "Rotina", href: "/rotina", icon: CalendarClock },
  { name: "Timer", href: "/timer", icon: Timer },
  { name: "Estatísticas", href: "/estatisticas", icon: BarChart3 },
  { name: "Recompensas", href: "/rewards", icon: Gift },
  { name: "Configurações", href: "/configuracoes", icon: Settings },
];

const TABELA_AUSENTE = "PGRST205";
const inputClass = "w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#29645e]";
const labelClass = "grid gap-1.5 text-sm font-semibold text-gray-600";

/** Normaliza "19:00:00" (tipo time do Postgres) para "19:00". */
const hhmm = (valor: string) => String(valor).slice(0, 5);

const ordenar = (lista: Slot[]) =>
  [...lista].sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio));

const dois = (n: number) => String(n).padStart(2, "0");
const dataLocal = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
const horaLocal = (d: Date) => `${dois(d.getHours())}:${dois(d.getMinutes())}`;
/** Formato "naive" (sem fuso) usado pelas demais telas ao gravar itens_cronograma. */
const timestampLocal = (d: Date) => `${dataLocal(d)}T${horaLocal(d)}:00`;

function formatarData(d: Date) {
  const dia = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()];
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} (${dia})`;
}

/** Extrai a data da próxima prova (YYYY-MM-DD, hoje ou futura) das anotações da disciplina. */
function proximaProvaDe(anotacoes: unknown): string | null {
  const notas = (typeof anotacoes === "object" && anotacoes !== null ? anotacoes : {}) as Record<string, unknown>;
  const datas: string[] = [];
  if (Array.isArray(notas.provas)) {
    notas.provas.forEach((p) => {
      const data = (p as { data?: string } | null)?.data;
      if (data) datas.push(String(data).slice(0, 10));
    });
  } else if (typeof notas.examDate === "string" && notas.examDate) {
    datas.push(notas.examDate.slice(0, 10));
  }
  const hoje = dataLocal(new Date());
  const futuras = datas.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= hoje).sort();
  return futuras[0] ?? null;
}

export default function RotinaPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [rotinaLocal, setRotinaLocal] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [disciplinas, setDisciplinas] = useState<DisciplinaPlanejamento[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [dia, setDia] = useState("1");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [errosRotina, setErrosRotina] = useState<string[]>([]);

  const [semanas, setSemanas] = useState("1");
  const [duracao, setDuracao] = useState("50");
  const [erroGeracao, setErroGeracao] = useState<{ mensagem: string; linkDisciplinas?: boolean } | null>(null);
  const [previa, setPrevia] = useState<{ blocos: BlocoEstudo[]; duracaoMin: number } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [salvandoSlot, setSalvandoSlot] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      const parsed = getStoredSession();
      if (!parsed) {
        router.push("/");
        return;
      }

      try {
        setUser(parsed);
        const userId = await getCurrentSupabaseUserId(parsed);
        setSupabaseUserId(userId);

        const chaveRotina = `studyflow_rotina_${parsed.email}`;
        const lerRotinaLocal = () => {
          const salvo = localStorage.getItem(chaveRotina);
          return salvo ? (JSON.parse(salvo) as Slot[]) : [];
        };

        if (!userId) {
          setRotinaLocal(true);
          setSlots(ordenar(lerRotinaLocal()));
          const salvas = localStorage.getItem(`studyflow_subjects_${parsed.email}`);
          const lista = (salvas ? JSON.parse(salvas) : []) as Array<{ id: string; name: string; provas?: Array<{ data?: string }>; examDate?: string }>;
          setDisciplinas(lista.map((s) => ({ id: s.id, nome: s.name, proximaProva: proximaProvaDe(s) })));
          return;
        }

        const [rotinaRes, disciplinasRes, profileRes] = await Promise.all([
          supabase
            .from("rotinas_semanais")
            .select("id,dia_semana,hora_inicio,hora_fim")
            .eq("user_id", userId)
            .order("dia_semana", { ascending: true }),
          supabase.from("disciplinas").select("id,nome,anotacoes").eq("user_id", userId).order("created_at", { ascending: false }),
          supabase.from("profiles").select("avatar_url").eq("id", userId).maybeSingle(),
        ]);

        if (profileRes.data?.avatar_url) {
          setUser((curr) => (curr ? { ...curr, avatar_url: profileRes.data?.avatar_url } : null));
        }

        if (rotinaRes.error) {
          // Tabela ainda inexistente no banco de produção (ou falha de rede): usa o armazenamento local.
          setRotinaLocal(true);
          setSlots(ordenar(lerRotinaLocal()));
        } else {
          setSlots(
            ordenar(
              (rotinaRes.data ?? []).map((r) => ({
                id: r.id,
                dia_semana: r.dia_semana,
                hora_inicio: hhmm(r.hora_inicio),
                hora_fim: hhmm(r.hora_fim),
              })),
            ),
          );
        }

        setDisciplinas(
          (disciplinasRes.data ?? []).map((d) => ({ id: d.id, nome: d.nome, proximaProva: proximaProvaDe(d.anotacoes) })),
        );
      } catch {
        router.push("/");
      } finally {
        setLoadingData(false);
      }
    }

    void carregar();
  }, [router]);

  const persistirLocal = (lista: Slot[]) => {
    if (user) localStorage.setItem(`studyflow_rotina_${user.email}`, JSON.stringify(lista));
  };

  const adicionar = async (event: FormEvent) => {
    event.preventDefault();
    setSucesso(null);
    setPrevia(null);

    if (!inicio || !fim) {
      setErrosRotina(["Informe o horário de início e o de fim."]);
      return;
    }

    const novo: RotinaSlot = { dia_semana: Number(dia), hora_inicio: inicio, hora_fim: fim };
    const erros = validarRotina([...slots, novo]);
    if (erros.length > 0) {
      setErrosRotina(erros);
      return;
    }
    setErrosRotina([]);
    // Limpa o formulário já no envio: se limpasse após o await, apagaria o que o
    // usuário digitasse enquanto o horário anterior ainda está sendo salvo.
    setInicio("");
    setFim("");

    let salvo: Slot = { ...novo, id: crypto.randomUUID() };
    let usarLocal = rotinaLocal || !supabaseUserId;

    if (!usarLocal && supabaseUserId) {
      setSalvandoSlot(true);
      const { data, error } = await supabase
        .from("rotinas_semanais")
        .insert({ user_id: supabaseUserId, dia_semana: novo.dia_semana, hora_inicio: novo.hora_inicio, hora_fim: novo.hora_fim })
        .select("id")
        .single();
      setSalvandoSlot(false);

      if (error && error.code === TABELA_AUSENTE) {
        usarLocal = true;
        setRotinaLocal(true);
      } else if (error || !data) {
        setErrosRotina(["Não foi possível salvar o horário. Tente novamente."]);
        setInicio(novo.hora_inicio);
        setFim(novo.hora_fim);
        return;
      } else {
        salvo = { ...salvo, id: data.id };
      }
    }

    const proxima = ordenar([...slots, salvo]);
    setSlots(proxima);
    if (usarLocal) persistirLocal(proxima);
  };

  const remover = async (slot: Slot) => {
    setSucesso(null);
    setPrevia(null);
    if (!rotinaLocal && supabaseUserId) {
      const { error } = await supabase.from("rotinas_semanais").delete().eq("id", slot.id).eq("user_id", supabaseUserId);
      if (error) {
        setErrosRotina(["Não foi possível remover o horário. Tente novamente."]);
        return;
      }
    }
    const proxima = slots.filter((s) => s.id !== slot.id);
    setSlots(proxima);
    if (rotinaLocal || !supabaseUserId) persistirLocal(proxima);
    setErrosRotina([]);
  };

  const gerar = () => {
    setSucesso(null);
    setPrevia(null);
    setErroGeracao(null);

    if (disciplinas.length === 0) {
      setErroGeracao({ mensagem: "Cadastre ao menos uma disciplina antes de gerar o cronograma.", linkDisciplinas: true });
      return;
    }
    if (slots.length === 0) {
      setErroGeracao({ mensagem: "Cadastre sua rotina semanal antes de gerar o cronograma." });
      return;
    }

    const duracaoMin = Number(duracao);
    if (!Number.isInteger(duracaoMin) || duracaoMin < 10 || duracaoMin > 240) {
      setErroGeracao({ mensagem: "Informe uma duração de bloco entre 10 e 240 minutos." });
      return;
    }

    try {
      const blocos = gerarCronograma({
        disciplinas,
        rotina: slots,
        dataInicio: new Date(),
        semanas: Number(semanas),
        duracaoBlocoMin: duracaoMin,
      });
      setPrevia({ blocos, duracaoMin });
    } catch (e) {
      setErroGeracao({ mensagem: e instanceof CronogramaError ? e.message : "Não foi possível gerar o cronograma." });
    }
  };

  const confirmar = async () => {
    if (!previa || !user) return;
    setSalvando(true);
    setErroGeracao(null);

    try {
      if (supabaseUserId) {
        const linhas = previa.blocos.map((b) => ({
          nome: `Estudo: ${b.disciplina_nome}`,
          tipo: "estudo",
          disciplina_id: b.disciplina_id,
          data_inicio: timestampLocal(new Date(b.data_inicio)),
          data_fim: timestampLocal(new Date(b.data_fim)),
          user_id: supabaseUserId,
        }));
        const { error } = await supabase.from("itens_cronograma").insert(linhas);
        if (error) {
          setErroGeracao({ mensagem: "Não foi possível salvar o cronograma. Tente novamente." });
          return;
        }
      } else {
        const chave = `studyflow_events_${user.email}`;
        const existentes = JSON.parse(localStorage.getItem(chave) ?? "[]") as unknown[];
        const novos = previa.blocos.map((b) => {
          const ini = new Date(b.data_inicio);
          const fimBloco = new Date(b.data_fim);
          return {
            id: crypto.randomUUID(),
            title: `Estudo: ${b.disciplina_nome}`,
            date: dataLocal(ini),
            time: `${horaLocal(ini)} – ${horaLocal(fimBloco)}`,
            discipline: b.disciplina_nome,
            disciplineId: b.disciplina_id,
            type: "Estudo",
          };
        });
        localStorage.setItem(chave, JSON.stringify([...existentes, ...novos]));
      }

      setSucesso(`Cronograma salvo! ${previa.blocos.length} blocos de estudo adicionados.`);
      setPrevia(null);
    } finally {
      setSalvando(false);
    }
  };

  const resumo = previa
    ? Array.from(
        previa.blocos.reduce((mapa, b) => mapa.set(b.disciplina_nome, (mapa.get(b.disciplina_nome) ?? 0) + 1), new Map<string, number>()),
      )
    : [];

  if (!user) return <div className="flex min-h-screen items-center justify-center bg-[#f7fdfd] text-[#29645e]">Carregando rotina...</div>;

  return (
    <div className="flex min-h-screen flex-col bg-[#f7fdfd] font-[Roboto] lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col justify-between bg-[#29645e] px-4 py-6 text-white shadow-lg lg:min-h-screen lg:w-[260px]">
        <div className="flex flex-col gap-8">
          <h1 className="px-2 font-['Rubik_Bubbles'] text-2xl font-normal tracking-wider">Study Flow</h1>
          <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  className={`flex shrink-0 cursor-pointer items-center gap-3 rounded-[15px] px-4 py-3 text-base font-medium lg:w-full ${item.name === "Rotina" ? "bg-white text-[#29645e] shadow-md" : "text-gray-100 hover:bg-[#347871]"}`}
                  key={item.name}
                  onClick={() => router.push(item.href)}
                  type="button"
                >
                  <Icon size={20} />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>
        <button
          className="mt-8 flex cursor-pointer items-center gap-3 rounded-[15px] px-4 py-3 text-red-200 hover:bg-[#a83232]"
          onClick={() => {
            localStorage.removeItem("studyflow_session");
            router.push("/");
          }}
          type="button"
        >
          <LogOut size={20} />
          Sair
        </button>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col overflow-y-auto px-4 py-6 lg:px-8">
        <header className="mb-7 flex justify-end gap-4 border-b border-gray-100 pb-6">
          <button aria-label="Notificações" className="rounded-full border border-gray-100 bg-white p-2.5 text-gray-600 shadow-sm" type="button">
            <Bell size={20} />
          </button>
          <button aria-label="Perfil" className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#eaf6f4] text-[#29645e]" onClick={() => router.push("/perfil")} type="button">
            {user.avatar_url ? <img src={user.avatar_url} alt={user.nome || "Avatar"} className="h-full w-full object-cover" /> : <User size={22} />}
          </button>
        </header>

        <div className="mx-auto grid w-full max-w-6xl gap-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5f8d87]">Planejamento</p>
            <h2 className="mt-1 text-2xl font-bold text-gray-800 lg:text-3xl">Rotina &amp; Cronograma</h2>
            <p className="mt-2 text-sm text-gray-500">Informe quando você pode estudar e gere um cronograma automático de blocos de estudo.</p>
          </div>

          <section aria-labelledby="titulo-rotina" className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-[0_8px_30px_rgba(41,100,94,0.05)]">
            <h3 className="text-xl font-bold text-gray-800" id="titulo-rotina">Minha rotina semanal</h3>
            {rotinaLocal && !loadingData ? (
              <p className="mt-2 rounded-2xl bg-amber-50 px-4 py-2 text-xs text-amber-700" data-testid="aviso-rotina-local">
                Sua rotina está sendo salva apenas neste dispositivo.
              </p>
            ) : null}

            <form className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-end" onSubmit={adicionar}>
              <label className={labelClass} htmlFor="rotina-dia">
                Dia da semana
                <select className={inputClass} id="rotina-dia" onChange={(e) => setDia(e.target.value)} value={dia}>
                  {NOMES_DIAS_SEMANA.map((nome, i) => (
                    <option key={nome} value={i}>{nome}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass} htmlFor="rotina-inicio">
                Início
                <input className={inputClass} id="rotina-inicio" onChange={(e) => setInicio(e.target.value)} type="time" value={inicio} />
              </label>
              <label className={labelClass} htmlFor="rotina-fim">
                Fim
                <input className={inputClass} id="rotina-fim" onChange={(e) => setFim(e.target.value)} type="time" value={fim} />
              </label>
              {/* Desabilitado durante o carregamento inicial e o salvamento para evitar que
                  a rotina carregada sobrescreva um horário recém-adicionado (condição de corrida). */}
              <button className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#29645e] px-5 py-3 font-semibold text-white transition hover:bg-[#1f514d] disabled:cursor-wait disabled:opacity-60" disabled={loadingData || salvandoSlot} type="submit">
                <Plus size={19} /> Adicionar horário
              </button>
            </form>

            {errosRotina.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-600" role="alert">
                {errosRotina.map((erro) => (
                  <p key={erro}>{erro}</p>
                ))}
              </div>
            ) : null}

            {slots.length === 0 ? (
              <p className="mt-6 text-sm text-gray-500">Nenhum horário cadastrado.</p>
            ) : (
              <ul className="mt-6 grid gap-2">
                {slots.map((slot) => {
                  const nomeDia = NOMES_DIAS_SEMANA[slot.dia_semana];
                  return (
                    <li className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-3" key={slot.id}>
                      <span className="text-sm font-semibold text-gray-700">{nomeDia} · {slot.hora_inicio} – {slot.hora_fim}</span>
                      <button
                        aria-label={`Remover horário ${nomeDia} ${slot.hora_inicio}`}
                        className="cursor-pointer rounded-xl p-2 text-red-500 hover:bg-red-50"
                        onClick={() => void remover(slot)}
                        type="button"
                      >
                        <Trash2 size={18} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="titulo-gerar" className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-[0_8px_30px_rgba(41,100,94,0.05)]">
            <h3 className="text-xl font-bold text-gray-800" id="titulo-gerar">Gerar cronograma</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <label className={labelClass} htmlFor="cron-semanas">
                Semanas
                <select className={inputClass} id="cron-semanas" onChange={(e) => setSemanas(e.target.value)} value={semanas}>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className={labelClass} htmlFor="cron-duracao">
                Duração do bloco (min)
                <input className={inputClass} id="cron-duracao" min={10} max={240} onChange={(e) => setDuracao(e.target.value)} type="number" value={duracao} />
              </label>
              <button className="cursor-pointer rounded-2xl bg-[#29645e] px-5 py-3 font-semibold text-white transition hover:bg-[#1f514d]" onClick={gerar} type="button">
                Gerar cronograma
              </button>
            </div>

            {erroGeracao ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm font-medium text-red-600" role="alert">
                {erroGeracao.mensagem}
                {erroGeracao.linkDisciplinas ? (
                  <>
                    {" "}
                    <Link className="font-bold underline" href="/disciplinas">Ir para Disciplinas</Link>
                  </>
                ) : null}
              </div>
            ) : null}

            {sucesso ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-700" role="status">
                <span>{sucesso}</span>
                <Link className="font-bold underline" href="/calendario">Ver no calendário</Link>
              </div>
            ) : null}

            {previa ? (
              <div className="mt-8">
                <h4 className="text-lg font-bold text-gray-800">Prévia do cronograma</h4>
                <ul className="mt-3 flex flex-wrap gap-2" data-testid="resumo-disciplinas">
                  {resumo.map(([nome, qtd]) => {
                    const horas = ((qtd * previa.duracaoMin) / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
                    return (
                      <li className="rounded-full bg-[#eaf6f4] px-3 py-1 text-xs font-semibold text-[#29645e]" key={nome}>
                        {nome}: {qtd} {qtd === 1 ? "bloco" : "blocos"} · {horas} h
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-4 max-h-96 overflow-auto rounded-2xl border border-gray-100">
                  <table className="w-full min-w-[480px]">
                    <thead className="sticky top-0 bg-[#f3f8f7] text-left text-xs uppercase tracking-wider text-[#63817c]">
                      <tr>
                        <th className="px-4 py-3" scope="col">Data</th>
                        <th className="px-4 py-3" scope="col">Horário</th>
                        <th className="px-4 py-3" scope="col">Disciplina</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previa.blocos.map((b) => (
                        <tr className="border-t border-gray-100" key={`${b.data_inicio}-${b.disciplina_id}`}>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatarData(new Date(b.data_inicio))}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{horaLocal(new Date(b.data_inicio))} – {horaLocal(new Date(b.data_fim))}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-800">{b.disciplina_nome}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:justify-end lg:max-w-md">
                  <button className="cursor-pointer rounded-2xl border border-[#cfe0dd] px-4 py-3 font-semibold text-[#29645e]" onClick={() => setPrevia(null)} type="button">
                    Descartar
                  </button>
                  <button className="cursor-pointer rounded-2xl bg-[#29645e] px-4 py-3 font-semibold text-white disabled:opacity-60" disabled={salvando} onClick={() => void confirmar()} type="button">
                    Confirmar e salvar no cronograma
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Clock, Plus, Sparkles, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState, PageLoading } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";

type UserSession = { email: string; nome: string; username: string; avatar_url?: string | null };

type Slot = RotinaSlot & { id: string };

const TABELA_AUSENTE = "PGRST205";

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
  /** Dia (AAAA-MM-DD) do primeiro bloco salvo, para abrir o calendário direto nele. */
  const [primeiroDiaSalvo, setPrimeiroDiaSalvo] = useState<string | null>(null);

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

      const primeiroInicio = Math.min(...previa.blocos.map((b) => new Date(b.data_inicio).getTime()));
      setPrimeiroDiaSalvo(dataLocal(new Date(primeiroInicio)));
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

  if (!user) return <PageLoading label="Carregando rotina..." />;

  return (
    <>
      <PageHeader
        description="Diga quando você pode estudar na semana e o Study Flow distribui blocos de estudo entre as suas disciplinas."
        title="Rotina e cronograma"
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <Card aria-labelledby="titulo-rotina" className="lg:col-span-5">
          <CardHeader
            description="Horários livres para estudar, por dia da semana."
            icon={<CalendarClock size={18} />}
            id="titulo-rotina"
            title="1. Minha rotina semanal"
          />
          {rotinaLocal && !loadingData ? (
            <Alert className="mb-4" tone="warning">
              <span data-testid="aviso-rotina-local">Sua rotina está sendo salva apenas neste dispositivo.</span>
            </Alert>
          ) : null}

          <form className="grid grid-cols-2 gap-3" onSubmit={adicionar}>
            <Field className="col-span-2" htmlFor="rotina-dia" label="Dia da semana">
              <Select id="rotina-dia" onChange={(e) => setDia(e.target.value)} value={dia}>
                {NOMES_DIAS_SEMANA.map((nome, i) => (
                  <option key={nome} value={i}>
                    {nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field htmlFor="rotina-inicio" label="Início">
              <Input id="rotina-inicio" onChange={(e) => setInicio(e.target.value)} type="time" value={inicio} />
            </Field>
            <Field htmlFor="rotina-fim" label="Fim">
              <Input id="rotina-fim" onChange={(e) => setFim(e.target.value)} type="time" value={fim} />
            </Field>
            {/* Desabilitado durante o carregamento inicial e o salvamento para evitar que
                a rotina carregada sobrescreva um horário recém-adicionado (condição de corrida). */}
            <Button className="col-span-2" disabled={loadingData || salvandoSlot} type="submit" variant="secondary">
              <Plus aria-hidden size={18} />
              Adicionar horário
            </Button>
          </form>

          {errosRotina.length > 0 ? (
            <Alert className="mt-4" tone="danger">
              {errosRotina.map((erro) => (
                <p key={erro}>{erro}</p>
              ))}
            </Alert>
          ) : null}

          {slots.length === 0 ? (
            <EmptyState className="mt-5 !py-8" description="Adicione pelo menos um horário para gerar o cronograma." title="Nenhum horário cadastrado" />
          ) : (
            <ul className="mt-5 divide-y divide-line rounded-control border border-line">
              {slots.map((slot) => {
                const nomeDia = NOMES_DIAS_SEMANA[slot.dia_semana];
                return (
                  <li className="flex items-center justify-between gap-3 px-3.5 py-2.5" key={slot.id}>
                    <span className="flex items-center gap-2.5 text-sm text-ink-800">
                      <Clock aria-hidden className="text-primary-600" size={16} />
                      <span className="tabular font-medium">
                        {nomeDia} · {slot.hora_inicio} – {slot.hora_fim}
                      </span>
                    </span>
                    <Button aria-label={`Remover horário ${nomeDia} ${slot.hora_inicio}`} onClick={() => void remover(slot)} size="icon-sm" variant="danger-ghost">
                      <Trash2 size={16} />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card aria-labelledby="titulo-gerar" className="lg:col-span-7">
          <CardHeader
            description="Escolha o período e o tamanho de cada bloco. Você revisa a prévia antes de salvar."
            icon={<Sparkles size={18} />}
            id="titulo-gerar"
            title="2. Gerar cronograma"
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field htmlFor="cron-semanas" label="Semanas">
              <Select id="cron-semanas" onChange={(e) => setSemanas(e.target.value)} value={semanas}>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field htmlFor="cron-duracao" label="Duração do bloco (min)">
              <Input id="cron-duracao" max={240} min={10} onChange={(e) => setDuracao(e.target.value)} type="number" value={duracao} />
            </Field>
            <Button onClick={gerar}>
              <Sparkles aria-hidden size={18} />
              Gerar cronograma
            </Button>
          </div>

          {erroGeracao ? (
            <Alert className="mt-4" tone="danger">
              {erroGeracao.mensagem}
              {erroGeracao.linkDisciplinas ? (
                <>
                  {" "}
                  <Link className="font-semibold underline underline-offset-2" href="/disciplinas">
                    Ir para Disciplinas
                  </Link>
                </>
              ) : null}
            </Alert>
          ) : null}

          {sucesso ? (
            <Alert className="mt-4" role="status" tone="success">
              <span>{sucesso}</span>{" "}
              <Link className="font-semibold underline underline-offset-2" href={primeiroDiaSalvo ? `/calendario?data=${primeiroDiaSalvo}` : "/calendario"}>
                Ver no calendário
              </Link>
            </Alert>
          ) : null}

          {previa ? (
            <div className="mt-6 border-t border-line pt-6">
              <h3 className="text-base font-semibold text-ink-900">Prévia do cronograma</h3>
              <ul className="mt-3 flex flex-wrap gap-2" data-testid="resumo-disciplinas">
                {resumo.map(([nome, qtd]) => {
                  const horas = ((qtd * previa.duracaoMin) / 60).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
                  return (
                    <li className="rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-800" key={nome}>
                      {nome}: {qtd} {qtd === 1 ? "bloco" : "blocos"} · {horas} h
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 max-h-96 overflow-auto rounded-control border border-line">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-ink-50 text-xs text-ink-500">
                    <tr>
                      <th className="px-4 py-2.5 font-medium" scope="col">Data</th>
                      <th className="px-4 py-2.5 font-medium" scope="col">Horário</th>
                      <th className="px-4 py-2.5 font-medium" scope="col">Disciplina</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previa.blocos.map((b) => (
                      <tr className="border-t border-line" key={`${b.data_inicio}-${b.disciplina_id}`}>
                        <td className="tabular px-4 py-2.5 text-ink-600">{formatarData(new Date(b.data_inicio))}</td>
                        <td className="tabular px-4 py-2.5 text-ink-600">
                          {horaLocal(new Date(b.data_inicio))} – {horaLocal(new Date(b.data_fim))}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-ink-900">{b.disciplina_nome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button onClick={() => setPrevia(null)} variant="secondary">
                  Descartar
                </Button>
                <Button disabled={salvando} onClick={() => void confirmar()}>
                  Confirmar e salvar no cronograma
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}

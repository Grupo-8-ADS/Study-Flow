"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Clock, Plus, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getCurrentSupabaseUserId, getStoredSession } from "@/lib/studyflow-data";
import {
  aulasNoPeriodo,
  dataStr,
  hojeStr,
  horaStr,
  intervaloDe,
  proximasProvas,
  salvarBlocosCronograma,
  useAgenda,
} from "@/lib/agenda";
import {
  CronogramaError,
  NOMES_DIAS_SEMANA,
  gerarCronograma,
  validarRotina,
  type BlocoEstudo,
  type RotinaSlot,
} from "@studyflow/shared";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState, PageLoading } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";

type Slot = RotinaSlot & { id: string };

const TABELA_AUSENTE = "PGRST205";

/** Normaliza "19:00:00" (tipo time do Postgres) para "19:00". */
const hhmm = (valor: string) => String(valor).slice(0, 5);

const ordenar = (lista: Slot[]) =>
  [...lista].sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio));

const dois = (n: number) => String(n).padStart(2, "0");

function formatarData(d: Date) {
  const dia = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()];
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} (${dia})`;
}

export default function RotinaPage() {
  const { dados: agenda, carregando: carregandoAgenda } = useAgenda();
  const [email, setEmail] = useState<string | null>(null);
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [rotinaLocal, setRotinaLocal] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [dia, setDia] = useState("1");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [errosRotina, setErrosRotina] = useState<string[]>([]);

  const [semanas, setSemanas] = useState("2");
  const [duracao, setDuracao] = useState("50");
  const [erroGeracao, setErroGeracao] = useState<{ mensagem: string; linkDisciplinas?: boolean } | null>(null);
  const [previa, setPrevia] = useState<{ blocos: BlocoEstudo[]; duracaoMin: number; descartados: number } | null>(null);
  const [substituir, setSubstituir] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvandoSlot, setSalvandoSlot] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);
  /** Dia (AAAA-MM-DD) do primeiro bloco salvo, para abrir o calendário direto nele. */
  const [primeiroDiaSalvo, setPrimeiroDiaSalvo] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      const parsed = getStoredSession();
      if (!parsed) return;
      setEmail(parsed.email);

      const chaveRotina = `studyflow_rotina_${parsed.email}`;
      const lerRotinaLocal = () => {
        const salvo = localStorage.getItem(chaveRotina);
        return salvo ? (JSON.parse(salvo) as Slot[]) : [];
      };

      try {
        const userId = await getCurrentSupabaseUserId(parsed);
        setSupabaseUserId(userId);
        if (!userId) {
          setRotinaLocal(true);
          setSlots(ordenar(lerRotinaLocal()));
          return;
        }

        const rotinaRes = await supabase
          .from("rotinas_semanais")
          .select("id,dia_semana,hora_inicio,hora_fim")
          .eq("user_id", userId)
          .order("dia_semana", { ascending: true });

        if (rotinaRes.error) {
          // Tabela ainda inexistente no banco (ou falha de rede): usa o armazenamento local.
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
      } finally {
        setLoadingData(false);
      }
    }

    void carregar();
  }, []);

  const agora = new Date();
  const blocosFuturos = useMemo(
    () => (agenda?.compromissos ?? []).filter((c) => c.origem === "cronograma" && !c.concluido && intervaloDe(c).inicio >= new Date()),
    [agenda],
  );

  const persistirLocal = (lista: Slot[]) => {
    if (email) localStorage.setItem(`studyflow_rotina_${email}`, JSON.stringify(lista));
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
    if (!agenda) return;

    if (agenda.disciplinas.length === 0) {
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

    const nSemanas = Number(semanas);
    const hoje = hojeStr();
    const fimPeriodo = dataStr(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + nSemanas * 7 - 1));
    const provas = proximasProvas(agenda.compromissos);

    // O que já ocupa o tempo: aulas, compromissos com horário e (se não for substituir) blocos já salvos.
    const ocupados = [
      ...aulasNoPeriodo(agenda.disciplinas, hoje, fimPeriodo),
      ...agenda.compromissos.filter(
        (c) =>
          c.horaInicio &&
          !c.concluido &&
          c.data >= hoje &&
          c.data <= fimPeriodo &&
          !(substituir && c.origem === "cronograma"),
      ),
    ].map((c) => {
      const { inicio: ini, fim: f } = intervaloDe(c);
      // Compromisso só com horário de início ocupa 1 h.
      return { inicio: ini, fim: f > ini ? f : new Date(ini.getTime() + 60 * 60 * 1000) };
    });

    try {
      const params = {
        disciplinas: agenda.disciplinas.map((d) => ({ id: d.id, nome: d.nome, peso: d.prioridade, proximaProva: provas.get(d.id) ?? null })),
        rotina: slots,
        dataInicio: agora,
        semanas: nSemanas,
        duracaoBlocoMin: duracaoMin,
      };
      const todos = (() => {
        try {
          return gerarCronograma(params).length;
        } catch {
          return 0;
        }
      })();
      const blocos = gerarCronograma({ ...params, ocupados, naoAntesDe: agora });
      setPrevia({ blocos, duracaoMin, descartados: Math.max(0, todos - blocos.length) });
    } catch (e) {
      setErroGeracao({ mensagem: e instanceof CronogramaError ? e.message : "Não foi possível gerar o cronograma." });
    }
  };

  const confirmar = async () => {
    if (!previa) return;
    setSalvando(true);
    setErroGeracao(null);
    const msg = await salvarBlocosCronograma(previa.blocos, substituir);
    setSalvando(false);
    if (msg) {
      setErroGeracao({ mensagem: msg });
      return;
    }
    const primeiroInicio = Math.min(...previa.blocos.map((b) => new Date(b.data_inicio).getTime()));
    setPrimeiroDiaSalvo(dataStr(new Date(primeiroInicio)));
    setSucesso(`Cronograma salvo! ${previa.blocos.length} blocos de estudo adicionados.`);
    setPrevia(null);
  };

  const resumo = previa
    ? Array.from(
        previa.blocos.reduce((mapa, b) => mapa.set(b.disciplina_nome, (mapa.get(b.disciplina_nome) ?? 0) + 1), new Map<string, number>()),
      )
    : [];

  if (!email || carregandoAgenda) return <PageLoading label="Carregando rotina..." />;

  return (
    <>
      <PageHeader title="Rotina e cronograma" />

      <div className="grid gap-6 lg:grid-cols-12">
        <Card aria-labelledby="titulo-rotina" className="lg:col-span-5">
          <CardHeader icon={<CalendarClock size={18} />} id="titulo-rotina" title="1. Horários livres para estudar" />
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
          <CardHeader icon={<Sparkles size={18} />} id="titulo-gerar" title="2. Gerar cronograma" />
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

          {blocosFuturos.length > 0 ? (
            <label className="mt-4 flex w-fit cursor-pointer select-none items-center gap-2 text-sm text-ink-700">
              <input
                checked={substituir}
                className="h-4 w-4 cursor-pointer rounded accent-primary-700"
                onChange={(e) => {
                  setSubstituir(e.target.checked);
                  setPrevia(null);
                }}
                type="checkbox"
              />
              Substituir os {blocosFuturos.length} blocos de estudo já agendados
            </label>
          ) : null}

          <details className="mt-4 rounded-control border border-line bg-ink-50/60 px-3.5 py-2.5 text-sm text-ink-600">
            <summary className="cursor-pointer font-medium text-ink-800">Como o cronograma é montado</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Cada horário livre é dividido em blocos do tamanho escolhido, com 10 min de pausa entre eles.</li>
              <li>Horários que batem com aulas, compromissos com horário ou que já passaram são pulados.</li>
              <li>As disciplinas se revezam de forma proporcional à prioridade (alta = 3×, média = 2×, baixa = 1×), sem repetir a mesma em sequência.</li>
              <li>Disciplinas com prova dentro do período ganham o dobro de peso até o dia da prova.</li>
              <li>Não há sorteio: as mesmas entradas geram sempre o mesmo cronograma.</li>
            </ul>
          </details>

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
              {previa.descartados > 0 ? (
                <p className="mt-1 text-sm text-ink-500">
                  {previa.descartados} {previa.descartados === 1 ? "horário foi pulado" : "horários foram pulados"} por já ter passado ou bater com outro compromisso.
                </p>
              ) : null}
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
                          {horaStr(new Date(b.data_inicio))} – {horaStr(new Date(b.data_fim))}
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
                  {salvando ? "Salvando..." : substituir && blocosFuturos.length > 0 ? "Substituir e salvar" : "Confirmar e salvar no cronograma"}
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}

/**
 * Calendário da Agenda: grade mensal com provas, trabalhos, atividades, blocos de estudo
 * e as aulas semanais das disciplinas. Criar e editar usa o mesmo formulário da lista de compromissos.
 * @packageDocumentation
 */

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, Plus } from "lucide-react";
import {
  ROTULO_TIPO,
  alternarConcluido,
  aulasNoPeriodo,
  dataLocal,
  dataStr,
  formatarHorario,
  hojeStr,
  ordenarCompromissos,
  useAgenda,
  type Compromisso,
  type CompromissoForm,
} from "@/lib/agenda";
import { ESTILO_TIPO } from "@/lib/agenda-estilos";
import { CompromissoEditor } from "@/components/compromisso-editor";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Alert, EmptyState, PageLoading } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";

type Evento = Compromisso & { aula?: true };

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const chaveEstilo = (e: Evento) => (e.aula ? "aula" : e.tipo);

function CalendarioConteudo() {
  const searchParams = useSearchParams();
  const { dados, carregando, erro } = useAgenda();

  // ?data=AAAA-MM-DD abre o calendário num dia específico (ex.: vindo da rotina).
  const dataInicial = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get("data") ?? "") ? searchParams.get("data")! : null;
  const [selecionada, setSelecionada] = useState(dataInicial ?? hojeStr());
  const [mes, setMes] = useState(() => {
    const d = dataLocal(dataInicial ?? hojeStr());
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [editor, setEditor] = useState<Compromisso | Partial<CompromissoForm> | null>(null);

  const ano = mes.getFullYear();
  const m = mes.getMonth();
  const primeiro = dataStr(new Date(ano, m, 1));
  const ultimo = dataStr(new Date(ano, m + 1, 0));

  // O React Compiler já memoiza este cálculo.
  const porDia = (() => {
    const mapa = new Map<string, Evento[]>();
    if (!dados) return mapa;
    // Inclui o dia selecionado mesmo que esteja fora do mês exibido.
    const de = selecionada < primeiro ? selecionada : primeiro;
    const ate = selecionada > ultimo ? selecionada : ultimo;
    const eventos: Evento[] = [
      ...dados.compromissos.filter((c) => c.data >= de && c.data <= ate),
      ...aulasNoPeriodo(dados.disciplinas, de, ate),
    ];
    ordenarCompromissos(eventos).forEach((e) => {
      const lista = mapa.get(e.data) ?? [];
      lista.push(e as Evento);
      mapa.set(e.data, lista);
    });
    return mapa;
  })();

  if (carregando || !dados) return erro ? <Alert tone="danger">{erro}</Alert> : <PageLoading label="Carregando calendário..." />;

  const nomeDisciplina = (id: string | null) => dados.disciplinas.find((d) => d.id === id)?.nome;

  const offset = (new Date(ano, m, 1).getDay() + 6) % 7; // segunda = 0
  const total = new Date(ano, m + 1, 0).getDate();
  const celulas: (number | null)[] = [...Array<null>(offset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (celulas.length % 7 !== 0) celulas.push(null);

  const hoje = hojeStr();
  const doDia = porDia.get(selecionada) ?? [];
  const sel = dataLocal(selecionada);
  const diaSemana = sel.toLocaleDateString("pt-BR", { weekday: "long" });
  const rotuloDia = `${diaSemana.charAt(0).toUpperCase()}${diaSemana.slice(1)}, ${sel.getDate()} de ${MESES[sel.getMonth()].toLowerCase()}`;

  const irPara = (data: string) => {
    setSelecionada(data);
    const d = dataLocal(data);
    setMes(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  return (
    <>
      <PageHeader
        actions={
          <Button onClick={() => setEditor({ data: selecionada })}>
            <Plus aria-hidden size={18} />
            Novo compromisso
          </Button>
        }
        title="Calendário"
      />
      {erro ? (
        <Alert className="mb-4" tone="warning">
          {erro}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="!p-3 sm:!p-5 lg:col-span-8">
          <div className="mb-4 flex items-center justify-between gap-3 px-1">
            <h2 aria-live="polite" className="text-lg font-semibold text-ink-900">
              {MESES[m]} <span className="font-normal text-ink-500">{ano}</span>
            </h2>
            <div className="flex items-center gap-1">
              <Button onClick={() => irPara(hoje)} size="sm" variant="ghost">
                Hoje
              </Button>
              <Button aria-label="Mês anterior" onClick={() => setMes(new Date(ano, m - 1, 1))} size="icon-sm" variant="secondary">
                <ChevronLeft size={16} />
              </Button>
              <Button aria-label="Próximo mês" onClick={() => setMes(new Date(ano, m + 1, 1))} size="icon-sm" variant="secondary">
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>

          <div aria-hidden className="grid grid-cols-7 border-b border-line pb-2 text-center text-xs font-medium text-ink-500">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((l) => (
              <div key={l}>{l}</div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-px">
            {celulas.map((dia, idx) => {
              if (dia === null) return <div className="h-14 sm:h-20 lg:h-24" key={`v-${idx}`} />;
              const data = dataStr(new Date(ano, m, dia));
              const eventos = porDia.get(data) ?? [];
              const isSel = data === selecionada;
              return (
                <button
                  aria-label={`${dia} de ${MESES[m]}${eventos.length ? `: ${eventos.map((e) => e.titulo).join(", ")}` : ""}`}
                  aria-pressed={isSel}
                  className={`flex h-14 flex-col items-center gap-1 rounded-[10px] p-1 text-left transition-colors sm:h-20 sm:items-stretch sm:p-1.5 lg:h-24 ${
                    isSel ? "bg-primary-50 ring-2 ring-inset ring-primary-500" : "hover:bg-ink-50"
                  }`}
                  key={data}
                  onClick={() => setSelecionada(data)}
                  onDoubleClick={() => setEditor({ data })}
                  type="button"
                >
                  <span
                    className={`tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-medium ${
                      data === hoje ? "bg-primary-700 text-white" : isSel ? "text-primary-800" : "text-ink-700"
                    }`}
                  >
                    {dia}
                  </span>
                  <span aria-hidden className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                    {eventos.slice(0, 3).map((e) => (
                      <span className={`h-1.5 w-1.5 rounded-full ${ESTILO_TIPO[chaveEstilo(e)].dot}`} key={e.id} />
                    ))}
                  </span>
                  <span aria-hidden className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                    {eventos.slice(0, 2).map((e) => (
                      <span
                        className={`truncate rounded-[4px] px-1.5 py-px text-[11px] font-medium leading-4 ${ESTILO_TIPO[chaveEstilo(e)].chip} ${e.concluido ? "line-through opacity-60" : ""}`}
                        key={e.id}
                      >
                        {e.titulo}
                      </span>
                    ))}
                    {eventos.length > 2 ? <span className="px-1.5 text-[11px] font-medium text-ink-500">+{eventos.length - 2} mais</span> : null}
                  </span>
                </button>
              );
            })}
          </div>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-1 pt-3 text-xs text-ink-500">
            {(["prova", "trabalho", "atividade", "estudo", "aula"] as const).map((t) => (
              <li className="flex items-center gap-1.5" key={t}>
                <span aria-hidden className={`h-2 w-2 rounded-full ${ESTILO_TIPO[t].dot}`} />
                {ROTULO_TIPO[t]}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="flex flex-col lg:col-span-4">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-ink-900">{rotuloDia}</h2>
            <p className="mt-0.5 text-sm text-ink-500">
              {doDia.length === 0 ? "Nada marcado" : `${doDia.length} ${doDia.length === 1 ? "item" : "itens"}`}
            </p>
          </div>

          {doDia.length === 0 ? (
            <EmptyState className="flex-1 !py-8" icon={<CalendarDays size={22} />} title="Dia livre" />
          ) : (
            <ul className="flex max-h-[460px] flex-col gap-2 overflow-y-auto">
              {doDia.map((e) => (
                <li className="flex items-start gap-2 rounded-control border border-line p-2.5" key={e.id}>
                  {e.aula ? (
                    <span aria-hidden className={`mx-2 mt-1 h-8 w-1 shrink-0 rounded-full ${ESTILO_TIPO.aula.dot}`} />
                  ) : (
                    <button
                      aria-label={e.concluido ? `Marcar ${e.titulo} como pendente` : `Marcar ${e.titulo} como feito`}
                      className="mt-0.5 rounded-full p-1 text-ink-400 transition-colors hover:text-primary-700"
                      onClick={() => void alternarConcluido(e.id)}
                      type="button"
                    >
                      {e.concluido ? <CheckCircle2 className="text-success" size={20} /> : <Circle size={20} />}
                    </button>
                  )}
                  {e.aula ? (
                    <Link className="min-w-0 flex-1 rounded-[6px] text-left" href="/disciplinas">
                      <ItemDia evento={e} />
                    </Link>
                  ) : (
                    <button className="min-w-0 flex-1 rounded-[6px] text-left" onClick={() => setEditor(e)} type="button">
                      <ItemDia disciplina={nomeDisciplina(e.disciplinaId)} evento={e} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <Button className="mt-4 w-full" onClick={() => setEditor({ data: selecionada })} variant="secondary">
            <Plus aria-hidden size={18} />
            Adicionar neste dia
          </Button>
        </Card>
      </div>

      {editor ? <CompromissoEditor disciplinas={dados.disciplinas} inicial={editor} onClose={() => setEditor(null)} /> : null}
    </>
  );
}

function ItemDia({ evento, disciplina }: { evento: Evento; disciplina?: string }) {
  const estilo = ESTILO_TIPO[chaveEstilo(evento)];
  return (
    <>
      <p className={`text-sm font-medium leading-snug ${evento.concluido ? "text-ink-500 line-through" : "text-ink-900"}`}>{evento.titulo}</p>
      <p className="tabular mt-0.5 text-xs text-ink-500">{formatarHorario(evento)}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <Badge tone={estilo.tone}>{evento.aula ? "Aula" : ROTULO_TIPO[evento.tipo]}</Badge>
        {!evento.aula && disciplina ? <Badge>{disciplina}</Badge> : null}
      </div>
    </>
  );
}

// useSearchParams exige um limite de Suspense para a rota continuar pré-renderizada.
export default function CalendarioPage() {
  return (
    <Suspense fallback={null}>
      <CalendarioConteudo />
    </Suspense>
  );
}

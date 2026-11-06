/**
 * Lista de compromissos da Agenda (provas, trabalhos, atividades e estudos), agrupada por dia.
 * Usa o mesmo formulário e os mesmos dados do Calendário.
 * @packageDocumentation
 */

"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Circle, ListChecks, Plus } from "lucide-react";
import {
  ROTULO_TIPO,
  alternarConcluido,
  formatarData,
  formatarHorario,
  hojeStr,
  useAgenda,
  type Compromisso,
  type CompromissoForm,
  type TipoCompromisso,
} from "@/lib/agenda";
import { ESTILO_TIPO } from "@/lib/agenda-estilos";
import { CompromissoEditor } from "@/components/compromisso-editor";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Alert, EmptyState, PageLoading } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";

type Visao = "proximos" | "atrasados" | "concluidos" | "todos";

const VISOES: Array<[Visao, string]> = [
  ["proximos", "Próximos"],
  ["atrasados", "Atrasados"],
  ["concluidos", "Concluídos"],
  ["todos", "Todos"],
];

export default function CompromissosPage() {
  const { dados, carregando, erro } = useAgenda();
  const [visao, setVisao] = useState<Visao>("proximos");
  const [tipos, setTipos] = useState<Set<TipoCompromisso>>(() => new Set(["prova", "trabalho", "atividade"]));
  const [editor, setEditor] = useState<Compromisso | Partial<CompromissoForm> | null>(null);

  const hoje = hojeStr();

  const grupos = useMemo(() => {
    const lista = (dados?.compromissos ?? []).filter((c) => {
      if (!tipos.has(c.tipo)) return false;
      if (visao === "proximos") return !c.concluido && c.data >= hoje;
      if (visao === "atrasados") return !c.concluido && c.data < hoje;
      if (visao === "concluidos") return c.concluido;
      return true;
    });
    if (visao === "concluidos" || visao === "atrasados") lista.reverse();
    const mapa = new Map<string, Compromisso[]>();
    lista.forEach((c) => mapa.set(c.data, [...(mapa.get(c.data) ?? []), c]));
    return Array.from(mapa.entries());
  }, [dados, tipos, visao, hoje]);

  if (carregando || !dados) return erro ? <Alert tone="danger">{erro}</Alert> : <PageLoading label="Carregando compromissos..." />;

  const atrasados = dados.compromissos.filter((c) => !c.concluido && c.data < hoje && c.tipo !== "estudo").length;
  const nomeDisciplina = (id: string | null) => dados.disciplinas.find((d) => d.id === id)?.nome;

  const alternarTipo = (t: TipoCompromisso) =>
    setTipos((atual) => {
      const novo = new Set(atual);
      if (novo.has(t)) novo.delete(t);
      else novo.add(t);
      return novo.size === 0 ? atual : novo;
    });

  const rotuloGrupo = (data: string) => {
    if (data === hoje) return "Hoje";
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const a = `${amanha.getFullYear()}-${String(amanha.getMonth() + 1).padStart(2, "0")}-${String(amanha.getDate()).padStart(2, "0")}`;
    if (data === a) return "Amanhã";
    return formatarData(data, true);
  };

  return (
    <>
      <PageHeader
        actions={
          <Button onClick={() => setEditor({})}>
            <Plus aria-hidden size={18} />
            Novo compromisso
          </Button>
        }
        title="Compromissos"
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div aria-label="Período" className="flex w-fit gap-1 rounded-full bg-ink-100 p-1" role="group">
          {VISOES.map(([v, rotulo]) => (
            <button
              aria-pressed={visao === v}
              className={`h-8 rounded-full px-3.5 text-[13px] font-medium transition-colors ${visao === v ? "bg-white text-ink-900 shadow-sm" : "text-ink-600 hover:text-ink-900"}`}
              key={v}
              onClick={() => setVisao(v)}
              type="button"
            >
              {rotulo}
              {v === "atrasados" && atrasados > 0 ? <span className="ml-1.5 rounded-full bg-danger px-1.5 text-[11px] text-white">{atrasados}</span> : null}
            </button>
          ))}
        </div>
        <div aria-label="Tipos exibidos" className="flex flex-wrap gap-1.5" role="group">
          {(["prova", "trabalho", "atividade", "estudo"] as const).map((t) => (
            <button
              aria-pressed={tipos.has(t)}
              className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ring-1 transition-colors ${
                tipos.has(t) ? "bg-white text-ink-800 ring-ink-300" : "bg-transparent text-ink-400 ring-line"
              }`}
              key={t}
              onClick={() => alternarTipo(t)}
              type="button"
            >
              <span aria-hidden className={`h-2 w-2 rounded-full ${tipos.has(t) ? ESTILO_TIPO[t].dot : "bg-ink-200"}`} />
              {ROTULO_TIPO[t]}
            </button>
          ))}
        </div>
      </div>

      {grupos.length === 0 ? (
        <EmptyState
          action={
            visao === "proximos" ? (
              <Button onClick={() => setEditor({})}>
                <Plus aria-hidden size={18} />
                Novo compromisso
              </Button>
            ) : undefined
          }
          className="bg-white py-16"
          icon={<ListChecks size={22} />}
          title={visao === "atrasados" ? "Nada atrasado" : visao === "concluidos" ? "Nada concluído ainda" : "Nenhum compromisso"}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {grupos.map(([data, itens]) => (
            <section key={data}>
              <h2 className={`mb-2 text-sm font-semibold ${data < hoje && visao !== "concluidos" ? "text-danger" : "text-ink-700"}`}>{rotuloGrupo(data)}</h2>
              <Card className="divide-y divide-line overflow-hidden" padded={false}>
                {itens.map((c) => (
                  <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4" key={c.id}>
                    <button
                      aria-label={c.concluido ? `Marcar ${c.titulo} como pendente` : `Marcar ${c.titulo} como feito`}
                      className="rounded-full p-1 text-ink-400 transition-colors hover:text-primary-700"
                      onClick={() => void alternarConcluido(c.id)}
                      type="button"
                    >
                      {c.concluido ? <CheckCircle2 className="text-success" size={20} /> : <Circle size={20} />}
                    </button>
                    <button className="flex min-w-0 flex-1 items-center gap-3 rounded-[6px] text-left" onClick={() => setEditor(c)} type="button">
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm font-medium ${c.concluido ? "text-ink-500 line-through" : "text-ink-900"}`}>{c.titulo}</span>
                        <span className="tabular block text-xs text-ink-500">
                          {formatarHorario(c)}
                          {c.notas ? ` · ${c.notas}` : ""}
                        </span>
                      </span>
                      <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                        {nomeDisciplina(c.disciplinaId) ? <Badge>{nomeDisciplina(c.disciplinaId)}</Badge> : null}
                        <Badge tone={ESTILO_TIPO[c.tipo].tone}>{ROTULO_TIPO[c.tipo]}</Badge>
                      </span>
                      <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full sm:hidden ${ESTILO_TIPO[c.tipo].dot}`} />
                    </button>
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}

      {editor ? <CompromissoEditor disciplinas={dados.disciplinas} inicial={editor} onClose={() => setEditor(null)} /> : null}
    </>
  );
}

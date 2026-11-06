/**
 * Disciplinas do semestre: nome, professor, prioridade (peso no cronograma) e os horários
 * de aula da semana. Provas e trabalhos são compromissos da Agenda ligados à disciplina.
 * @packageDocumentation
 */

"use client";

import { useState, type FormEvent } from "react";
import { BookOpen, Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { NOMES_DIAS_SEMANA } from "@studyflow/shared";
import {
  ROTULO_TIPO,
  excluirDisciplina,
  formatarData,
  formatarHorario,
  hojeStr,
  salvarDisciplina,
  useAgenda,
  type Aula,
  type Compromisso,
  type CompromissoForm,
  type Disciplina,
  type DisciplinaForm,
} from "@/lib/agenda";
import { ESTILO_TIPO } from "@/lib/agenda-estilos";
import { CompromissoEditor } from "@/components/compromisso-editor";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Alert, EmptyState, PageLoading } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";

const vazia: DisciplinaForm = { nome: "", professor: "", prioridade: 2, aulas: [], notas: "" };

const PRIORIDADES: Array<[1 | 2 | 3, string]> = [
  [1, "Baixa"],
  [2, "Média"],
  [3, "Alta"],
];

const diaCurto = (d: number) => NOMES_DIAS_SEMANA[d].slice(0, 3);

function resumoAulas(aulas: Aula[]) {
  if (aulas.length === 0) return "Sem horário de aula";
  return [...aulas]
    .sort((a, b) => a.dia_semana - b.dia_semana || a.inicio.localeCompare(b.inicio))
    .map((a) => `${diaCurto(a.dia_semana)} ${a.inicio}–${a.fim}`)
    .join(" · ");
}

export default function DisciplinasPage() {
  const { dados, carregando, erro } = useAgenda();
  const [editando, setEditando] = useState<{ id?: string; form: DisciplinaForm } | null>(null);
  const [vendo, setVendo] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<Disciplina | null>(null);
  const [compromisso, setCompromisso] = useState<Compromisso | Partial<CompromissoForm> | null>(null);

  if (carregando || !dados) return erro ? <Alert tone="danger">{erro}</Alert> : <PageLoading label="Carregando disciplinas..." />;

  const hoje = hojeStr();
  const avaliacoesDe = (id: string) =>
    dados.compromissos.filter((c) => c.disciplinaId === id && (c.tipo === "prova" || c.tipo === "trabalho"));
  const proximaDe = (id: string) => avaliacoesDe(id).find((c) => c.data >= hoje && !c.concluido);
  const disciplinaVista = vendo ? dados.disciplinas.find((d) => d.id === vendo) ?? null : null;

  const remover = async () => {
    if (!excluindo) return;
    await excluirDisciplina(excluindo.id);
    setExcluindo(null);
    setVendo(null);
  };

  return (
    <>
      <PageHeader
        actions={
          <Button onClick={() => setEditando({ form: vazia })}>
            <Plus aria-hidden size={18} />
            Adicionar disciplina
          </Button>
        }
        title="Disciplinas"
      />

      {dados.disciplinas.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={() => setEditando({ form: vazia })}>
              <Plus aria-hidden size={18} />
              Cadastrar primeira disciplina
            </Button>
          }
          className="bg-white py-16"
          description="Com as disciplinas e seus horários de aula, o cronograma de estudos encaixa os blocos nos seus horários livres."
          icon={<BookOpen size={22} />}
          title="Nenhuma disciplina adicionada"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dados.disciplinas.map((d) => {
            const proxima = proximaDe(d.id);
            return (
              <li key={d.id}>
                <Card as="article" className="flex h-full flex-col !p-4">
                  <div className="flex items-start justify-between gap-2">
                    <button className="min-w-0 flex-1 text-left" onClick={() => setVendo(d.id)} type="button">
                      <p className="truncate font-semibold text-ink-900">{d.nome}</p>
                      {d.professor ? <p className="truncate text-sm text-ink-500">Prof. {d.professor}</p> : null}
                    </button>
                    <div className="flex shrink-0 gap-1">
                      <Button aria-label={`Editar ${d.nome}`} onClick={() => setEditando({ id: d.id, form: { ...d } })} size="icon-sm" variant="ghost">
                        <Pencil size={16} />
                      </Button>
                      <Button aria-label={`Excluir ${d.nome}`} onClick={() => setExcluindo(d)} size="icon-sm" variant="danger-ghost">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                  <p className="tabular mt-3 flex items-start gap-1.5 text-sm text-ink-600">
                    <Clock aria-hidden className="mt-0.5 shrink-0 text-ink-400" size={15} />
                    {resumoAulas(d.aulas)}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3">
                    <Badge tone={d.prioridade === 3 ? "danger" : d.prioridade === 1 ? "neutral" : "primary"}>
                      Prioridade {PRIORIDADES.find(([p]) => p === d.prioridade)?.[1].toLowerCase()}
                    </Badge>
                    {proxima ? (
                      <Badge tone={ESTILO_TIPO[proxima.tipo].tone}>
                        {ROTULO_TIPO[proxima.tipo]} {formatarData(proxima.data).slice(0, 5)}
                      </Badge>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {editando ? <DisciplinaEditor inicial={editando} onClose={() => setEditando(null)} /> : null}

      {disciplinaVista ? (
        <Modal
          footer={
            <>
              <Button onClick={() => setVendo(null)} variant="secondary">
                Fechar
              </Button>
              <Button
                onClick={() => {
                  setEditando({ id: disciplinaVista.id, form: { ...disciplinaVista } });
                  setVendo(null);
                }}
              >
                <Pencil aria-hidden size={16} />
                Editar
              </Button>
            </>
          }
          onClose={() => setVendo(null)}
          title={disciplinaVista.nome}
        >
          <div className="grid gap-5 text-sm">
            {disciplinaVista.professor ? <p className="text-ink-600">Prof. {disciplinaVista.professor}</p> : null}
            <section>
              <h3 className="mb-1.5 font-semibold text-ink-800">Aulas</h3>
              <p className="tabular text-ink-600">{resumoAulas(disciplinaVista.aulas)}</p>
            </section>
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-ink-800">Provas e trabalhos</h3>
                <div className="flex gap-1.5">
                  <Button onClick={() => setCompromisso({ tipo: "prova", disciplinaId: disciplinaVista.id, titulo: "" })} size="sm" variant="secondary">
                    <Plus aria-hidden size={14} />
                    Prova
                  </Button>
                  <Button onClick={() => setCompromisso({ tipo: "trabalho", disciplinaId: disciplinaVista.id, titulo: "" })} size="sm" variant="secondary">
                    <Plus aria-hidden size={14} />
                    Trabalho
                  </Button>
                </div>
              </div>
              {avaliacoesDe(disciplinaVista.id).length === 0 ? (
                <p className="text-ink-500">Nenhuma prova ou trabalho marcado.</p>
              ) : (
                <ul className="divide-y divide-line rounded-control border border-line">
                  {avaliacoesDe(disciplinaVista.id).map((c) => (
                    <li key={c.id}>
                      <button className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-ink-50" onClick={() => setCompromisso(c)} type="button">
                        <span className="flex min-w-0 items-center gap-2">
                          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${ESTILO_TIPO[c.tipo].dot}`} />
                          <span className={`truncate font-medium ${c.concluido ? "text-ink-500 line-through" : "text-ink-800"}`}>{c.titulo}</span>
                        </span>
                        <span className={`tabular shrink-0 ${c.data < hoje && !c.concluido ? "text-danger" : "text-ink-500"}`}>
                          {formatarData(c.data)}
                          {c.horaInicio ? ` · ${formatarHorario(c)}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {disciplinaVista.notas ? (
              <section>
                <h3 className="mb-1 font-semibold text-ink-800">Anotações</h3>
                <p className="whitespace-pre-wrap text-ink-600">{disciplinaVista.notas}</p>
              </section>
            ) : null}
          </div>
        </Modal>
      ) : null}

      {compromisso ? <CompromissoEditor disciplinas={dados.disciplinas} inicial={compromisso} onClose={() => setCompromisso(null)} /> : null}

      {excluindo ? (
        <Modal
          footer={
            <>
              <Button onClick={() => setExcluindo(null)} variant="secondary">
                Cancelar
              </Button>
              <Button onClick={() => void remover()} variant="danger">
                Excluir
              </Button>
            </>
          }
          onClose={() => setExcluindo(null)}
          size="sm"
          title="Excluir disciplina"
        >
          <p className="text-sm text-ink-600">
            Excluir “{excluindo.nome}”? Provas, trabalhos e blocos de estudo ligados a ela continuam na agenda, sem disciplina.
          </p>
        </Modal>
      ) : null}
    </>
  );
}

function DisciplinaEditor({ inicial, onClose }: { inicial: { id?: string; form: DisciplinaForm }; onClose: () => void }) {
  const [form, setForm] = useState<DisciplinaForm>(() => ({ ...inicial.form, aulas: inicial.form.aulas.map((a) => ({ ...a })) }));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const mudar = (parcial: Partial<DisciplinaForm>) => {
    setErro(null);
    setForm((f) => ({ ...f, ...parcial }));
  };
  const mudarAula = (i: number, parcial: Partial<Aula>) => mudar({ aulas: form.aulas.map((a, j) => (j === i ? { ...a, ...parcial } : a)) });

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    setSalvando(true);
    const msg = await salvarDisciplina(form, inicial.id);
    setSalvando(false);
    if (msg) setErro(msg);
    else onClose();
  };

  return (
    <Modal
      footer={
        <>
          <Button onClick={onClose} variant="secondary">
            Cancelar
          </Button>
          <Button disabled={salvando} form="form-disciplina" type="submit">
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </>
      }
      onClose={onClose}
      title={inicial.id ? "Editar disciplina" : "Nova disciplina"}
    >
      <form className="grid gap-4" id="form-disciplina" noValidate onSubmit={enviar}>
        {erro ? <Alert tone="danger">{erro}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field htmlFor="disciplina-nome" label="Nome">
            <Input id="disciplina-nome" onChange={(e) => mudar({ nome: e.target.value })} placeholder="Ex.: Cálculo I" value={form.nome} />
          </Field>
          <Field htmlFor="disciplina-professor" label="Professor (opcional)">
            <Input id="disciplina-professor" onChange={(e) => mudar({ professor: e.target.value })} value={form.professor} />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-700">Prioridade no cronograma</legend>
          <div className="flex gap-2">
            {PRIORIDADES.map(([p, rotulo]) => (
              <label
                className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500 ${
                  form.prioridade === p ? "bg-primary-700 text-white ring-primary-700" : "bg-white text-ink-700 ring-line hover:bg-ink-50"
                }`}
                key={p}
              >
                <input checked={form.prioridade === p} className="sr-only" name="prioridade" onChange={() => mudar({ prioridade: p })} type="radio" />
                {rotulo}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-ink-500">Prioridade alta recebe até 3× mais blocos de estudo que a baixa.</p>
        </fieldset>

        <fieldset className="rounded-card border border-line bg-ink-50/60 p-3.5">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <legend className="text-sm font-semibold text-ink-800">Horários de aula</legend>
            <Button onClick={() => mudar({ aulas: [...form.aulas, { dia_semana: 1, inicio: "19:00", fim: "20:40" }] })} size="sm" variant="secondary">
              <Plus aria-hidden size={14} />
              Adicionar aula
            </Button>
          </div>
          {form.aulas.length === 0 ? (
            <p className="text-sm text-ink-500">Nenhum horário. As aulas aparecem toda semana no calendário e o cronograma não marca estudo por cima delas.</p>
          ) : (
            <ul className="grid gap-2">
              {form.aulas.map((a, i) => (
                <li className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2" key={i}>
                  <Select aria-label={`Dia da aula ${i + 1}`} onChange={(e) => mudarAula(i, { dia_semana: Number(e.target.value) })} value={a.dia_semana}>
                    {NOMES_DIAS_SEMANA.map((nome, d) => (
                      <option key={nome} value={d}>
                        {nome}
                      </option>
                    ))}
                  </Select>
                  <Input aria-label={`Início da aula ${i + 1}`} className="!w-28" onChange={(e) => mudarAula(i, { inicio: e.target.value })} type="time" value={a.inicio} />
                  <Input aria-label={`Fim da aula ${i + 1}`} className="!w-28" onChange={(e) => mudarAula(i, { fim: e.target.value })} type="time" value={a.fim} />
                  <Button aria-label={`Remover aula ${i + 1}`} onClick={() => mudar({ aulas: form.aulas.filter((_, j) => j !== i) })} size="icon-sm" variant="danger-ghost">
                    <Trash2 size={16} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <Field htmlFor="disciplina-notas" label="Anotações">
          <Textarea className="min-h-20 resize-y" id="disciplina-notas" onChange={(e) => mudar({ notas: e.target.value })} placeholder="Sala, links úteis, critérios de avaliação..." value={form.notas} />
        </Field>
      </form>
    </Modal>
  );
}

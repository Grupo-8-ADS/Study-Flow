/**
 * Atividades fixas da rotina (trabalho, academia, curso...): cadastro igual ao das
 * disciplinas, com horários semanais e aviso de conflito com aulas e outras atividades.
 * @packageDocumentation
 */

"use client";

import { useState, type FormEvent } from "react";
import { Clock, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { conflitosAoSalvar, resumoHorarios, type ConflitoHorario, type ItemComHorarios } from "@studyflow/shared";
import { excluirRotina, itensComHorarios, salvarRotina, type AgendaDados, type RotinaFixa, type RotinaFixaForm } from "@/lib/agenda";
import { ConflitosHorarioModal, HorariosSemanaisField } from "@/components/horarios-semanais";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

const vazia: RotinaFixaForm = { nome: "", horarios: [{ dia_semana: 1, inicio: "08:00", fim: "12:00" }], notas: "" };

/** Cartão com a lista de atividades fixas e os modais de criar, editar e excluir. */
export function RotinaFixaCard({ dados, titulo }: { dados: AgendaDados; titulo: string }) {
  const [editando, setEditando] = useState<{ id?: string; form: RotinaFixaForm } | null>(null);
  const [excluindo, setExcluindo] = useState<RotinaFixa | null>(null);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const remover = async () => {
    if (!excluindo) return;
    if (!(await excluirRotina(excluindo.id))) {
      setErroExclusao("Não foi possível excluir. Tente novamente.");
      return;
    }
    setExcluindo(null);
    setErroExclusao(null);
  };

  return (
    <Card aria-labelledby="titulo-rotina-fixa">
      <CardHeader
        action={
          <Button onClick={() => setEditando({ form: vazia })} size="sm" variant="secondary">
            <Plus aria-hidden size={16} />
            Adicionar atividade
          </Button>
        }
        description="Trabalho, academia, curso... Aparecem no calendário toda semana e o cronograma não marca estudo nesses horários."
        icon={<Repeat size={18} />}
        id="titulo-rotina-fixa"
        title={titulo}
      />

      {dados.rotinas.length === 0 ? (
        <EmptyState className="!py-8" description="Cadastre os compromissos que se repetem toda semana." title="Nenhuma atividade fixa" />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dados.rotinas.map((r) => (
            <li className="flex items-start justify-between gap-2 rounded-control border border-line bg-white p-3.5" key={r.id}>
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink-900">{r.nome}</p>
                <p className="tabular mt-1 flex items-start gap-1.5 text-sm text-ink-600">
                  <Clock aria-hidden className="mt-0.5 shrink-0 text-ink-400" size={15} />
                  {resumoHorarios(r.horarios)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button aria-label={`Editar ${r.nome}`} onClick={() => setEditando({ id: r.id, form: { nome: r.nome, horarios: r.horarios, notas: r.notas } })} size="icon-sm" variant="ghost">
                  <Pencil size={16} />
                </Button>
                <Button aria-label={`Excluir ${r.nome}`} onClick={() => setExcluindo(r)} size="icon-sm" variant="danger-ghost">
                  <Trash2 size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editando ? <RotinaFixaEditor inicial={editando} onClose={() => setEditando(null)} outros={itensComHorarios(dados)} /> : null}

      {excluindo ? (
        <Modal
          footer={
            <>
              <Button onClick={() => (setExcluindo(null), setErroExclusao(null))} variant="secondary">
                Cancelar
              </Button>
              <Button onClick={() => void remover()} variant="danger">
                Excluir
              </Button>
            </>
          }
          onClose={() => (setExcluindo(null), setErroExclusao(null))}
          size="sm"
          title="Excluir atividade"
        >
          <div className="grid gap-3 text-sm text-ink-600">
            {erroExclusao ? <Alert tone="danger">{erroExclusao}</Alert> : null}
            <p>Excluir “{excluindo.nome}”? Ela sai do calendário e o horário volta a ficar livre para o cronograma.</p>
          </div>
        </Modal>
      ) : null}
    </Card>
  );
}

function RotinaFixaEditor({ inicial, onClose, outros }: { inicial: { id?: string; form: RotinaFixaForm }; onClose: () => void; outros: ItemComHorarios[] }) {
  const [form, setForm] = useState<RotinaFixaForm>(() => ({ ...inicial.form, horarios: inicial.form.horarios.map((h) => ({ ...h })) }));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [conflitos, setConflitos] = useState<ConflitoHorario[] | null>(null);

  const mudar = (parcial: Partial<RotinaFixaForm>) => {
    setErro(null);
    setForm((f) => ({ ...f, ...parcial }));
  };

  const salvar = async () => {
    setSalvando(true);
    const msg = await salvarRotina(form, inicial.id);
    setSalvando(false);
    setConflitos(null);
    if (msg) setErro(msg);
    else onClose();
  };

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    const achados = conflitosAoSalvar({ id: inicial.id, nome: form.nome, tipo: "rotina", horarios: form.horarios }, outros);
    if (achados.length > 0) {
      setConflitos(achados);
      return;
    }
    await salvar();
  };

  return (
    <>
      <Modal
        footer={
          <>
            <Button onClick={onClose} variant="secondary">
              Cancelar
            </Button>
            <Button disabled={salvando} form="form-rotina-fixa" type="submit">
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </>
        }
        onClose={onClose}
        title={inicial.id ? "Editar atividade" : "Nova atividade da rotina"}
      >
        <form className="grid gap-4" id="form-rotina-fixa" noValidate onSubmit={enviar}>
          {erro ? <Alert tone="danger">{erro}</Alert> : null}
          <Field htmlFor="rotina-fixa-nome" label="Nome da atividade">
            <Input id="rotina-fixa-nome" onChange={(e) => mudar({ nome: e.target.value })} placeholder="Ex.: Trabalho, Academia, Inglês" value={form.nome} />
          </Field>
          <HorariosSemanaisField
            artigo="do"
            horarios={form.horarios}
            novo={{ dia_semana: 1, inicio: "08:00", fim: "12:00" }}
            onChange={(horarios) => mudar({ horarios })}
            rotulo="horário"
            titulo="Dias e horários"
            vazio="Adicione pelo menos um horário."
          />
          <Field htmlFor="rotina-fixa-notas" label="Anotações (opcional)">
            <Textarea className="min-h-16 resize-y" id="rotina-fixa-notas" onChange={(e) => mudar({ notas: e.target.value })} placeholder="Local, observações..." value={form.notas} />
          </Field>
        </form>
      </Modal>
      {conflitos ? (
        <ConflitosHorarioModal conflitos={conflitos} onAjustar={() => setConflitos(null)} onSalvarMesmoAssim={() => void salvar()} salvando={salvando} />
      ) : null}
    </>
  );
}

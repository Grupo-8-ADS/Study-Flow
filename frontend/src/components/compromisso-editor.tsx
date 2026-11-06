"use client";

import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import {
  TIPOS_COMPROMISSO,
  compromissoVazio,
  excluirCompromisso,
  salvarCompromisso,
  type Compromisso,
  type CompromissoForm,
  type Disciplina,
} from "@/lib/agenda";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

type Props = {
  disciplinas: Disciplina[];
  /** Compromisso existente (edição) ou valores iniciais de um novo. */
  inicial?: Compromisso | Partial<CompromissoForm>;
  onClose: () => void;
  onSaved?: () => void;
};

/**
 * Formulário único de compromisso (prova, trabalho, atividade ou estudo),
 * usado no Calendário, na lista de Compromissos e no Início.
 */
export function CompromissoEditor({ disciplinas, inicial, onClose, onSaved }: Props) {
  const existente = inicial && "id" in inicial && inicial.id ? (inicial as Compromisso) : null;
  const [form, setForm] = useState<CompromissoForm>(() => ({ ...compromissoVazio(), ...(inicial ?? {}) }));
  const [comHorario, setComHorario] = useState(Boolean(form.horaInicio));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const mudar = (parcial: Partial<CompromissoForm>) => {
    setErro(null);
    setForm((f) => ({ ...f, ...parcial }));
  };

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    setSalvando(true);
    const final = comHorario ? form : { ...form, horaInicio: "", horaFim: "" };
    if (comHorario && !final.horaInicio) {
      setErro("Informe o horário de início ou desmarque “Definir horário”.");
      setSalvando(false);
      return;
    }
    const msg = await salvarCompromisso(final, existente?.id);
    setSalvando(false);
    if (msg) {
      setErro(msg);
      return;
    }
    onSaved?.();
    onClose();
  };

  const excluir = async () => {
    if (!existente) return;
    setSalvando(true);
    const ok = await excluirCompromisso(existente.id);
    setSalvando(false);
    if (!ok) {
      setErro("Não foi possível excluir. Tente novamente.");
      return;
    }
    onSaved?.();
    onClose();
  };

  return (
    <Modal
      footer={
        confirmarExclusao ? (
          <>
            <span className="mr-auto self-center text-sm text-ink-600">Excluir este compromisso?</span>
            <Button onClick={() => setConfirmarExclusao(false)} variant="secondary">
              Não
            </Button>
            <Button disabled={salvando} onClick={() => void excluir()} variant="danger">
              Excluir
            </Button>
          </>
        ) : (
          <>
            {existente ? (
              <Button className="mr-auto" onClick={() => setConfirmarExclusao(true)} variant="danger-ghost">
                <Trash2 aria-hidden size={16} />
                Excluir
              </Button>
            ) : null}
            <Button onClick={onClose} variant="secondary">
              Cancelar
            </Button>
            <Button disabled={salvando} form="form-compromisso" type="submit">
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </>
        )
      }
      onClose={onClose}
      title={existente ? "Editar compromisso" : "Novo compromisso"}
    >
      <form className="grid gap-4" id="form-compromisso" noValidate onSubmit={enviar}>
        {erro ? <Alert tone="danger">{erro}</Alert> : null}

        <Field htmlFor="compromisso-titulo" label="Nome">
          <Input
            id="compromisso-titulo"
            onChange={(e) => mudar({ titulo: e.target.value })}
            placeholder={form.tipo === "prova" ? "Ex.: P1 de Cálculo" : form.tipo === "trabalho" ? "Ex.: Relatório do projeto" : "Ex.: Grupo de estudos"}
            value={form.titulo}
          />
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-700">Tipo</legend>
          <div className="flex flex-wrap gap-2">
            {TIPOS_COMPROMISSO.map((t) => (
              <label
                className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500 ${
                  form.tipo === t.value ? "bg-primary-700 text-white ring-primary-700" : "bg-white text-ink-700 ring-line hover:bg-ink-50"
                }`}
                key={t.value}
              >
                <input
                  checked={form.tipo === t.value}
                  className="sr-only"
                  name="compromisso-tipo"
                  onChange={() => mudar({ tipo: t.value })}
                  type="radio"
                  value={t.value}
                />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field htmlFor="compromisso-data" label="Data">
            <Input id="compromisso-data" onChange={(e) => mudar({ data: e.target.value })} type="date" value={form.data} />
          </Field>
          <Field htmlFor="compromisso-disciplina" label="Disciplina">
            <Select id="compromisso-disciplina" onChange={(e) => mudar({ disciplinaId: e.target.value || null })} value={form.disciplinaId ?? ""}>
              <option value="">Nenhuma</option>
              {disciplinas.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <label className="flex w-fit cursor-pointer select-none items-center gap-2 text-sm text-ink-700">
            <input
              checked={comHorario}
              className="h-4 w-4 cursor-pointer rounded accent-primary-700"
              onChange={(e) => {
                setErro(null);
                setComHorario(e.target.checked);
              }}
              type="checkbox"
            />
            Definir horário
          </label>
          {comHorario ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field htmlFor="compromisso-inicio" label="Início">
                <Input id="compromisso-inicio" onChange={(e) => mudar({ horaInicio: e.target.value })} type="time" value={form.horaInicio} />
              </Field>
              <Field htmlFor="compromisso-fim" label="Término (opcional)">
                <Input id="compromisso-fim" onChange={(e) => mudar({ horaFim: e.target.value })} type="time" value={form.horaFim} />
              </Field>
            </div>
          ) : (
            <p className="mt-1 text-xs text-ink-500">Sem horário, vale para o dia inteiro.</p>
          )}
        </div>

        <Field htmlFor="compromisso-notas" label="Anotações">
          <Textarea className="min-h-20 resize-y" id="compromisso-notas" onChange={(e) => mudar({ notas: e.target.value })} value={form.notas} />
        </Field>
      </form>
    </Modal>
  );
}

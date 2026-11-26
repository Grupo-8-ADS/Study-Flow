/**
 * Peças de formulário para horários que se repetem toda semana (aulas das disciplinas e
 * atividades fixas da rotina) e o aviso de conflito de horário antes de salvar.
 * @packageDocumentation
 */

"use client";

import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { AVISO_CONFLITO, NOMES_DIAS_SEMANA, descreverConflito, type ConflitoHorario, type HorarioSemanal } from "@studyflow/shared";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";

/** Lista editável de horários semanais (dia, início e fim). */
export function HorariosSemanaisField({
  titulo,
  rotulo,
  artigo,
  horarios,
  onChange,
  novo,
  vazio,
}: {
  titulo: string;
  /** Nome de um item, usado nos rótulos acessíveis ("aula", "horário"). */
  rotulo: string;
  /** "da" (aula) ou "do" (horário), para os rótulos acessíveis. */
  artigo: "da" | "do";
  horarios: HorarioSemanal[];
  onChange: (horarios: HorarioSemanal[]) => void;
  /** Horário sugerido ao clicar em adicionar. */
  novo: HorarioSemanal;
  vazio: string;
}) {
  const mudar = (i: number, parcial: Partial<HorarioSemanal>) => onChange(horarios.map((h, j) => (j === i ? { ...h, ...parcial } : h)));

  return (
    <fieldset className="rounded-card border border-line bg-ink-50/60 p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <legend className="text-sm font-semibold text-ink-800">{titulo}</legend>
        <Button onClick={() => onChange([...horarios, { ...novo }])} size="sm" variant="secondary">
          <Plus aria-hidden size={14} />
          Adicionar {rotulo}
        </Button>
      </div>
      {horarios.length === 0 ? (
        <p className="text-sm text-ink-500">{vazio}</p>
      ) : (
        <ul className="grid gap-2">
          {horarios.map((h, i) => (
            <li className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2" key={i}>
              <Select aria-label={`Dia ${artigo} ${rotulo} ${i + 1}`} onChange={(e) => mudar(i, { dia_semana: Number(e.target.value) })} value={h.dia_semana}>
                {NOMES_DIAS_SEMANA.map((nome, d) => (
                  <option key={nome} value={d}>
                    {nome}
                  </option>
                ))}
              </Select>
              <Input aria-label={`Início ${artigo} ${rotulo} ${i + 1}`} className="!w-28" onChange={(e) => mudar(i, { inicio: e.target.value })} type="time" value={h.inicio} />
              <Input aria-label={`Fim ${artigo} ${rotulo} ${i + 1}`} className="!w-28" onChange={(e) => mudar(i, { fim: e.target.value })} type="time" value={h.fim} />
              <Button aria-label={`Remover ${rotulo} ${i + 1}`} onClick={() => onChange(horarios.filter((_, j) => j !== i))} size="icon-sm" variant="danger-ghost">
                <Trash2 size={16} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

/**
 * Aviso de conflito de horário: o usuário escolhe voltar e ajustar ou salvar assim mesmo
 * (ex.: aula quinzenal, ou uma disciplina que ele vai cursar em horário alternado).
 */
export function ConflitosHorarioModal({
  conflitos,
  salvando,
  onAjustar,
  onSalvarMesmoAssim,
}: {
  conflitos: ConflitoHorario[];
  salvando: boolean;
  onAjustar: () => void;
  onSalvarMesmoAssim: () => void;
}) {
  return (
    <Modal
      footer={
        <>
          <Button onClick={onAjustar} variant="secondary">
            {AVISO_CONFLITO.ajustar}
          </Button>
          <Button disabled={salvando} onClick={onSalvarMesmoAssim}>
            {salvando ? "Salvando..." : AVISO_CONFLITO.salvarMesmoAssim}
          </Button>
        </>
      }
      onClose={onAjustar}
      size="sm"
      title={AVISO_CONFLITO.titulo}
    >
      <div className="grid gap-3 text-sm text-ink-600">
        <p className="flex items-start gap-2">
          <AlertTriangle aria-hidden className="mt-0.5 shrink-0 text-gold" size={18} />
          {AVISO_CONFLITO.introducao(conflitos.length)}
        </p>
        <ul className="grid gap-1.5 rounded-control border border-line bg-ink-50/60 p-3" data-testid="lista-conflitos">
          {conflitos.map((c, i) => (
            <li key={i}>{descreverConflito(c)}</li>
          ))}
        </ul>
        <p>{AVISO_CONFLITO.explicacao}</p>
      </div>
    </Modal>
  );
}

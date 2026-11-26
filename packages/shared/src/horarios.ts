/**
 * Horários semanais recorrentes (aulas das disciplinas e atividades fixas da rotina):
 * validação e detecção de conflitos. Funções puras, usadas no web e no mobile.
 * @packageDocumentation
 */

import { NOMES_DIAS_SEMANA } from './scheduler';

/** Um horário que se repete toda semana. */
export type HorarioSemanal = {
  /** 0 = domingo ... 6 = sábado */
  dia_semana: number;
  /** "HH:MM" */
  inicio: string;
  /** "HH:MM" */
  fim: string;
};

/** Algo com horários semanais: uma disciplina (aulas) ou uma atividade da rotina. */
export type ItemComHorarios = {
  id?: string;
  nome: string;
  tipo: 'disciplina' | 'rotina';
  horarios: HorarioSemanal[];
};

export type ConflitoHorario = {
  /** Horário do item que está sendo salvo. */
  horario: HorarioSemanal;
  /** Com quem bate (nome do outro item, ou o próprio item quando dois horários dele se sobrepõem). */
  com: Pick<ItemComHorarios, 'nome' | 'tipo'> & { id?: string };
  /** Horário do outro item que bate. */
  horarioCom: HorarioSemanal;
  /** true quando os dois horários são do próprio item. */
  proprio: boolean;
};

const DIAS: readonly string[] = NOMES_DIAS_SEMANA;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Dois horários semanais se sobrepõem (encostar, ex.: 19:00–20:00 e 20:00–21:00, não conta). */
export function horariosSeSobrepoem(a: HorarioSemanal, b: HorarioSemanal): boolean {
  return a.dia_semana === b.dia_semana && a.inicio < b.fim && b.inicio < a.fim;
}

/**
 * Valida os horários de um item. Devolve a primeira mensagem de erro ou null.
 * `rotulo` aparece na mensagem ("aula", "horário").
 */
export function validarHorarios(horarios: HorarioSemanal[], rotulo = 'horário'): string | null {
  for (const h of horarios) {
    if (!Number.isInteger(h.dia_semana) || h.dia_semana < 0 || h.dia_semana > 6) return 'Escolha um dia da semana válido.';
    if (!h.inicio || !h.fim) return `Preencha o início e o fim de cada ${rotulo}.`;
    if (!HHMM.test(h.inicio) || !HHMM.test(h.fim)) return 'Use horários no formato HH:MM.';
    if (h.fim <= h.inicio) return `Em cada ${rotulo}, o fim deve ser depois do início.`;
  }
  return null;
}

/**
 * Conflitos entre os horários de `alvo` e os de `outros` (o próprio alvo, pelo id, é ignorado
 * na lista de outros). Também acusa dois horários do próprio alvo que se sobrepõem.
 */
export function conflitosDeHorario(alvo: ItemComHorarios, outros: ItemComHorarios[]): ConflitoHorario[] {
  const conflitos: ConflitoHorario[] = [];

  alvo.horarios.forEach((h, i) => {
    alvo.horarios.slice(i + 1).forEach((outro) => {
      if (horariosSeSobrepoem(h, outro)) conflitos.push({ horario: h, com: { id: alvo.id, nome: alvo.nome, tipo: alvo.tipo }, horarioCom: outro, proprio: true });
    });
  });

  outros
    .filter((o) => !(alvo.id && o.id === alvo.id && o.tipo === alvo.tipo))
    .forEach((o) =>
      o.horarios.forEach((ho) =>
        alvo.horarios.forEach((h) => {
          if (horariosSeSobrepoem(h, ho)) conflitos.push({ horario: h, com: { id: o.id, nome: o.nome, tipo: o.tipo }, horarioCom: ho, proprio: false });
        }),
      ),
    );

  return conflitos;
}

/** Texto curto de um conflito, ex.: "Segunda-feira 19:00–20:40 bate com a aula de Cálculo I (19:30–21:00)". */
export function descreverConflito(c: ConflitoHorario): string {
  const dia = DIAS[c.horario.dia_semana] ?? 'Dia';
  const quem = c.proprio
      ? 'outro horário deste mesmo cadastro'
      : c.com.tipo === 'disciplina'
        ? `a aula de ${c.com.nome}`
        : `${c.com.nome} (rotina)`;
  return `${dia} ${c.horario.inicio}–${c.horario.fim} bate com ${quem} (${c.horarioCom.inicio}–${c.horarioCom.fim})`;
}

/** Resumo em uma linha, ex.: "Seg 19:00–20:40 · Qua 19:00–20:40". */
export function resumoHorarios(horarios: HorarioSemanal[], vazio = 'Sem horário'): string {
  if (horarios.length === 0) return vazio;
  return [...horarios]
    .sort((a, b) => a.dia_semana - b.dia_semana || a.inicio.localeCompare(b.inicio))
    .map((h) => `${DIAS[h.dia_semana]?.slice(0, 3) ?? '?'} ${h.inicio}–${h.fim}`)
    .join(' · ');
}

/**
 * Conflitos a mostrar antes de salvar um cadastro (disciplina ou rotina). Se o formulário
 * ainda tem erro de preenchimento (sem nome, horário inválido), devolve [] para o salvar
 * exibir o erro em vez do aviso de conflito.
 */
export function conflitosAoSalvar(alvo: ItemComHorarios, outros: ItemComHorarios[], rotulo = 'horário'): ConflitoHorario[] {
  if (!alvo.nome.trim() || alvo.horarios.length === 0 || validarHorarios(alvo.horarios, rotulo)) return [];
  return conflitosDeHorario({ ...alvo, nome: alvo.nome.trim() }, outros);
}

/** Textos do aviso de conflito, iguais no site e no app. */
export const AVISO_CONFLITO = {
  titulo: 'Conflito de horário',
  introducao: (quantidade: number) =>
    quantidade === 1 ? 'Este horário bate com outro compromisso fixo:' : `${quantidade} horários batem com outros compromissos fixos:`,
  explicacao: 'Você pode voltar e mudar o horário, ou salvar assim mesmo — os dois vão aparecer no calendário no mesmo horário.',
  ajustar: 'Voltar e ajustar',
  salvarMesmoAssim: 'Salvar mesmo assim',
} as const;

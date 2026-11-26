/**
 * Geração do cronograma a partir da tela de Rotina (web e mobile): valida o que o usuário
 * digitou, junta o que já ocupa o tempo na agenda e chama `gerarCronograma`.
 * Função pura: as telas só mostram o resultado.
 * @packageDocumentation
 */

import { dataStr, hojeStr, ocupadosNoPeriodo, proximasEntregas, proximasProvas, type AgendaDados } from './agenda';
import { CronogramaError, gerarCronograma, type BlocoEstudo, type RotinaSlot } from './scheduler';

/** Limite diário sugerido quando o perfil não tem meta de horas por dia. */
export const LIMITE_DIARIO_PADRAO_H = 4;

/** Duração permitida para cada bloco de estudo, em minutos. */
export const DURACAO_BLOCO_MIN = { minimo: 10, maximo: 240, padrao: 50 } as const;

/** Limite diário inicial da tela: a meta `horas_diarias` do perfil, ou 4 h se não houver. */
export function limiteDiarioInicial(horasDiarias: unknown): number {
  const meta = Number(horasDiarias);
  return Number.isFinite(meta) && meta > 0 ? meta : LIMITE_DIARIO_PADRAO_H;
}

/**
 * Texto do campo "Máximo por dia (h)" → minutos. Vazio = sem limite (`undefined`).
 * Aceita vírgula decimal ("1,5").
 */
export function lerLimiteDiario(texto: string): { minutos: number | undefined } | { erro: string } {
  const limpo = texto.trim();
  if (limpo === '') return { minutos: undefined };
  const horas = Number(limpo.replace(',', '.'));
  if (!Number.isFinite(horas) || horas <= 0 || horas > 24) {
    return { erro: 'Informe um máximo de horas por dia entre 0,5 e 24, ou deixe em branco para não limitar.' };
  }
  return { minutos: Math.round(horas * 60) };
}

export interface PlanejarCronogramaParams {
  agenda: AgendaDados;
  /** Horários livres para estudar. */
  rotina: RotinaSlot[];
  semanas: number;
  /** Texto do campo de duração do bloco, em minutos. */
  duracaoBloco: string;
  /** Texto do campo de limite diário, em horas ("" = sem limite). */
  limiteHoras: string;
  /** Substituir os blocos já gerados (senão eles contam como ocupados). */
  substituir: boolean;
  agora?: Date;
}

export type ResultadoCronograma =
  | { ok: true; blocos: BlocoEstudo[]; duracaoMin: number; descartados: number }
  | { ok: false; mensagem: string; semDisciplinas?: boolean };

/** Monta a prévia do cronograma ou devolve a mensagem de erro para a tela. */
export function planejarCronograma(p: PlanejarCronogramaParams): ResultadoCronograma {
  const { agenda } = p;
  if (agenda.disciplinas.length === 0) {
    return { ok: false, mensagem: 'Cadastre ao menos uma disciplina antes de gerar o cronograma.', semDisciplinas: true };
  }
  if (p.rotina.length === 0) return { ok: false, mensagem: 'Cadastre sua rotina semanal antes de gerar o cronograma.' };

  const duracaoMin = Number(p.duracaoBloco);
  if (!Number.isInteger(duracaoMin) || duracaoMin < DURACAO_BLOCO_MIN.minimo || duracaoMin > DURACAO_BLOCO_MIN.maximo) {
    return { ok: false, mensagem: `Informe uma duração de bloco entre ${DURACAO_BLOCO_MIN.minimo} e ${DURACAO_BLOCO_MIN.maximo} minutos.` };
  }

  const limite = lerLimiteDiario(p.limiteHoras);
  if ('erro' in limite) return { ok: false, mensagem: limite.erro };

  const agora = p.agora ?? new Date();
  const hoje = p.agora ? dataStr(agora) : hojeStr();
  const fimPeriodo = dataStr(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + p.semanas * 7 - 1));
  const provas = proximasProvas(agenda.compromissos);
  const entregas = proximasEntregas(agenda.compromissos);
  // O que já ocupa o tempo: aulas, atividades da rotina, compromissos com horário e
  // (se não for substituir) blocos já salvos.
  const ocupados = ocupadosNoPeriodo(agenda, hoje, fimPeriodo, p.substituir);

  const params = {
    disciplinas: agenda.disciplinas.map((d) => ({
      id: d.id,
      nome: d.nome,
      peso: d.prioridade,
      proximaProva: provas.get(d.id) ?? null,
      proximaEntrega: entregas.get(d.id) ?? null,
    })),
    rotina: p.rotina,
    dataInicio: agora,
    semanas: p.semanas,
    duracaoBlocoMin: duracaoMin,
    limiteDiarioMin: limite.minutos,
  };

  try {
    // Quantos horários seriam usados sem os compromissos, para avisar quantos foram pulados.
    let todos = 0;
    try {
      todos = gerarCronograma(params).length;
    } catch {
      todos = 0;
    }
    const blocos = gerarCronograma({ ...params, ocupados, naoAntesDe: agora });
    return { ok: true, blocos, duracaoMin, descartados: Math.max(0, todos - blocos.length) };
  } catch (e) {
    return { ok: false, mensagem: e instanceof CronogramaError ? e.message : 'Não foi possível gerar o cronograma.' };
  }
}

/** Quantos blocos cada disciplina recebeu, na ordem em que aparecem. */
export function resumoCronograma(blocos: BlocoEstudo[]): Array<[string, number]> {
  return Array.from(blocos.reduce((mapa, b) => mapa.set(b.disciplina_nome, (mapa.get(b.disciplina_nome) ?? 0) + 1), new Map<string, number>()));
}

/** Explicação de "Como o cronograma é montado" (mesmas regras de `gerarCronograma`). */
export const COMO_O_CRONOGRAMA_E_MONTADO: readonly string[] = [
  'Cada horário livre é dividido em blocos do tamanho escolhido, com 10 min de pausa entre eles.',
  'Horários que batem com aulas, atividades da rotina, compromissos com horário ou que já passaram são pulados.',
  'Cada dia recebe no máximo as horas de estudo escolhidas (começa pela sua meta diária do perfil); o resto do estudo vai para os dias seguintes.',
  'As disciplinas se revezam de forma proporcional à prioridade (alta = 3×, média = 2×, baixa = 1×); a mesma só se repete em sequência quando a proporção pede.',
  'Disciplinas com prova dentro do período ganham o dobro de peso até o dia da prova, e as com entrega de trabalho ganham 1,5× até a entrega.',
  'Não há sorteio: as mesmas entradas geram sempre o mesmo cronograma.',
];

/** Aviso da prévia sobre os horários pulados ("" quando nenhum foi). */
export function textoDescartados(descartados: number): string {
  if (descartados <= 0) return '';
  return `${descartados} ${descartados === 1 ? 'horário foi pulado' : 'horários foram pulados'} por já ter passado ou bater com aula, rotina ou outro compromisso.`;
}

/** Rótulo de uma disciplina no resumo da prévia, ex.: "Cálculo: 3 blocos · 2,5 h". */
export function rotuloResumoCronograma(nome: string, blocos: number, duracaoMin: number): string {
  const horas = ((blocos * duracaoMin) / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${nome}: ${blocos} ${blocos === 1 ? 'bloco' : 'blocos'} · ${horas} h`;
}

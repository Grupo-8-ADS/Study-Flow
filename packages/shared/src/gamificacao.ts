/**
 * Regras de gamificação exibidas no app (RF004 / RF007).
 * O banco é quem credita XP e concede conquistas (trigger on_sessao_concluida);
 * aqui ficam só os cálculos de apresentação, com a MESMA regra de nível do banco.
 */

export const XP_POR_NIVEL = 100;

/** Nível a partir do XP: 100 XP por nível, começando no 1 (igual a public.nivel_por_xp). */
export function nivelPorXp(xp: number): number {
  const seguro = Number.isFinite(xp) ? Math.max(Math.floor(xp), 0) : 0;
  return Math.floor(seguro / XP_POR_NIVEL) + 1;
}

export interface ProgressoNivel {
  nivel: number;
  /** XP acumulado dentro do nível atual (0 a 99). */
  xpNoNivel: number;
  /** XP que falta para o próximo nível. */
  faltam: number;
  /** Fração de 0 a 1 do nível atual. */
  progresso: number;
}

export function progressoNivel(xp: number): ProgressoNivel {
  const seguro = Number.isFinite(xp) ? Math.max(Math.floor(xp), 0) : 0;
  const xpNoNivel = seguro % XP_POR_NIVEL;
  return {
    nivel: nivelPorXp(seguro),
    xpNoNivel,
    faltam: XP_POR_NIVEL - xpNoNivel,
    progresso: xpNoNivel / XP_POR_NIVEL,
  };
}

/** Critério de conquista como gravado em conquistas.criterio (jsonb). */
export interface CriterioConquista {
  type?: string;
  target?: number;
  subject?: string;
}

/** Números do usuário usados para avaliar os critérios. */
export interface EstatisticasConquista {
  sessoesConcluidas: number;
  minutosEstudados: number;
  /** Sessões concluídas por nome de disciplina. */
  sessoesPorDisciplina: Record<string, number>;
}

export interface ProgressoConquista {
  atual: number;
  alvo: number;
  /** Inteiro de 0 a 100. */
  percentual: number;
  concluida: boolean;
}

/** Progresso de uma conquista ainda bloqueada (mesmos critérios do trigger do banco). */
export function progressoConquista(
  criterio: CriterioConquista | null | undefined,
  stats: EstatisticasConquista,
): ProgressoConquista {
  const alvo = Math.max(Math.floor(Number(criterio?.target ?? 1)) || 1, 1);
  let atual = 0;

  switch (criterio?.type) {
    case 'sessions_completed':
      atual = stats.sessoesConcluidas;
      break;
    case 'study_minutes':
      atual = stats.minutosEstudados;
      break;
    case 'subject_progress': {
      const alvoDisciplina = (criterio.subject ?? '').trim().toLowerCase();
      atual = Object.entries(stats.sessoesPorDisciplina)
        .filter(([nome]) => nome.trim().toLowerCase() === alvoDisciplina)
        .reduce((soma, [, qtd]) => soma + qtd, 0);
      break;
    }
    default:
      atual = 0;
  }

  atual = Math.max(atual, 0);
  return {
    atual,
    alvo,
    percentual: Math.min(Math.floor((atual / alvo) * 100), 100),
    concluida: atual >= alvo,
  };
}

export interface DadosCompartilhamento {
  nivel: number;
  /** Rótulo do período, ex.: "Semana", "Mês", "Acumulado". */
  periodo: string;
  horas: number;
  /** Disciplina mais estudada no período (ou null se não houver dados). */
  topico: string | null;
}

/** Texto do RF007 (compartilhar progresso), com dados reais do usuário. */
export function textoCompartilhamento(dados: DadosCompartilhamento): string {
  const horas = Math.max(dados.horas, 0);
  const horasTexto = Number.isInteger(horas) ? `${horas}` : horas.toFixed(1).replace('.', ',');
  const periodo = dados.periodo.trim().toLowerCase();
  const base = `Estou no nível ${dados.nivel} no Study Flow e estudei ${horasTexto} h (${periodo}).`;
  return dados.topico ? `${base} Minha disciplina mais estudada foi ${dados.topico}.` : base;
}

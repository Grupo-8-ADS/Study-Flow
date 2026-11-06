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
  /** Dias seguidos com estudo, terminando no dia mais recente com estudo. */
  diasSeguidos?: number;
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
    case 'unique_subjects':
      atual = Object.values(stats.sessoesPorDisciplina).filter((n) => n > 0).length;
      break;
    case 'streak':
      atual = stats.diasSeguidos ?? 0;
      break;
    case 'top_subject_sessions':
      atual = disciplinaMaisEstudada(stats)?.sessoes ?? 0;
      break;
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

/** Disciplina com mais sessões concluídas (empate: a primeira na ordem recebida). */
export function disciplinaMaisEstudada(stats: EstatisticasConquista): { nome: string; sessoes: number } | null {
  let melhor: { nome: string; sessoes: number } | null = null;
  for (const [nome, sessoes] of Object.entries(stats.sessoesPorDisciplina)) {
    if (sessoes > 0 && (!melhor || sessoes > melhor.sessoes)) melhor = { nome, sessoes };
  }
  return melhor;
}

/**
 * Nome exibido da conquista. Nomes com "{disciplina}" usam a disciplina gravada no
 * desbloqueio (`detalhe`) ou, se ainda bloqueada, a mais estudada no momento.
 */
export function nomeConquista(nome: string, detalhe: string | null | undefined, stats?: EstatisticasConquista): string {
  if (!nome.includes('{disciplina}')) return nome;
  const disciplina = detalhe || (stats ? disciplinaMaisEstudada(stats)?.nome : null) || 'sua disciplina';
  return nome.replace('{disciplina}', disciplina);
}

/** Dias seguidos com estudo (datas AAAA-MM-DD em qualquer ordem), terminando no dia mais recente. */
export function diasSeguidos(datas: string[]): number {
  const dias = Array.from(new Set(datas.filter(Boolean))).sort();
  if (dias.length === 0) return 0;
  let contagem = 1;
  for (let i = dias.length - 1; i > 0; i--) {
    const [a, b] = [new Date(`${dias[i - 1]}T12:00:00`), new Date(`${dias[i]}T12:00:00`)];
    if (Math.round((b.getTime() - a.getTime()) / 86_400_000) !== 1) break;
    contagem++;
  }
  return contagem;
}

/** Nível visual da conquista (bronze, prata, ouro). */
export const ROTULO_TIER: Record<number, string> = { 1: 'Bronze', 2: 'Prata', 3: 'Ouro' };

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

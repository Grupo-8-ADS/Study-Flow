/**
 * Regras de gamificação exibidas no app (RF004 / RF007).
 * O banco é quem credita XP e concede conquistas (trigger on_sessao_concluida);
 * aqui ficam só os cálculos de apresentação, com a MESMA regra de nível do banco.
 */

/**
 * Curva de nível progressiva: subir do nível n para o n+1 custa XP_BASE_NIVEL × n XP
 * (100, 200, 300...). Com 1 XP por minuto de foco, o nível 2 vem com ~1h40 de estudo, o 5
 * com ~17 h e o 10 com ~75 h. Precisa bater com public.nivel_por_xp (migration
 * 20261125000200_curva_nivel_e_recompensas).
 */
export const XP_BASE_NIVEL = 100;

/** Limite de XP por sessão: o banco credita no máximo 240 min (trigger preparar_sessao_estudo). */
export const XP_MAXIMO_POR_SESSAO = 240;

/** XP que uma sessão de foco de `minutos` rende (1 por minuto, com o teto do banco). */
export const xpDaSessao = (minutos: number) => Math.min(Math.max(Math.round(Number(minutos) || 0), 0), XP_MAXIMO_POR_SESSAO);

/** XP total necessário para chegar ao nível (nível 1 = 0 XP). */
export function xpParaNivel(nivel: number): number {
  const n = Math.max(Math.floor(nivel), 1);
  return (XP_BASE_NIVEL * n * (n - 1)) / 2;
}

const xpSeguro = (xp: number) => (Number.isFinite(xp) ? Math.max(Math.floor(xp), 0) : 0);

/** Nível a partir do XP, começando no 1 (igual a public.nivel_por_xp). */
export function nivelPorXp(xp: number): number {
  const seguro = xpSeguro(xp);
  // Inverso de xpParaNivel: n = floor((1 + sqrt(1 + 8·xp/100)) / 2), com ajuste de arredondamento.
  let nivel = Math.max(Math.floor((1 + Math.sqrt(1 + (8 * seguro) / XP_BASE_NIVEL)) / 2), 1);
  while (xpParaNivel(nivel + 1) <= seguro) nivel++;
  while (nivel > 1 && xpParaNivel(nivel) > seguro) nivel--;
  return nivel;
}

export interface ProgressoNivel {
  nivel: number;
  /** XP acumulado dentro do nível atual. */
  xpNoNivel: number;
  /** XP total do nível atual (do início dele ao próximo). */
  xpDoNivel: number;
  /** XP que falta para o próximo nível. */
  faltam: number;
  /** Fração de 0 a 1 do nível atual. */
  progresso: number;
}

export function progressoNivel(xp: number): ProgressoNivel {
  const seguro = xpSeguro(xp);
  const nivel = nivelPorXp(seguro);
  const xpNoNivel = seguro - xpParaNivel(nivel);
  const xpDoNivel = xpParaNivel(nivel + 1) - xpParaNivel(nivel);
  return {
    nivel,
    xpNoNivel,
    xpDoNivel,
    faltam: xpDoNivel - xpNoNivel,
    progresso: xpNoNivel / xpDoNivel,
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

/**
 * Sequência atual: dias seguidos com estudo terminando hoje (no fuso local do aparelho).
 * Recebe os instantes ISO de início das sessões. Sem estudo hoje, a sequência é 0.
 */
export function sequenciaAtual(instantes: string[], hoje: Date = new Date()): number {
  const dia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dias = new Set(
    instantes
      .filter(Boolean)
      .map((i) => new Date(i))
      .filter((d) => !Number.isNaN(d.getTime()))
      .map(dia),
  );
  let contagem = 0;
  const cursor = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12);
  while (dias.has(dia(cursor))) {
    contagem++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return contagem;
}

/**
 * Maior sequência de dias seguidos já feita (mesma regra do banco em avaliar_conquistas):
 * é o que libera as conquistas de sequência, mesmo que a sequência já tenha sido quebrada.
 */
export function maiorSequencia(datas: string[]): number {
  const dias = Array.from(new Set(datas.filter(Boolean))).sort();
  let maior = 0;
  let atual = 0;
  for (let i = 0; i < dias.length; i++) {
    const seguido =
      i > 0 && Math.round((new Date(`${dias[i]}T12:00:00`).getTime() - new Date(`${dias[i - 1]}T12:00:00`).getTime()) / 86_400_000) === 1;
    atual = seguido ? atual + 1 : 1;
    maior = Math.max(maior, atual);
  }
  return maior;
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
  /** Privacidade: sem as horas, o texto fala só do nível e da disciplina. */
  ocultarHoras?: boolean;
  /** Link do app, acrescentado no fim (ex.: o endereço do site). */
  link?: string;
}

/** Texto do RF007 (compartilhar progresso), com dados reais do usuário. */
export function textoCompartilhamento(dados: DadosCompartilhamento): string {
  const horas = Math.max(dados.horas, 0);
  const horasTexto = Number.isInteger(horas) ? `${horas}` : horas.toFixed(1).replace('.', ',');
  const periodo = dados.periodo.trim().toLowerCase();
  const base = dados.ocultarHoras
    ? `Estou no nível ${dados.nivel} no Study Flow.`
    : `Estou no nível ${dados.nivel} no Study Flow e estudei ${horasTexto} h (${periodo}).`;
  const texto = dados.topico ? `${base} Minha disciplina mais estudada foi ${dados.topico}.` : base;
  return dados.link ? `${texto} ${dados.link}` : texto;
}

/**
 * Relatórios periódicos de tempo de estudo (RF011).
 * Funções puras: recebem as sessões e o intervalo, devolvem os números e o CSV.
 */

export interface SessaoRelatorio {
  /** ISO da data/hora de início. */
  data_inicio: string;
  duracao_efetiva_min: number | null;
  disciplina_nome?: string | null;
  status?: string | null;
}

export type PeriodoRelatorio = 'semana' | 'mes';

export interface Intervalo {
  /** Início, inclusivo (00:00 local). */
  inicio: Date;
  /** Fim, exclusivo (00:00 local do dia seguinte ao último). */
  fim: Date;
}

const DIA_MS = 24 * 60 * 60 * 1000;

const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dois = (n: number) => String(n).padStart(2, '0');
/** AAAA-MM-DD no fuso local. */
export const dataLocalISO = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;

/** Semana de segunda a domingo, ou mês civil, que contém `referencia`. */
export function intervaloDoPeriodo(periodo: PeriodoRelatorio, referencia: Date): Intervalo {
  const hoje = inicioDoDia(referencia);
  if (periodo === 'mes') {
    return {
      inicio: new Date(hoje.getFullYear(), hoje.getMonth(), 1),
      fim: new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1),
    };
  }
  const diasDesdeSegunda = (hoje.getDay() + 6) % 7;
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - diasDesdeSegunda);
  return { inicio, fim: new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 7) };
}

/** Intervalo a partir de datas AAAA-MM-DD escolhidas pelo usuário (ambas inclusivas). */
export function intervaloPersonalizado(inicioISO: string, fimISO: string): Intervalo {
  const parse = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) throw new Error(`Data inválida: "${iso}" (use AAAA-MM-DD)`);
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (d.getMonth() !== Number(m[2]) - 1) throw new Error(`Data inválida: "${iso}"`);
    return d;
  };
  const inicio = parse(inicioISO);
  const ultimo = parse(fimISO);
  if (ultimo < inicio) throw new Error('A data final deve ser igual ou posterior à inicial');
  return { inicio, fim: new Date(ultimo.getFullYear(), ultimo.getMonth(), ultimo.getDate() + 1) };
}

export interface LinhaDisciplina {
  disciplina: string;
  minutos: number;
  sessoes: number;
  /** Inteiro de 0 a 100 do total de minutos. */
  percentual: number;
}

export interface RelatorioPeriodo {
  inicio: string;
  fim: string;
  totalMinutos: number;
  totalSessoes: number;
  diasEstudados: number;
  /** Média de minutos por dia do intervalo (inclusive dias sem estudo). */
  mediaMinutosPorDia: number;
  porDisciplina: LinhaDisciplina[];
  /** Um registro por dia do intervalo, em ordem. */
  porDia: Array<{ data: string; minutos: number }>;
}

const SEM_DISCIPLINA = 'Geral';

/** Consolida as sessões concluídas dentro do intervalo. */
export function gerarRelatorioPeriodo(sessoes: SessaoRelatorio[], intervalo: Intervalo): RelatorioPeriodo {
  const dias = Math.max(Math.round((intervalo.fim.getTime() - intervalo.inicio.getTime()) / DIA_MS), 1);
  const porDia = new Map<string, number>();
  for (let i = 0; i < dias; i++) {
    const d = new Date(intervalo.inicio.getFullYear(), intervalo.inicio.getMonth(), intervalo.inicio.getDate() + i);
    porDia.set(dataLocalISO(d), 0);
  }

  const porDisciplina = new Map<string, { minutos: number; sessoes: number }>();
  let totalMinutos = 0;
  let totalSessoes = 0;

  for (const s of sessoes) {
    if (s.status && s.status !== 'concluida') continue;
    const inicio = new Date(s.data_inicio);
    if (Number.isNaN(inicio.getTime()) || inicio < intervalo.inicio || inicio >= intervalo.fim) continue;

    const minutos = Math.max(Math.round(Number(s.duracao_efetiva_min) || 0), 0);
    const chaveDia = dataLocalISO(inicio);
    porDia.set(chaveDia, (porDia.get(chaveDia) ?? 0) + minutos);

    const nome = s.disciplina_nome?.trim() || SEM_DISCIPLINA;
    const atual = porDisciplina.get(nome) ?? { minutos: 0, sessoes: 0 };
    porDisciplina.set(nome, { minutos: atual.minutos + minutos, sessoes: atual.sessoes + 1 });

    totalMinutos += minutos;
    totalSessoes += 1;
  }

  const linhas = [...porDisciplina.entries()]
    .map(([disciplina, v]) => ({
      disciplina,
      minutos: v.minutos,
      sessoes: v.sessoes,
      percentual: totalMinutos > 0 ? Math.round((v.minutos / totalMinutos) * 100) : 0,
    }))
    .sort((a, b) => b.minutos - a.minutos || a.disciplina.localeCompare(b.disciplina, 'pt-BR'));

  const serieDias = [...porDia.entries()].map(([data, minutos]) => ({ data, minutos }));

  return {
    inicio: dataLocalISO(intervalo.inicio),
    fim: dataLocalISO(new Date(intervalo.fim.getTime() - DIA_MS)),
    totalMinutos,
    totalSessoes,
    diasEstudados: serieDias.filter((d) => d.minutos > 0).length,
    mediaMinutosPorDia: Math.round(totalMinutos / dias),
    porDisciplina: linhas,
    porDia: serieDias,
  };
}

const celula = (valor: string | number) => {
  const texto = String(valor);
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

/** CSV (separador ";" para abrir direto no Excel em português) com resumo, disciplinas e dias. */
export function relatorioParaCSV(relatorio: RelatorioPeriodo): string {
  const linhas: Array<Array<string | number>> = [
    ['Relatório de estudos Study Flow'],
    ['Período', `${relatorio.inicio} a ${relatorio.fim}`],
    ['Total de minutos', relatorio.totalMinutos],
    ['Total de sessões', relatorio.totalSessoes],
    ['Dias estudados', relatorio.diasEstudados],
    ['Média de minutos por dia', relatorio.mediaMinutosPorDia],
    [],
    ['Disciplina', 'Minutos', 'Sessões', 'Percentual'],
    ...relatorio.porDisciplina.map((l) => [l.disciplina, l.minutos, l.sessoes, `${l.percentual}%`]),
    [],
    ['Data', 'Minutos'],
    ...relatorio.porDia.map((d) => [d.data, d.minutos]),
  ];
  return linhas.map((l) => l.map(celula).join(';')).join('\r\n') + '\r\n';
}

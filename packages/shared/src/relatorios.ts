/**
 * Relatórios periódicos de tempo de estudo (RF011).
 * Funções puras: recebem as sessões e o intervalo, devolvem os números e o CSV.
 */

import { DISTRIBUTION_COLORS } from './constants';
import type { StudyDistribution } from './types';

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

/** Rótulo das sessões sem disciplina. */
export const SEM_DISCIPLINA = 'Geral';

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

/**
 * Célula do CSV. Texto que começa com = + - @, tab ou CR é lido como fórmula pelo Excel
 * (CSV injection, ex.: uma disciplina "=HYPERLINK(...)"): recebe um apóstrofo na frente.
 * Números ficam como estão.
 */
const celula = (valor: string | number) => {
  let texto = String(valor);
  if (typeof valor === 'string' && /^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
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

/** Metas sugeridas quando o perfil não tem horas diárias definidas. */
export const META_SUGERIDA_H = { semana: 28, mes: 80 } as const;

export interface MetaPeriodo {
  /** Meta em horas. */
  meta: number;
  /** Inteiro de 0 a 100. */
  percentual: number;
}

/**
 * Metas de estudo da semana e do mês a partir da meta diária do perfil (semana = 7 dias,
 * mês = 30 dias). Sem meta no perfil, usa META_SUGERIDA_H e marca `sugerida`.
 */
export function metasDeEstudo(horasDiarias: number | null | undefined, horasSemana: number, horasMes: number) {
  const diaria = Number(horasDiarias);
  const temMeta = Number.isFinite(diaria) && diaria > 0;
  const semana = temMeta ? diaria * 7 : META_SUGERIDA_H.semana;
  const mes = temMeta ? diaria * 30 : META_SUGERIDA_H.mes;
  const percentual = (feito: number, meta: number) => Math.min(100, Math.max(0, Math.round((feito / meta) * 100)));
  return {
    sugerida: !temMeta,
    semana: { meta: semana, percentual: percentual(horasSemana, semana) } as MetaPeriodo,
    mes: { meta: mes, percentual: percentual(horasMes, mes) } as MetaPeriodo,
  };
}

/**
 * Distribuição do tempo por disciplina (dashboard e estatísticas): as `limite` disciplinas
 * com mais tempo, em horas com uma casa, cada uma com a cor da paleta e o máximo da barra
 * (próximo número par de horas). Linhas sem disciplina ficam de fora.
 */
export function distribuicaoEstudo(linhas: Array<{ disciplina?: string | null; minutos: number }>, limite = 5): StudyDistribution[] {
  const totais = new Map<string, number>();
  for (const l of linhas) {
    const nome = l.disciplina?.trim();
    if (!nome) continue;
    totais.set(nome, (totais.get(nome) ?? 0) + Math.max(Number(l.minutos) || 0, 0));
  }
  return [...totais.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([name, minutos], i) => {
      const hours = Number((minutos / 60).toFixed(1));
      return { name, hours, max: Math.max(1, Math.ceil(hours / 2) * 2), color: DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length] };
    });
}

export type ModoRelatorio = PeriodoRelatorio | 'personalizado';

/**
 * Relatório da tela de estatísticas: semana, mês ou intervalo personalizado (datas AAAA-MM-DD).
 * Devolve o relatório ou a mensagem de erro do período.
 */
export function montarRelatorio(
  sessoes: SessaoRelatorio[],
  modo: ModoRelatorio,
  personalizado: { inicio: string; fim: string },
  agora: Date = new Date(),
): { relatorio: RelatorioPeriodo; erro: null } | { relatorio: null; erro: string } {
  try {
    const intervalo = modo === 'personalizado' ? intervaloPersonalizado(personalizado.inicio, personalizado.fim) : intervaloDoPeriodo(modo, agora);
    return { relatorio: gerarRelatorioPeriodo(sessoes, intervalo), erro: null };
  } catch (e) {
    return { relatorio: null, erro: e instanceof Error ? e.message : 'Período inválido' };
  }
}

/** Marca de ordem de bytes: faz o Excel abrir o CSV em UTF-8 (acentos corretos). */
export const BOM_UTF8 = '\uFEFF';

export const nomeArquivoRelatorio = (r: Pick<RelatorioPeriodo, 'inicio' | 'fim'>) => `relatorio-studyflow-${r.inicio}-a-${r.fim}.csv`;

/** 95 → "1h35"; 40 → "40min". */
export function formatarMinutos(minutos: number): string {
  const m = Math.max(Math.round(minutos), 0);
  const horas = Math.floor(m / 60);
  const resto = m % 60;
  return horas > 0 ? `${horas}h${String(resto).padStart(2, '0')}` : `${resto}min`;
}

/** 2.25 → "2,3 h". */
export const formatarHoras = (horas: number) => `${Number(horas.toFixed(1)).toLocaleString('pt-BR')} h`;

/** "2026-11-25" → "25/11/2026". */
export function formatarDataISO(valor: string): string {
  const [a, m, d] = valor.split('-');
  return a && m && d ? `${d}/${m}/${a}` : valor;
}

/** Linhas de resumo do relatório, na ordem exibida. */
export function resumoRelatorio(r: RelatorioPeriodo): Array<[string, string]> {
  return [
    ['Total de horas', formatarHoras(r.totalMinutos / 60)],
    ['Sessões', String(r.totalSessoes)],
    ['Dias estudados', String(r.diasEstudados)],
    ['Média por dia', formatarMinutos(r.mediaMinutosPorDia)],
  ];
}

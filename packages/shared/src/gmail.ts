/**
 * Sincronização com o Gmail (RF012): monta a busca a partir das palavras-chave do
 * usuário e transforma e-mails encontrados em itens do cronograma.
 * Funções puras: a chamada à API do Google fica nas rotas do servidor.
 */

export type LocalizacaoPalavra = 'assunto' | 'corpo' | 'remetente' | 'destinatario';

export interface PalavraChave {
  palavra: string;
  localizacao: LocalizacaoPalavra;
}

/** "corpo" vai sem prefixo: na busca do Gmail, um termo solto procura no e-mail inteiro (assunto, corpo, remetente). */
const PREFIXO: Record<LocalizacaoPalavra, string> = {
  assunto: 'subject:',
  corpo: '',
  remetente: 'from:',
  destinatario: 'to:',
};

/** Opções de onde procurar a palavra-chave, na ordem e com os rótulos das telas (site e app). */
export const LOCALIZACOES_PALAVRA: ReadonlyArray<{ valor: LocalizacaoPalavra; rotulo: string }> = [
  { valor: 'corpo', rotulo: 'Em qualquer lugar' },
  { valor: 'assunto', rotulo: 'Só no assunto' },
  { valor: 'remetente', rotulo: 'Remetente' },
  { valor: 'destinatario', rotulo: 'Destinatário' },
];

const termo = (palavra: string) => {
  const limpa = palavra.replace(/["{}()]/g, ' ').replace(/\s+/g, ' ').trim();
  return /\s/.test(limpa) ? `"${limpa}"` : limpa;
};

/**
 * Consulta no formato de busca do Gmail: qualquer palavra-chave ({a b} = OR),
 * a partir de `desde` (inclusive). Devolve null se não houver palavras válidas.
 */
export function montarConsultaGmail(palavras: PalavraChave[], desde?: Date | null): string | null {
  const termos = [
    ...new Set(
      palavras
        .map((p) => ({ ...p, valor: termo(p.palavra) }))
        .filter((p) => p.valor.length > 0)
        .map((p) => `${PREFIXO[p.localizacao] ?? ''}${p.valor}`),
    ),
  ];
  if (termos.length === 0) return null;

  const filtro = termos.length === 1 ? termos[0] : `{${termos.join(' ')}}`;
  if (!desde) return filtro;
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${filtro} after:${desde.getFullYear()}/${dois(desde.getMonth() + 1)}/${dois(desde.getDate())}`;
}

export type TipoEventoEmail = 'prova' | 'trabalho' | 'entrega' | 'atividade';

export interface EmailResumo {
  id: string;
  assunto: string;
  /** Trecho do corpo devolvido pela API (snippet); usado quando o corpo não vem. */
  trecho?: string | null;
  /** Corpo inteiro em texto puro (já sem HTML). */
  corpo?: string | null;
  recebidoEm: Date;
}

export interface EventoEmail {
  nome: string;
  tipo: TipoEventoEmail;
  /** AAAA-MM-DD. */
  data: string;
  origemExternaId: string;
}

const TIPOS: Array<[TipoEventoEmail, RegExp]> = [
  ['prova', /\b(prova|avalia[cç][aã]o|exame|teste|recupera[cç][aã]o|substitutiva|p[1-9])\b/i],
  ['trabalho', /\b(trabalho|projeto|semin[aá]rio|relat[oó]rio|apresenta[cç][aã]o)\b/i],
  ['entrega', /\b(entrega|prazo|deadline|submiss[aã]o)\b/i],
];

/** Qualquer palavra de evento, para achar onde cada uma aparece no texto. */
const RE_EVENTO = new RegExp(TIPOS.map(([, re]) => re.source).join('|'), 'gi');

export function classificarTipo(texto: string): TipoEventoEmail {
  return TIPOS.find(([, re]) => re.test(texto))?.[0] ?? 'atividade';
}

const MESES: Record<string, number> = {
  jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, 'março': 3, marco: 3, abr: 4, abril: 4,
  mai: 5, maio: 5, jun: 6, junho: 6, jul: 7, julho: 7, ago: 8, agosto: 8, set: 9, setembro: 9,
  out: 10, outubro: 10, nov: 11, novembro: 11, dez: 12, dezembro: 12,
};

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0, segunda: 1, 'terça': 2, terca: 2, quarta: 3, quinta: 4, sexta: 5, 'sábado': 6, sabado: 6,
};

/** 25/12, 25/12/2026, 25.12.2026, 25-12-2026 e 2026-12-25. Com "." ou "-" o ano é obrigatório ("nota 7.5", "capítulos 3-5"). */
const RE_NUMERICA = /(?<![\d/.,-])(?:(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})([/.-])(\d{1,2})(?:\5(\d{4}|\d{2}))?)(?![\d,])/g;
/** "5 de dezembro", "1º de dez. de 2026". */
const RE_EXTENSO =
  /(?<!\d)(\d{1,2})(?:º|°)?\s+de\s+(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?(?:\s+de\s+(\d{4}))?(?![\p{L}\d])/giu;
/** "amanhã", "depois de amanhã", "sexta-feira", "próximo sábado". */
const RE_RELATIVA =
  /(depois\s+de\s+amanh[ãa]|amanh[ãa])|(?:pr[óo]xim[oa]\s+)?(segunda|ter[çc]a|quarta|quinta|sexta)-feira|(?:pr[óo]xim[oa]\s+)?(s[áa]bado|domingo)(?![\p{L}])/giu;

interface DataNoTexto {
  data: string;
  inicio: number;
  fim: number;
  relativa: boolean;
}

const dois = (n: number) => String(n).padStart(2, '0');
const isoDe = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
const diaDe = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Valida dia/mês e, sem ano no texto, usa a próxima ocorrência a partir da referência. */
function montarData(dia: number, mes: number, anoTexto: string | undefined, referencia: Date): string | null {
  let ano = anoTexto ? Number(anoTexto) : referencia.getFullYear();
  if (anoTexto && anoTexto.length === 2) ano += 2000;
  const data = new Date(ano, mes - 1, dia);
  if (data.getMonth() !== mes - 1 || data.getDate() !== dia) return null;
  if (!anoTexto && data < diaDe(referencia)) data.setFullYear(ano + 1);
  return isoDe(data);
}

/** Todas as datas do texto, na ordem em que aparecem. */
function encontrarDatas(texto: string, referencia: Date): DataNoTexto[] {
  const achadas: DataNoTexto[] = [];
  const guardar = (m: RegExpMatchArray, data: string | null, relativa = false) => {
    const inicio = m.index ?? 0;
    if (data) achadas.push({ data, inicio, fim: inicio + m[0].length, relativa });
  };

  for (const m of texto.matchAll(RE_NUMERICA)) {
    if (m[1] !== undefined) {
      guardar(m, montarData(Number(m[3]), Number(m[2]), m[1], referencia));
    } else if (m[5] === '/' || m[7] !== undefined) {
      guardar(m, montarData(Number(m[4]), Number(m[6]), m[7], referencia));
    }
  }
  for (const m of texto.matchAll(RE_EXTENSO)) {
    guardar(m, montarData(Number(m[1]), MESES[m[2].toLowerCase()], m[3], referencia));
  }
  const base = diaDe(referencia);
  for (const m of texto.matchAll(RE_RELATIVA)) {
    const d = new Date(base);
    if (m[1]) {
      d.setDate(d.getDate() + (/depois/i.test(m[1]) ? 2 : 1));
    } else {
      const alvo = DIAS_SEMANA[(m[2] ?? m[3]).toLowerCase()];
      d.setDate(d.getDate() + ((alvo - d.getDay() + 7) % 7 || 7));
    }
    guardar(m, isoDe(d), true);
  }
  return achadas.sort((a, b) => a.inicio - b.inicio);
}

/**
 * Primeira data do texto: DD/MM, DD/MM/AAAA (também com "-" ou "." quando há ano),
 * AAAA-MM-DD ou "5 de dezembro". Sem ano, usa a próxima ocorrência a partir de `referencia`.
 */
export function extrairData(texto: string, referencia: Date): string | null {
  return encontrarDatas(texto, referencia).find((d) => !d.relativa)?.data ?? null;
}

/** Converte HTML de e-mail em texto, mantendo as quebras de bloco (parágrafos, linhas de tabela). */
export function textoDeHtml(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h[1-6]|table|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');
}

/** Tira a mensagem citada de respostas ("Em qui., 20 de nov. ..., Fulano escreveu:") e linhas com ">". */
export function limparCorpo(texto: string): string {
  let t = texto.replace(/\r\n?/g, '\n');
  const citacao = /(^|\n)[^\n]*\b(?:Em|On)\b[^\n]*(?:\n[^\n]*)?\b(?:escreveu|wrote)\s*:/i.exec(t);
  if (citacao) t = t.slice(0, citacao.index);
  return t
    .split('\n')
    .filter((linha) => !/^\s*>/.test(linha))
    .map((linha) => linha.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 20000);
}

interface PalavraNoTexto {
  texto: string;
  inicio: number;
  fim: number;
}

/** Posições que separam frases/linhas (fora das datas, para "25.12.2026" e "dez." não quebrarem). */
function separadores(texto: string, datas: DataNoTexto[]): number[] {
  const posicoes: number[] = [];
  for (const m of texto.matchAll(/\n|[.!?;](?=\s)/g)) {
    const i = m.index ?? 0;
    if (!datas.some((d) => i >= d.inicio && i < d.fim)) posicoes.push(i);
  }
  return posicoes;
}

const rotulo = (palavra: string) =>
  /^p\d$/i.test(palavra) ? palavra.toUpperCase() : palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();

const limitar = (nome: string) => (nome.length > 120 ? `${nome.slice(0, 117)}...` : nome);

/**
 * Transforma um e-mail em itens do cronograma, um por data de evento.
 *
 * O texto (assunto + corpo, sem a parte citada) é dividido em frases. Cada data é ligada à
 * palavra de evento (prova, P2, entrega...) da mesma frase: de preferência a mais próxima
 * antes dela, senão a mais próxima depois, sem atravessar outra data e sem repetir uma palavra
 * já usada por outra data. Datas passadas são descartadas, e datas relativas ("sexta-feira",
 * "amanhã") só contam quando a frase tem uma palavra de evento e nenhuma data explícita.
 *
 * Com duas ou mais datas ligadas a eventos, cada uma vira um item ("Assunto — P2").
 * Com uma só, o e-mail vira um item com o nome do assunto, como antes.
 */
export function extrairEventosDoEmail(email: EmailResumo): EventoEmail[] {
  const assunto = email.assunto.replace(/\s+/g, ' ').trim();
  if (!email.id || !assunto) return [];

  const texto = `${assunto}\n${limparCorpo(email.corpo ?? email.trecho ?? '')}`;
  const hoje = isoDe(diaDe(email.recebidoEm));
  const datas = encontrarDatas(texto, email.recebidoEm).filter((d) => d.data >= hoje);
  if (datas.length === 0) return [];

  const cortes = separadores(texto, datas);
  const frase = (pos: number) => cortes.filter((c) => c < pos).length;
  const palavras: PalavraNoTexto[] = [...texto.matchAll(RE_EVENTO)].map((m) => ({
    texto: m[0],
    inicio: m.index ?? 0,
    fim: (m.index ?? 0) + m[0].length,
  }));

  const usadas = new Set<PalavraNoTexto>();
  const candidatas: Array<{ data: string; palavra: PalavraNoTexto | null; relativa: boolean }> = [];
  for (const d of datas) {
    const mesmaFrase = palavras.filter((p) => frase(p.inicio) === frase(d.inicio));
    const semDataNoMeio = (p: PalavraNoTexto) =>
      !datas.some((o) => o !== d && o.inicio >= Math.min(p.fim, d.fim) && o.fim <= Math.max(p.inicio, d.inicio));
    const antes = mesmaFrase.filter((p) => p.fim <= d.inicio && semDataNoMeio(p)).sort((a, b) => b.fim - a.fim);
    const depois = mesmaFrase.filter((p) => p.inicio >= d.fim && semDataNoMeio(p)).sort((a, b) => a.inicio - b.inicio);
    const opcoes = [...antes, ...depois];
    const palavra = opcoes.find((p) => !usadas.has(p)) ?? opcoes[0] ?? null;

    if (d.relativa) {
      const temExplicita = datas.some((o) => !o.relativa && frase(o.inicio) === frase(d.inicio));
      if (!palavra || temExplicita) continue;
    }
    if (palavra) usadas.add(palavra);
    candidatas.push({ data: d.data, palavra, relativa: d.relativa });
  }

  const ligadas = candidatas.filter(
    (c, i, todas) => c.palavra !== null && todas.findIndex((o) => o.palavra !== null && o.data === c.data) === i,
  );
  if (ligadas.length >= 2) {
    return ligadas.map((c) => ({
      nome: limitar(`${assunto} — ${rotulo(c.palavra!.texto)}`),
      tipo: classificarTipo(c.palavra!.texto),
      data: c.data,
      origemExternaId: `gmail:${email.id}:${c.data}`,
    }));
  }

  const escolhida = ligadas[0] ?? candidatas.find((c) => !c.relativa);
  if (!escolhida) return [];
  return [{ nome: limitar(assunto), tipo: classificarTipo(texto), data: escolhida.data, origemExternaId: `gmail:${email.id}` }];
}

/** Endereço do app (scheme "studyflow" do app.json) para onde o callback do OAuth devolve quem conectou pelo celular. */
export const APP_RETORNO_GMAIL = 'studyflow://integracoes';

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

const PREFIXO: Record<LocalizacaoPalavra, string> = {
  assunto: 'subject:',
  corpo: '',
  remetente: 'from:',
  destinatario: 'to:',
};

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
  /** Trecho do corpo devolvido pela API (snippet). */
  trecho?: string | null;
  recebidoEm: Date;
}

export interface EventoEmail {
  nome: string;
  tipo: TipoEventoEmail;
  /** AAAA-MM-DD, ou null se o e-mail não traz uma data reconhecível. */
  data: string | null;
  origemExternaId: string;
}

const TIPOS: Array<[TipoEventoEmail, RegExp]> = [
  ['prova', /\b(prova|avalia[cç][aã]o|exame|teste|p[1-9])\b/i],
  ['trabalho', /\b(trabalho|projeto|semin[aá]rio|relat[oó]rio)\b/i],
  ['entrega', /\b(entrega|prazo|deadline|submiss[aã]o)\b/i],
];

export function classificarTipo(texto: string): TipoEventoEmail {
  return TIPOS.find(([, re]) => re.test(texto))?.[0] ?? 'atividade';
}

/**
 * Primeira data DD/MM ou DD/MM/AAAA (também com "-" ou ".") do texto.
 * Sem ano, usa a próxima ocorrência a partir do recebimento do e-mail.
 */
export function extrairData(texto: string, referencia: Date): string | null {
  const re = /\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?\b/g;
  for (const m of texto.matchAll(re)) {
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    let ano = m[3] ? Number(m[3]) : referencia.getFullYear();
    if (m[3] && m[3].length === 2) ano += 2000;

    const data = new Date(ano, mes - 1, dia);
    if (data.getMonth() !== mes - 1 || data.getDate() !== dia) continue;

    const base = new Date(referencia.getFullYear(), referencia.getMonth(), referencia.getDate());
    if (!m[3] && data < base) data.setFullYear(ano + 1);

    const dois = (n: number) => String(n).padStart(2, '0');
    return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;
  }
  return null;
}

/** Converte um e-mail encontrado pela busca em item do cronograma. */
export function extrairEventoDoEmail(email: EmailResumo): EventoEmail | null {
  const assunto = email.assunto.replace(/\s+/g, ' ').trim();
  if (!email.id || !assunto) return null;
  const texto = `${assunto} ${email.trecho ?? ''}`;

  return {
    nome: assunto.length > 120 ? `${assunto.slice(0, 117)}...` : assunto,
    tipo: classificarTipo(texto),
    data: extrairData(texto, email.recebidoEm),
    origemExternaId: `gmail:${email.id}`,
  };
}

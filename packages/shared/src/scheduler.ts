import { isValidTimeString } from './validation';

/**
 * Gerador de cronograma de estudos (RF006 / RF008).
 *
 * Convenção de tempo: todo o cálculo usa o HORÁRIO LOCAL do ambiente de execução
 * (getFullYear/getMonth/getDate/getDay e `new Date(a, m, d, h, min)`), pois a rotina
 * do usuário ("segunda às 19:00") é expressa em hora de parede. O resultado é
 * serializado com `toISOString()` (UTC); para recuperar a hora local basta
 * `new Date(iso)`.
 */

/** Horário recorrente semanal em que o usuário pode estudar. */
export interface RotinaSlot {
  id?: string;
  /** 0 = domingo ... 6 = sábado */
  dia_semana: number;
  /** "HH:MM" */
  hora_inicio: string;
  /** "HH:MM" */
  hora_fim: string;
}

export interface DisciplinaPlanejamento {
  id: string;
  nome: string;
  /** Peso/prioridade de 1 a 5 (padrão 1). */
  peso?: number;
  /** Data da próxima prova no formato YYYY-MM-DD. */
  proximaProva?: string | null;
}

export interface BlocoEstudo {
  disciplina_id: string;
  disciplina_nome: string;
  /** ISO (UTC) do início do bloco. */
  data_inicio: string;
  /** ISO (UTC) do fim do bloco. */
  data_fim: string;
}

export interface GerarCronogramaParams {
  disciplinas: DisciplinaPlanejamento[];
  rotina: RotinaSlot[];
  dataInicio: Date;
  /** 1 a 8 */
  semanas: number;
  /** Duração de cada bloco em minutos (padrão 50). */
  duracaoBlocoMin?: number;
  /** Intervalo entre blocos do mesmo horário em minutos (padrão 10). */
  intervaloMin?: number;
}

export type CronogramaErrorCode =
  | 'SEM_DISCIPLINAS'
  | 'ROTINA_VAZIA'
  | 'ROTINA_INVALIDA'
  | 'PARAMETROS_INVALIDOS'
  | 'SEM_BLOCOS';

export class CronogramaError extends Error {
  readonly code: CronogramaErrorCode;
  readonly detalhes: string[];

  constructor(code: CronogramaErrorCode, message: string, detalhes: string[] = []) {
    super(message);
    this.name = 'CronogramaError';
    this.code = code;
    this.detalhes = detalhes;
    Object.setPrototypeOf(this, CronogramaError.prototype);
  }
}

export const NOMES_DIAS_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

export const PESO_MIN = 1;
export const PESO_MAX = 5;
export const FATOR_PROVA_PROXIMA = 2;
export const SEMANAS_MIN = 1;
export const SEMANAS_MAX = 8;

function paraMinutos(hhmm: string): number {
  const [h, m] = hhmm.trim().split(':').map(Number);
  return h * 60 + m;
}

function nomeDia(dia: number): string {
  return NOMES_DIAS_SEMANA[dia];
}

/**
 * Valida a rotina semanal. Retorna a lista de mensagens de erro (vazia se válida).
 * Se `duracaoBlocoMin` for informado, também acusa horários menores que um bloco.
 */
export function validarRotina(slots: RotinaSlot[], duracaoBlocoMin?: number): string[] {
  const erros: string[] = [];
  const validos: Array<{ dia: number; ini: number; fim: number; rotulo: string }> = [];

  slots.forEach((slot) => {
    const diaOk = Number.isInteger(slot.dia_semana) && slot.dia_semana >= 0 && slot.dia_semana <= 6;
    if (!diaOk) {
      erros.push('Dia da semana inválido.');
      return;
    }
    const rotulo = `${nomeDia(slot.dia_semana)} ${slot.hora_inicio} – ${slot.hora_fim}`;
    if (!isValidTimeString(slot.hora_inicio) || !isValidTimeString(slot.hora_fim)) {
      erros.push(`Horário inválido em ${nomeDia(slot.dia_semana)}: use o formato HH:MM.`);
      return;
    }
    const ini = paraMinutos(slot.hora_inicio);
    const fim = paraMinutos(slot.hora_fim);
    if (fim <= ini) {
      erros.push('O horário de fim deve ser posterior ao horário de início.');
      return;
    }
    if (duracaoBlocoMin !== undefined && fim - ini < duracaoBlocoMin) {
      erros.push(`O horário ${rotulo} é menor que a duração do bloco (${duracaoBlocoMin} min).`);
    }
    validos.push({ dia: slot.dia_semana, ini, fim, rotulo });
  });

  for (let i = 0; i < validos.length; i++) {
    for (let j = i + 1; j < validos.length; j++) {
      const a = validos[i];
      const b = validos[j];
      if (a.dia === b.dia && a.ini < b.fim && b.ini < a.fim) {
        erros.push(`Os horários ${a.rotulo} e ${b.rotulo} se sobrepõem.`);
      }
    }
  }

  return erros;
}

function pesoBase(d: DisciplinaPlanejamento): number {
  const p = d.peso ?? PESO_MIN;
  if (!Number.isFinite(p)) return PESO_MIN;
  return Math.min(PESO_MAX, Math.max(PESO_MIN, p));
}

function chaveData(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

/**
 * Gera o cronograma de blocos de estudo, ordenado cronologicamente.
 *
 * - Cada ocorrência de horário da rotina dentro do período (`semanas` * 7 dias a
 *   partir do dia de `dataInicio`, inclusive) é fatiada em blocos de
 *   `duracaoBlocoMin`, separados por `intervaloMin`.
 * - Disciplinas são distribuídas por "smooth weighted round robin" (determinístico),
 *   proporcional ao peso efetivo: peso (1-5) x 2 quando a prova cai dentro do
 *   período e o bloco ocorre até a data da prova (blocos posteriores usam o peso normal).
 * - Evita a mesma disciplina em blocos consecutivos quando há outra disponível.
 *
 * @throws CronogramaError
 */
export function gerarCronograma(params: GerarCronogramaParams): BlocoEstudo[] {
  const { disciplinas, rotina, dataInicio, semanas } = params;
  const duracao = params.duracaoBlocoMin ?? 50;
  const intervalo = params.intervaloMin ?? 10;

  if (!Array.isArray(disciplinas) || disciplinas.length === 0) {
    throw new CronogramaError('SEM_DISCIPLINAS', 'Cadastre ao menos uma disciplina antes de gerar o cronograma.');
  }
  if (!Array.isArray(rotina) || rotina.length === 0) {
    throw new CronogramaError('ROTINA_VAZIA', 'Cadastre sua rotina semanal antes de gerar o cronograma.');
  }
  if (!(dataInicio instanceof Date) || Number.isNaN(dataInicio.getTime())) {
    throw new CronogramaError('PARAMETROS_INVALIDOS', 'Data de início inválida.');
  }
  if (!Number.isInteger(semanas) || semanas < SEMANAS_MIN || semanas > SEMANAS_MAX) {
    throw new CronogramaError('PARAMETROS_INVALIDOS', `O número de semanas deve estar entre ${SEMANAS_MIN} e ${SEMANAS_MAX}.`);
  }
  if (!Number.isFinite(duracao) || duracao <= 0 || !Number.isFinite(intervalo) || intervalo < 0) {
    throw new CronogramaError('PARAMETROS_INVALIDOS', 'Duração do bloco e intervalo devem ser positivos.');
  }

  const erros = validarRotina(rotina);
  if (erros.length > 0) {
    throw new CronogramaError('ROTINA_INVALIDA', erros[0], erros);
  }

  // 1) Ocorrências de blocos, em ordem cronológica.
  const inicioDia = new Date(dataInicio.getFullYear(), dataInicio.getMonth(), dataInicio.getDate());
  const totalDias = semanas * 7;
  const inicioPeriodo = chaveData(inicioDia);
  const fimPeriodo = chaveData(new Date(inicioDia.getFullYear(), inicioDia.getMonth(), inicioDia.getDate() + totalDias - 1));

  const slotsPorDia: RotinaSlot[][] = [[], [], [], [], [], [], []];
  rotina.forEach((s) => slotsPorDia[s.dia_semana].push(s));
  slotsPorDia.forEach((lista) => lista.sort((a, b) => paraMinutos(a.hora_inicio) - paraMinutos(b.hora_inicio)));

  const ocorrencias: Array<{ inicio: Date; fim: Date; dia: string }> = [];
  for (let i = 0; i < totalDias; i++) {
    const dia = new Date(inicioDia.getFullYear(), inicioDia.getMonth(), inicioDia.getDate() + i);
    for (const slot of slotsPorDia[dia.getDay()]) {
      const ini = paraMinutos(slot.hora_inicio);
      const fim = paraMinutos(slot.hora_fim);
      for (let t = ini; t + duracao <= fim; t += duracao + intervalo) {
        ocorrencias.push({
          inicio: new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 0, t),
          fim: new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), 0, t + duracao),
          dia: chaveData(dia),
        });
      }
    }
  }

  if (ocorrencias.length === 0) {
    throw new CronogramaError('SEM_BLOCOS', 'Nenhum horário da rotina comporta um bloco de estudo com a duração informada.');
  }

  // 2) Smooth weighted round robin com pesos por bloco.
  const atual = disciplinas.map(() => 0);
  const base = disciplinas.map(pesoBase);
  const provaNoPeriodo = disciplinas.map((d) => {
    const p = d.proximaProva ? d.proximaProva.slice(0, 10) : null;
    return p && p >= inicioPeriodo && p <= fimPeriodo ? p : null;
  });

  let anterior = -1;
  return ocorrencias.map((oc) => {
    const pesos = base.map((b, i) => {
      const prova = provaNoPeriodo[i];
      return prova && oc.dia <= prova ? b * FATOR_PROVA_PROXIMA : b;
    });
    const total = pesos.reduce((acc, p) => acc + p, 0);
    pesos.forEach((p, i) => {
      atual[i] += p;
    });

    let escolhida = -1;
    for (let i = 0; i < atual.length; i++) {
      if (disciplinas.length > 1 && i === anterior) continue;
      if (escolhida === -1 || atual[i] > atual[escolhida]) escolhida = i;
    }
    atual[escolhida] -= total;
    anterior = escolhida;

    return {
      disciplina_id: disciplinas[escolhida].id,
      disciplina_nome: disciplinas[escolhida].nome,
      data_inicio: oc.inicio.toISOString(),
      data_fim: oc.fim.toISOString(),
    };
  });
}

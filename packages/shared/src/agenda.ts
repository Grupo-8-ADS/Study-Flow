/**
 * Núcleo da Agenda, compartilhado entre web e mobile (calendário, compromissos, disciplinas e cronograma).
 *
 * - Todo compromisso (prova, trabalho, atividade, bloco de estudo) mora em `itens_cronograma`.
 * - Datas são gravadas como instantes reais (ISO com fuso), a partir do horário local do
 *   usuário, e lidas de volta com `new Date()` — assim o banco (lembretes em
 *   America/Sao_Paulo) e a tela concordam.
 * - Compromisso sem horário é "dia inteiro": 00:00 até 23:59 do dia escolhido.
 * - Os dados ficam em cache em memória entre as abas, para a troca de tela ser instantânea;
 *   a cada visita a página mostra o cache e atualiza em segundo plano.
 * @packageDocumentation
 */


import type { SupabaseClient } from "@supabase/supabase-js";

/** Id aleatório (UUID v4) também em ambientes sem crypto.randomUUID (React Native/Hermes). */
export function gerarId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}


export type TipoCompromisso = "prova" | "trabalho" | "atividade" | "estudo";

export const TIPOS_COMPROMISSO: Array<{ value: TipoCompromisso; label: string }> = [
  { value: "prova", label: "Prova" },
  { value: "trabalho", label: "Trabalho / entrega" },
  { value: "atividade", label: "Atividade" },
  { value: "estudo", label: "Estudo" },
];

export const ROTULO_TIPO: Record<TipoCompromisso | "aula", string> = {
  prova: "Prova",
  trabalho: "Trabalho",
  atividade: "Atividade",
  estudo: "Estudo",
  aula: "Aula",
};

export type Compromisso = {
  id: string;
  titulo: string;
  tipo: TipoCompromisso;
  disciplinaId: string | null;
  /** AAAA-MM-DD (horário local). */
  data: string;
  /** "HH:MM" ou "" quando é dia inteiro. */
  horaInicio: string;
  /** "HH:MM" ou "" quando não tem fim definido. */
  horaFim: string;
  notas: string;
  concluido: boolean;
  /** "cronograma" (gerado pela rotina), "gmail" (importado) ou null (criado à mão). */
  origem: "cronograma" | "gmail" | null;
};

export type Aula = { dia_semana: number; inicio: string; fim: string };

export type DisciplinaAgenda = {
  id: string;
  nome: string;
  professor: string;
  /** 1 = baixa, 2 = média, 3 = alta. Vira o peso no gerador de cronograma. */
  prioridade: 1 | 2 | 3;
  aulas: Aula[];
  notas: string;
};

export type AgendaDados = { disciplinas: DisciplinaAgenda[]; compromissos: Compromisso[] };

/** Rascunho do formulário de compromisso. */
export type CompromissoForm = Omit<Compromisso, "id" | "concluido" | "origem">;

export const compromissoVazio = (data = hojeStr()): CompromissoForm => ({
  titulo: "",
  tipo: "atividade",
  disciplinaId: null,
  data,
  horaInicio: "",
  horaFim: "",
  notas: "",
});

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

const dois = (n: number) => String(n).padStart(2, "0");
export const dataStr = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
export const horaStr = (d: Date) => `${dois(d.getHours())}:${dois(d.getMinutes())}`;
export const hojeStr = () => dataStr(new Date());

/** Date local a partir de "AAAA-MM-DD" e "HH:MM". */
export function dataLocal(data: string, hora = "00:00") {
  const [a, m, d] = data.split("-").map(Number);
  const [h, min] = hora.split(":").map(Number);
  return new Date(a, m - 1, d, h || 0, min || 0);
}

/** Início e fim reais (instantes) de um compromisso. */
export function intervaloDe(c: Pick<Compromisso, "data" | "horaInicio" | "horaFim">) {
  if (!c.horaInicio) return { inicio: dataLocal(c.data, "00:00"), fim: dataLocal(c.data, "23:59") };
  const inicio = dataLocal(c.data, c.horaInicio);
  const fim = c.horaFim ? dataLocal(c.data, c.horaFim) : inicio;
  return { inicio, fim };
}

export function paraLinha(c: CompromissoForm) {
  const { inicio, fim } = intervaloDe(c);
  return {
    nome: c.titulo.trim(),
    tipo: c.tipo,
    disciplina_id: c.disciplinaId || null,
    data_inicio: inicio.toISOString(),
    data_fim: fim.toISOString(),
    descricao: c.notas.trim() || null,
  };
}

function normalizarTipo(tipo: unknown): TipoCompromisso {
  const t = String(tipo ?? "").toLowerCase();
  if (t === "prova") return "prova";
  if (t === "trabalho" || t === "entrega") return "trabalho";
  if (t === "estudo") return "estudo";
  return "atividade";
}

type LinhaItem = {
  id: string;
  nome: string;
  tipo: string;
  disciplina_id: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  descricao: string | null;
  completed: boolean | null;
  origem_externa_id: string | null;
};

export function deLinha(l: LinhaItem): Compromisso | null {
  const ini = l.data_inicio ? new Date(l.data_inicio) : null;
  const fim = l.data_fim ? new Date(l.data_fim) : null;
  const base = ini ?? fim;
  if (!base || Number.isNaN(base.getTime())) return null;

  let horaInicio = "";
  let horaFim = "";
  if (ini) {
    const hi = horaStr(ini);
    const hf = fim ? horaStr(fim) : "";
    const diaInteiro = hi === "00:00" && (!fim || (hf === "23:59" && dataStr(fim) === dataStr(ini)));
    if (!diaInteiro) {
      horaInicio = hi;
      horaFim = fim && fim.getTime() > ini.getTime() && dataStr(fim) === dataStr(ini) ? hf : "";
    }
  } else if (fim && horaStr(fim) !== "23:59") {
    // Só prazo (sem início): mostra o horário-limite.
    horaInicio = horaStr(fim);
  }

  const origem = l.origem_externa_id?.startsWith("cronograma:")
    ? "cronograma"
    : l.origem_externa_id?.startsWith("gmail:")
      ? "gmail"
      : null;

  return {
    id: l.id,
    titulo: l.nome,
    tipo: normalizarTipo(l.tipo),
    disciplinaId: l.disciplina_id,
    data: dataStr(base),
    horaInicio,
    horaFim,
    notas: l.descricao ?? "",
    concluido: Boolean(l.completed),
    origem,
  };
}

export function ordenarCompromissos(lista: Compromisso[]) {
  return [...lista].sort((a, b) => `${a.data}${a.horaInicio || "00:00"}`.localeCompare(`${b.data}${b.horaInicio || "00:00"}`));
}

export function formatarData(data: string, comDiaSemana = false) {
  if (!data) return "Sem data";
  const d = dataLocal(data);
  const texto = `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`;
  if (!comDiaSemana) return texto;
  return `${["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()]}, ${texto}`;
}

export function formatarHorario(c: Pick<Compromisso, "horaInicio" | "horaFim">) {
  if (!c.horaInicio) return "Dia inteiro";
  return c.horaFim ? `${c.horaInicio} – ${c.horaFim}` : c.horaInicio;
}

/** Valida o formulário; devolve a mensagem de erro ou null. */
export function validarCompromisso(c: CompromissoForm): string | null {
  if (!c.titulo.trim()) return "Dê um nome ao compromisso.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.data) || Number.isNaN(dataLocal(c.data).getTime())) return "Escolha a data.";
  if (c.horaFim && !c.horaInicio) return "Informe o horário de início antes do término.";
  if (c.horaInicio && c.horaFim && c.horaFim <= c.horaInicio) return "O término deve ser depois do início.";
  return null;
}

// ---------------------------------------------------------------------------
// Disciplinas
// ---------------------------------------------------------------------------

type AnotacoesDisciplina = {
  aulas?: Aula[];
  prioridade?: number;
  notes?: string;
  provas?: Array<{ id?: string; nome?: string; data?: string }>;
  trabalhos?: Array<{ id?: string; nome?: string; data?: string }>;
  examDate?: string;
  workDate?: string;
  [chave: string]: unknown;
};

type LinhaDisciplina = { id: string; nome: string; professor: string | null; anotacoes: unknown };

function deDisciplina(l: LinhaDisciplina): DisciplinaAgenda {
  const n = (typeof l.anotacoes === "object" && l.anotacoes !== null ? l.anotacoes : {}) as AnotacoesDisciplina;
  const p = Number(n.prioridade);
  return {
    id: l.id,
    nome: l.nome,
    professor: l.professor ?? "",
    prioridade: p === 1 || p === 3 ? p : 2,
    aulas: Array.isArray(n.aulas)
      ? n.aulas.filter((a) => Number.isInteger(a?.dia_semana) && /^\d{2}:\d{2}$/.test(a?.inicio) && /^\d{2}:\d{2}$/.test(a?.fim))
      : [],
    notas: typeof n.notes === "string" ? n.notes : "",
  };
}

export function anotacoesDe(d: Pick<DisciplinaAgenda, "aulas" | "prioridade" | "notas">) {
  return { aulas: d.aulas, prioridade: d.prioridade, notes: d.notas };
}

/** Ocorrências das aulas semanais entre duas datas (inclusive), como compromissos de exibição. */
export function aulasNoPeriodo(disciplinas: DisciplinaAgenda[], de: string, ate: string) {
  const lista: Array<Compromisso & { aula: true }> = [];
  const fim = dataLocal(ate);
  for (let d = dataLocal(de); d <= fim; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const dia = d.getDay();
    const data = dataStr(d);
    disciplinas.forEach((disc) =>
      disc.aulas
        .filter((a) => a.dia_semana === dia)
        .forEach((a) =>
          lista.push({
            aula: true,
            id: `aula-${disc.id}-${data}-${a.inicio}`,
            titulo: disc.nome,
            tipo: "atividade",
            disciplinaId: disc.id,
            data,
            horaInicio: a.inicio,
            horaFim: a.fim,
            notas: disc.professor ? `Prof. ${disc.professor}` : "",
            concluido: false,
            origem: null,
          }),
        ),
    );
  }
  return lista;
}

/** Próxima prova (AAAA-MM-DD, hoje ou depois) de cada disciplina. */
export function proximasProvas(compromissos: Compromisso[]) {
  const hoje = hojeStr();
  const mapa = new Map<string, string>();
  ordenarCompromissos(compromissos).forEach((c) => {
    if (c.tipo === "prova" && c.disciplinaId && c.data >= hoje && !mapa.has(c.disciplinaId)) mapa.set(c.disciplinaId, c.data);
  });
  return mapa;
}


export type DisciplinaForm = Omit<DisciplinaAgenda, "id">;

export type EstadoAgenda = { dados: AgendaDados | null; userId: string | null; local: boolean; carregando: boolean; erro: string | null };

export type AgendaConfig = {
  client: SupabaseClient;
  /** Id do usuário logado no Supabase (ou null para o modo só-local). */
  obterUserId: () => Promise<string | null>;
  /** Se há alguém logado no app (sessão local do Study Flow). */
  temSessao: () => boolean | Promise<boolean>;
  /** Chave do armazenamento local usada no modo sem Supabase. */
  chaveLocal: () => string | Promise<string>;
  storage: { get: (k: string) => string | null | Promise<string | null>; set: (k: string, v: string) => void | Promise<void> };
};

/**
 * Cria a store da Agenda (cache em memória + operações) ligada a um cliente Supabase.
 * Cada app (web/mobile) cria uma instância e a expõe com o seu hook de React.
 */
export function criarAgenda(cfg: AgendaConfig) {
  // ---------------------------------------------------------------------------
  // Carga, cache e migração das provas antigas (guardadas no JSON da disciplina)
  // ---------------------------------------------------------------------------

  type Estado = EstadoAgenda;

  let estado: Estado = { dados: null, userId: null, local: false, carregando: false, erro: null };
  let emAndamento: Promise<void> | null = null;
  /** Incrementa ao limpar o cache: cargas iniciadas antes disso são descartadas. */
  let geracao = 0;
  const ouvintes = new Set<() => void>();

  function definir(parcial: Partial<Estado>) {
    estado = { ...estado, ...parcial };
    ouvintes.forEach((f) => f());
  }


  function salvarLocal(dados: AgendaDados) {
    void Promise.resolve(cfg.chaveLocal()).then((k) => cfg.storage.set(k, JSON.stringify(dados)));
  }

  async function migrarAvaliacoesAntigas(userId: string, linhas: LinhaDisciplina[]) {
    const novos: Array<Record<string, unknown>> = [];
    const limpar: Array<{ id: string; anotacoes: AnotacoesDisciplina }> = [];

    linhas.forEach((l) => {
      const n = (typeof l.anotacoes === "object" && l.anotacoes !== null ? l.anotacoes : {}) as AnotacoesDisciplina;
      const provas = Array.isArray(n.provas) ? n.provas : n.examDate ? [{ nome: "Prova", data: n.examDate }] : [];
      const trabalhos = Array.isArray(n.trabalhos) ? n.trabalhos : n.workDate ? [{ nome: "Trabalho", data: n.workDate }] : [];
      if (provas.length === 0 && trabalhos.length === 0 && !("provas" in n) && !("trabalhos" in n)) return;

      const add = (tipo: TipoCompromisso, itens: Array<{ id?: string; nome?: string; data?: string }>) =>
        itens.forEach((it, idx) => {
          const data = String(it?.data ?? "").slice(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
          novos.push({
            ...paraLinha({ titulo: it.nome || `${ROTULO_TIPO[tipo]} – ${l.nome}`, tipo, disciplinaId: l.id, data, horaInicio: "", horaFim: "", notas: "" }),
            user_id: userId,
            // Id estável: migrar de novo (outra aba, outro aparelho, app antigo) não duplica.
            origem_externa_id: `legado:${l.id}:${tipo}:${it?.id ?? `${idx}-${data}`}`,
          });
        });
      add("prova", provas);
      add("trabalho", trabalhos);

      const resto = { ...n };
      delete resto.provas;
      delete resto.trabalhos;
      delete resto.examDate;
      delete resto.workDate;
      limpar.push({ id: l.id, anotacoes: resto });
    });

    if (limpar.length === 0) return false;
    if (novos.length > 0) {
      const { data: existentes, error: erroBusca } = await cfg.client
        .from("itens_cronograma")
        .select("origem_externa_id")
        .eq("user_id", userId)
        .like("origem_externa_id", "legado:%");
      if (erroBusca) return false;
      const ja = new Set((existentes ?? []).map((e) => e.origem_externa_id as string));
      const faltam = novos.filter((n) => !ja.has(n.origem_externa_id as string));
      if (faltam.length > 0) {
        const { error } = await cfg.client.from("itens_cronograma").insert(faltam);
        // 23505: outra aba/aparelho migrou ao mesmo tempo; os itens já existem.
        if (error && error.code !== "23505") return false;
      }
    }
    const resultados = await Promise.all(
      limpar.map((d) => cfg.client.from("disciplinas").update({ anotacoes: d.anotacoes }).eq("id", d.id).eq("user_id", userId)),
    );
    return resultados.every((r) => !r.error);
  }

  async function buscar(): Promise<void> {
    const minha = geracao;
    const valida = () => minha === geracao;
    if (!(await cfg.temSessao())) {
      if (valida()) definir({ dados: null, userId: null, carregando: false });
      return;
    }

    definir({ carregando: true, erro: null });
    try {
      const userId = await cfg.obterUserId();
      if (!valida()) return;
      // Outra conta no mesmo aparelho: não mostra o cache da anterior nem por um instante.
      if (estado.dados && estado.userId !== userId) definir({ dados: null, userId });
      if (!userId) {
        const salvo = await cfg.storage.get(await cfg.chaveLocal());
        if (!valida()) return;
        definir({
          userId: null,
          local: true,
          dados: salvo ? (JSON.parse(salvo) as AgendaDados) : { disciplinas: [], compromissos: [] },
        });
        return;
      }

      const consultar = () =>
        Promise.all([
          cfg.client.from("disciplinas").select("id,nome,professor,anotacoes").eq("user_id", userId).order("created_at"),
          cfg.client
            .from("itens_cronograma")
            .select("id,nome,tipo,disciplina_id,data_inicio,data_fim,descricao,completed,origem_externa_id")
            .eq("user_id", userId)
            .order("data_inicio", { ascending: true }),
        ]);

      let [disc, itens] = await consultar();
      if (disc.data && (await migrarAvaliacoesAntigas(userId, disc.data as LinhaDisciplina[]))) {
        [disc, itens] = await consultar();
      }
      if (!valida()) return;
      if (disc.error || itens.error) throw disc.error ?? itens.error;

      definir({
        userId,
        local: false,
        dados: {
          disciplinas: (disc.data as LinhaDisciplina[]).map(deDisciplina),
          compromissos: ordenarCompromissos(
            (itens.data as LinhaItem[]).map(deLinha).filter((c): c is Compromisso => c !== null),
          ),
        },
      });
    } catch {
      if (valida()) definir({ erro: "Não foi possível carregar a agenda. Verifique sua conexão." });
    } finally {
      if (valida()) definir({ carregando: false });
    }
  }

  /** Recarrega a agenda (deduplica chamadas simultâneas). */
  function recarregarAgenda() {
    if (!emAndamento) emAndamento = buscar().finally(() => (emAndamento = null));
    return emAndamento;
  }

  /** Limpa o cache (ex.: ao sair da conta). */
  function limparAgenda() {
    geracao++;
    emAndamento = null;
    definir({ dados: null, userId: null, local: false, erro: null, carregando: false });
  }

  function atualizarLocal(fn: (d: AgendaDados) => AgendaDados) {
    if (!estado.dados) return;
    const dados = fn(estado.dados);
    definir({ dados });
    if (estado.local) salvarLocal(dados);
  }

  // ---------------------------------------------------------------------------
  // Operações
  // ---------------------------------------------------------------------------

  async function salvarCompromisso(form: CompromissoForm, id?: string): Promise<string | null> {
    const erro = validarCompromisso(form);
    if (erro) return erro;
    const linha = paraLinha(form);

    if (estado.local || !estado.userId) {
      const novo: Compromisso = { ...form, id: id ?? gerarId(), concluido: false, origem: null };
      atualizarLocal((d) => ({
        ...d,
        compromissos: ordenarCompromissos(id ? d.compromissos.map((c) => (c.id === id ? { ...c, ...form } : c)) : [...d.compromissos, novo]),
      }));
      return null;
    }

    if (id) {
      const { error } = await cfg.client.from("itens_cronograma").update(linha).eq("id", id).eq("user_id", estado.userId);
      if (error) return "Não foi possível salvar. Tente novamente.";
      atualizarLocal((d) => ({
        ...d,
        compromissos: ordenarCompromissos(d.compromissos.map((c) => (c.id === id ? { ...c, ...form } : c))),
      }));
      return null;
    }

    const { data, error } = await cfg.client
      .from("itens_cronograma")
      .insert({ ...linha, user_id: estado.userId, completed: false })
      .select("id")
      .single();
    if (error || !data) return "Não foi possível salvar. Tente novamente.";
    atualizarLocal((d) => ({
      ...d,
      compromissos: ordenarCompromissos([...d.compromissos, { ...form, id: data.id as string, concluido: false, origem: null }]),
    }));
    return null;
  }

  async function excluirCompromisso(id: string) {
    if (!estado.local && estado.userId) {
      const { error } = await cfg.client.from("itens_cronograma").delete().eq("id", id).eq("user_id", estado.userId);
      if (error) return false;
    }
    atualizarLocal((d) => ({ ...d, compromissos: d.compromissos.filter((c) => c.id !== id) }));
    return true;
  }

  async function alternarConcluido(id: string) {
    const atual = estado.dados?.compromissos.find((c) => c.id === id);
    if (!atual) return;
    const concluido = !atual.concluido;
    atualizarLocal((d) => ({ ...d, compromissos: d.compromissos.map((c) => (c.id === id ? { ...c, concluido } : c)) }));
    if (!estado.local && estado.userId) {
      const { error } = await cfg.client.from("itens_cronograma").update({ completed: concluido }).eq("id", id).eq("user_id", estado.userId);
      if (error) atualizarLocal((d) => ({ ...d, compromissos: d.compromissos.map((c) => (c.id === id ? { ...c, concluido: !concluido } : c)) }));
    }
  }


  async function salvarDisciplina(form: DisciplinaForm, id?: string): Promise<string | null> {
    if (!form.nome.trim()) return "Informe o nome da disciplina.";
    for (const a of form.aulas) {
      if (!a.inicio || !a.fim) return "Preencha o início e o fim de cada aula.";
      if (a.fim <= a.inicio) return "Em cada aula, o fim deve ser depois do início.";
    }
    const limpo = { ...form, nome: form.nome.trim(), professor: form.professor.trim() };

    if (estado.local || !estado.userId) {
      const novo: DisciplinaAgenda = { ...limpo, id: id ?? gerarId() };
      atualizarLocal((d) => ({
        ...d,
        disciplinas: id ? d.disciplinas.map((x) => (x.id === id ? novo : x)) : [...d.disciplinas, novo],
      }));
      return null;
    }

    // Preserva chaves desconhecidas já gravadas no JSON da disciplina.
    let anotacoes: Record<string, unknown> = anotacoesDe(limpo);
    if (id) {
      const { data: atual } = await cfg.client.from("disciplinas").select("anotacoes").eq("id", id).maybeSingle();
      if (atual?.anotacoes && typeof atual.anotacoes === "object") anotacoes = { ...(atual.anotacoes as object), ...anotacoes };
    }
    const payload = { nome: limpo.nome, professor: limpo.professor || null, anotacoes, user_id: estado.userId };

    if (id) {
      const { error } = await cfg.client.from("disciplinas").update(payload).eq("id", id).eq("user_id", estado.userId);
      if (error) return "Não foi possível salvar. Tente novamente.";
      atualizarLocal((d) => ({ ...d, disciplinas: d.disciplinas.map((x) => (x.id === id ? { ...limpo, id } : x)) }));
      return null;
    }
    const { data, error } = await cfg.client.from("disciplinas").insert(payload).select("id").single();
    if (error || !data) return "Não foi possível salvar. Tente novamente.";
    atualizarLocal((d) => ({ ...d, disciplinas: [...d.disciplinas, { ...limpo, id: data.id as string }] }));
    return null;
  }

  async function excluirDisciplina(id: string) {
    if (!estado.local && estado.userId) {
      const { error } = await cfg.client.from("disciplinas").delete().eq("id", id).eq("user_id", estado.userId);
      if (error) return false;
    }
    atualizarLocal((d) => ({
      ...d,
      disciplinas: d.disciplinas.filter((x) => x.id !== id),
      // No banco a FK é "on delete set null": os compromissos ficam, sem disciplina.
      compromissos: d.compromissos.map((c) => (c.disciplinaId === id ? { ...c, disciplinaId: null } : c)),
    }));
    return true;
  }

  /**
   * Salva os blocos gerados pelo cronograma. Com `substituir`, apaga antes os blocos
   * gerados que ainda não aconteceram e não foram concluídos.
   */
  async function salvarBlocosCronograma(
    blocos: Array<{ disciplina_id: string; disciplina_nome: string; data_inicio: string; data_fim: string }>,
    substituir: boolean,
  ): Promise<string | null> {
    const agora = new Date();

    const novos: Compromisso[] = blocos.map((b) => {
      const ini = new Date(b.data_inicio);
      const fim = new Date(b.data_fim);
      return {
        id: gerarId(),
        titulo: `Estudo: ${b.disciplina_nome}`,
        tipo: "estudo",
        disciplinaId: b.disciplina_id,
        data: dataStr(ini),
        horaInicio: horaStr(ini),
        horaFim: horaStr(fim),
        notas: "",
        concluido: false,
        origem: "cronograma",
      };
    });

    if (!estado.local && estado.userId) {
      const userId = estado.userId;
      // Primeiro grava os novos: se falhar, o cronograma anterior continua intacto.
      const { error } = await cfg.client.from("itens_cronograma").insert(
        novos.map((c) => ({
          ...paraLinha(c),
          id: c.id,
          user_id: userId,
          completed: false,
          origem_externa_id: `cronograma:${c.id}`,
        })),
      );
      if (error) return "Não foi possível salvar o cronograma. Tente novamente.";

      if (substituir) {
        // Apaga no servidor (não pelo cache, que pode estar desatualizado) os blocos gerados
        // ainda por vir e não concluídos, exceto os que acabaram de ser criados.
        let consulta = cfg.client
          .from("itens_cronograma")
          .delete()
          .eq("user_id", userId)
          .eq("completed", false)
          .like("origem_externa_id", "cronograma:%")
          .gte("data_inicio", agora.toISOString());
        if (novos.length > 0) consulta = consulta.not("id", "in", `(${novos.map((c) => c.id).join(",")})`);
        const { error: erroApagar } = await consulta;
        await recarregarAgenda();
        if (erroApagar) return "Os novos blocos foram salvos, mas não foi possível apagar os anteriores.";
        return null;
      }
      atualizarLocal((d) => ({ ...d, compromissos: ordenarCompromissos([...d.compromissos, ...novos]) }));
      return null;
    }

    const remover = new Set(
      substituir
        ? (estado.dados?.compromissos ?? []).filter((c) => c.origem === "cronograma" && !c.concluido && intervaloDe(c).inicio >= agora).map((c) => c.id)
        : [],
    );
    atualizarLocal((d) => ({ ...d, compromissos: ordenarCompromissos([...d.compromissos.filter((c) => !remover.has(c.id)), ...novos]) }));
    return null;
  }

  return {
    obterEstado: () => estado,
    assinar: (f: () => void) => {
      ouvintes.add(f);
      return () => {
        ouvintes.delete(f);
      };
    },
    recarregarAgenda,
    limparAgenda,
    salvarCompromisso,
    excluirCompromisso,
    alternarConcluido,
    salvarDisciplina,
    excluirDisciplina,
    salvarBlocosCronograma,
  };
}

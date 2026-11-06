import { beforeEach, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  criarAgenda,
  formatarData,
  formatarHorario,
  gerarId,
  hojeStr,
  intervaloDe,
  ordenarCompromissos,
  proximasProvas,
  validarCompromisso,
  compromissoVazio,
  dataStr,
  deLinha,
  type AgendaConfig,
  type CompromissoForm,
} from './agenda';

// ---------------------------------------------------------------------------
// Supabase falso em memória: só o que a store usa (select/insert/update/delete + filtros).
// ---------------------------------------------------------------------------

type Linha = Record<string, unknown>;
type Filtro = (l: Linha) => boolean;

function criarBanco() {
  const tabelas: Record<string, Linha[]> = { disciplinas: [], itens_cronograma: [] };
  /** "tabela:operação" que devem falhar (ex.: "itens_cronograma:insert"). */
  const falhas = new Map<string, { code?: string; message: string }>();
  const chamadas: string[] = [];

  function construtor(tabela: string) {
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Linha | Linha[] | null = null;
    let devolverInseridos = false;
    let unico: 'single' | 'maybe' | null = null;
    const filtros: Filtro[] = [];

    const executar = () => {
      chamadas.push(`${tabela}:${op}`);
      const falha = falhas.get(`${tabela}:${op}`);
      if (falha) return { data: null, error: falha };
      const linhas = tabelas[tabela] ?? (tabelas[tabela] = []);
      const casam = () => linhas.filter((l) => filtros.every((f) => f(l)));
      let data: unknown = null;
      if (op === 'select') data = casam().map((l) => ({ ...l }));
      if (op === 'insert') {
        const novos = (Array.isArray(payload) ? payload : [payload!]).map((l) => ({ id: l.id ?? gerarId(), created_at: new Date().toISOString(), ...l }));
        for (const n of novos) {
          if (n.origem_externa_id && linhas.some((l) => l.user_id === n.user_id && l.origem_externa_id === n.origem_externa_id)) {
            return { data: null, error: { code: '23505', message: 'duplicado' } };
          }
        }
        linhas.push(...novos);
        data = devolverInseridos ? novos.map((n) => ({ id: n.id })) : null;
      }
      if (op === 'update') casam().forEach((l) => Object.assign(l, payload));
      if (op === 'delete') {
        const apagar = new Set(casam());
        tabelas[tabela] = linhas.filter((l) => !apagar.has(l));
      }
      if (unico && Array.isArray(data)) data = data[0] ?? null;
      return { data, error: null };
    };

    const b = {
      select(_cols?: string) {
        if (op === 'insert') devolverInseridos = true;
        return b;
      },
      insert(p: Linha | Linha[]) {
        op = 'insert';
        payload = p;
        return b;
      },
      update(p: Linha) {
        op = 'update';
        payload = p;
        return b;
      },
      delete() {
        op = 'delete';
        return b;
      },
      eq(k: string, v: unknown) {
        filtros.push((l) => l[k] === v);
        return b;
      },
      in(k: string, vs: unknown[]) {
        filtros.push((l) => vs.includes(l[k]));
        return b;
      },
      like(k: string, padrao: string) {
        const prefixo = padrao.replace(/%$/, '');
        filtros.push((l) => typeof l[k] === 'string' && (l[k] as string).startsWith(prefixo));
        return b;
      },
      gte(k: string, v: string) {
        filtros.push((l) => typeof l[k] === 'string' && new Date(l[k] as string) >= new Date(v));
        return b;
      },
      not(k: string, _op: 'in', lista: string) {
        const ids = lista.replace(/[()]/g, '').split(',');
        filtros.push((l) => !ids.includes(String(l[k])));
        return b;
      },
      order() {
        return b;
      },
      single() {
        unico = 'single';
        return b;
      },
      maybeSingle() {
        unico = 'maybe';
        return b;
      },
      then<T>(ok: (v: { data: unknown; error: unknown }) => T, erro?: (e: unknown) => T) {
        return Promise.resolve(executar()).then(ok, erro);
      },
    };
    return b;
  }

  const client = { from: (t: string) => construtor(t) } as unknown as SupabaseClient;
  return { tabelas, falhas, chamadas, client };
}

const USER = 'u1';

function montar(opcoes: { userId?: string | null; sessao?: boolean } = {}) {
  const banco = criarBanco();
  const memoria = new Map<string, string>();
  let userId: string | null = opcoes.userId === undefined ? USER : opcoes.userId;
  const cfg: AgendaConfig = {
    client: banco.client,
    obterUserId: async () => userId,
    temSessao: () => opcoes.sessao ?? true,
    chaveLocal: () => 'agenda_local',
    storage: { get: (k) => memoria.get(k) ?? null, set: (k, v) => void memoria.set(k, v) },
  };
  const agenda = criarAgenda(cfg);
  return { banco, memoria, agenda, trocarUsuario: (id: string | null) => (userId = id) };
}

const amanha = () => {
  const d = new Date();
  return dataStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
};

const form = (parcial: Partial<CompromissoForm> = {}): CompromissoForm => ({ ...compromissoVazio(amanha()), titulo: 'P1', tipo: 'prova', ...parcial });

describe('criarAgenda (store)', () => {
  let ctx: ReturnType<typeof montar>;
  beforeEach(() => {
    ctx = montar();
  });

  it('sem sessão não carrega nada', async () => {
    const { agenda } = montar({ sessao: false });
    await agenda.recarregarAgenda();
    expect(agenda.obterEstado().dados).toBeNull();
  });

  it('carrega disciplinas e compromissos do banco e avisa os ouvintes', async () => {
    ctx.banco.tabelas.disciplinas.push({ id: 'd1', nome: 'Cálculo', professor: null, anotacoes: { prioridade: 3, aulas: [{ dia_semana: 1, inicio: '19:00', fim: '20:40' }] }, user_id: USER });
    let avisos = 0;
    const sair = ctx.agenda.assinar(() => avisos++);
    await ctx.agenda.recarregarAgenda();
    sair();
    const { dados, local, userId } = ctx.agenda.obterEstado();
    expect(local).toBe(false);
    expect(userId).toBe(USER);
    expect(dados?.disciplinas[0]).toMatchObject({ nome: 'Cálculo', prioridade: 3, professor: '' });
    expect(dados?.disciplinas[0].aulas).toHaveLength(1);
    expect(avisos).toBeGreaterThan(0);
  });

  it('deduplica recargas simultâneas', async () => {
    await Promise.all([ctx.agenda.recarregarAgenda(), ctx.agenda.recarregarAgenda()]);
    expect(ctx.banco.chamadas.filter((c) => c === 'disciplinas:select')).toHaveLength(1);
  });

  it('erro do banco vira mensagem de erro', async () => {
    ctx.banco.falhas.set('itens_cronograma:select', { message: 'rede' });
    await ctx.agenda.recarregarAgenda();
    expect(ctx.agenda.obterEstado().erro).toMatch(/Não foi possível carregar/);
    expect(ctx.agenda.obterEstado().carregando).toBe(false);
  });

  it('cria, edita, conclui e exclui compromisso', async () => {
    await ctx.agenda.recarregarAgenda();
    expect(await ctx.agenda.salvarCompromisso(form({ titulo: '' }))).toMatch(/nome/);
    expect(await ctx.agenda.salvarCompromisso(form())).toBeNull();
    const [c] = ctx.agenda.obterEstado().dados!.compromissos;
    expect(ctx.banco.tabelas.itens_cronograma[0]).toMatchObject({ nome: 'P1', user_id: USER, completed: false });

    expect(await ctx.agenda.salvarCompromisso(form({ titulo: 'P1 remarcada', horaInicio: '10:00' }), c.id)).toBeNull();
    expect(ctx.agenda.obterEstado().dados!.compromissos[0]).toMatchObject({ titulo: 'P1 remarcada', horaInicio: '10:00' });

    await ctx.agenda.alternarConcluido(c.id);
    expect(ctx.agenda.obterEstado().dados!.compromissos[0].concluido).toBe(true);
    expect(ctx.banco.tabelas.itens_cronograma[0].completed).toBe(true);

    expect(await ctx.agenda.excluirCompromisso(c.id)).toBe(true);
    expect(ctx.agenda.obterEstado().dados!.compromissos).toHaveLength(0);
    expect(ctx.banco.tabelas.itens_cronograma).toHaveLength(0);
  });

  it('falhas ao salvar, concluir e excluir não mudam o cache de forma errada', async () => {
    await ctx.agenda.salvarCompromisso(form());
    await ctx.agenda.recarregarAgenda();
    await ctx.agenda.salvarCompromisso(form());
    const [c] = ctx.agenda.obterEstado().dados!.compromissos;

    ctx.banco.falhas.set('itens_cronograma:insert', { message: 'x' });
    expect(await ctx.agenda.salvarCompromisso(form())).toMatch(/Não foi possível/);
    ctx.banco.falhas.set('itens_cronograma:update', { message: 'x' });
    expect(await ctx.agenda.salvarCompromisso(form(), c.id)).toMatch(/Não foi possível/);
    await ctx.agenda.alternarConcluido(c.id);
    expect(ctx.agenda.obterEstado().dados!.compromissos[0].concluido).toBe(false);
    ctx.banco.falhas.set('itens_cronograma:delete', { message: 'x' });
    expect(await ctx.agenda.excluirCompromisso(c.id)).toBe(false);
    await ctx.agenda.alternarConcluido('inexistente');
  });

  it('salva, edita (preservando chaves desconhecidas) e exclui disciplina', async () => {
    await ctx.agenda.recarregarAgenda();
    const base = { nome: ' Física ', professor: ' Ana ', prioridade: 2 as const, aulas: [], notas: '' };
    expect(await ctx.agenda.salvarDisciplina({ ...base, nome: ' ' })).toMatch(/nome/);
    expect(await ctx.agenda.salvarDisciplina({ ...base, aulas: [{ dia_semana: 1, inicio: '', fim: '' }] })).toMatch(/início e o fim/);
    expect(await ctx.agenda.salvarDisciplina({ ...base, aulas: [{ dia_semana: 1, inicio: '20:00', fim: '19:00' }] })).toMatch(/depois/);
    expect(await ctx.agenda.salvarDisciplina(base)).toBeNull();
    const d = ctx.agenda.obterEstado().dados!.disciplinas[0];
    expect(d).toMatchObject({ nome: 'Física', professor: 'Ana' });

    (ctx.banco.tabelas.disciplinas[0].anotacoes as Linha).extra = 'manter';
    expect(await ctx.agenda.salvarDisciplina({ ...base, prioridade: 3 }, d.id)).toBeNull();
    expect(ctx.banco.tabelas.disciplinas[0].anotacoes).toMatchObject({ extra: 'manter', prioridade: 3 });

    await ctx.agenda.salvarCompromisso(form({ disciplinaId: d.id }));
    expect(await ctx.agenda.excluirDisciplina(d.id)).toBe(true);
    expect(ctx.agenda.obterEstado().dados!.disciplinas).toHaveLength(0);
    expect(ctx.agenda.obterEstado().dados!.compromissos[0].disciplinaId).toBeNull();

    ctx.banco.falhas.set('disciplinas:insert', { message: 'x' });
    expect(await ctx.agenda.salvarDisciplina(base)).toMatch(/Não foi possível/);
    ctx.banco.falhas.set('disciplinas:update', { message: 'x' });
    expect(await ctx.agenda.salvarDisciplina(base, 'qualquer')).toMatch(/Não foi possível/);
    ctx.banco.falhas.set('disciplinas:delete', { message: 'x' });
    expect(await ctx.agenda.excluirDisciplina('qualquer')).toBe(false);
  });

  it('migra provas antigas do JSON da disciplina uma única vez', async () => {
    ctx.banco.tabelas.disciplinas.push({
      id: 'd1',
      nome: 'Cálculo',
      professor: 'Rui',
      user_id: USER,
      anotacoes: { provas: [{ id: 'p1', nome: 'P1', data: '2026-12-01' }, { nome: 'sem data' }], workDate: '2026-12-05', startTime: '19:00' },
    });
    await ctx.agenda.recarregarAgenda();
    const itens = ctx.banco.tabelas.itens_cronograma;
    expect(itens).toHaveLength(2);
    expect(itens.map((i) => i.origem_externa_id)).toEqual(['legado:d1:prova:p1', expect.stringMatching(/^legado:d1:trabalho:/)]);
    expect(ctx.banco.tabelas.disciplinas[0].anotacoes).toEqual({ startTime: '19:00' });
    expect(ctx.agenda.obterEstado().dados!.compromissos.map((c) => c.tipo)).toEqual(['prova', 'trabalho']);

    // App antigo grava as provas de novo no JSON: não duplica.
    (ctx.banco.tabelas.disciplinas[0].anotacoes as Linha).provas = [{ id: 'p1', nome: 'P1', data: '2026-12-01' }];
    await ctx.agenda.recarregarAgenda();
    expect(ctx.banco.tabelas.itens_cronograma).toHaveLength(2);
  });

  it('migração com falha não limpa o JSON (tenta de novo depois)', async () => {
    ctx.banco.tabelas.disciplinas.push({ id: 'd1', nome: 'X', professor: null, user_id: USER, anotacoes: { examDate: '2026-12-01' } });
    ctx.banco.falhas.set('itens_cronograma:insert', { message: 'x' });
    await ctx.agenda.recarregarAgenda();
    expect(ctx.banco.tabelas.disciplinas[0].anotacoes).toEqual({ examDate: '2026-12-01' });
  });

  it('cronograma: substituir grava os novos e apaga só os gerados futuros não concluídos', async () => {
    const futuro = new Date(Date.now() + 86_400_000).toISOString();
    ctx.banco.tabelas.itens_cronograma.push(
      { id: 'g1', nome: 'Estudo: A', tipo: 'estudo', user_id: USER, completed: false, origem_externa_id: 'cronograma:g1', data_inicio: futuro, data_fim: futuro },
      { id: 'g2', nome: 'Estudo: A', tipo: 'estudo', user_id: USER, completed: true, origem_externa_id: 'cronograma:g2', data_inicio: futuro, data_fim: futuro },
      { id: 'm1', nome: 'Estudo: manual', tipo: 'estudo', user_id: USER, completed: false, origem_externa_id: null, data_inicio: futuro, data_fim: futuro },
    );
    await ctx.agenda.recarregarAgenda();
    const ini = new Date(Date.now() + 2 * 86_400_000);
    ini.setHours(19, 0, 0, 0);
    const bloco = { disciplina_id: 'd1', disciplina_nome: 'A', data_inicio: ini.toISOString(), data_fim: new Date(ini.getTime() + 50 * 60_000).toISOString() };

    expect(await ctx.agenda.salvarBlocosCronograma([bloco], true)).toBeNull();
    const ids = ctx.banco.tabelas.itens_cronograma.map((l) => l.id);
    expect(ids).toContain('g2');
    expect(ids).toContain('m1');
    expect(ids).not.toContain('g1');
    expect(ctx.agenda.obterEstado().dados!.compromissos.filter((c) => c.origem === 'cronograma')).toHaveLength(2);

    // Sem substituir: só acrescenta.
    expect(await ctx.agenda.salvarBlocosCronograma([bloco], false)).toBeNull();
    expect(ctx.banco.tabelas.itens_cronograma).toHaveLength(4);
  });

  it('cronograma: se gravar falhar, o anterior fica intacto', async () => {
    const futuro = new Date(Date.now() + 86_400_000).toISOString();
    ctx.banco.tabelas.itens_cronograma.push({ id: 'g1', nome: 'Estudo: A', tipo: 'estudo', user_id: USER, completed: false, origem_externa_id: 'cronograma:g1', data_inicio: futuro, data_fim: futuro });
    await ctx.agenda.recarregarAgenda();
    ctx.banco.falhas.set('itens_cronograma:insert', { message: 'x' });
    expect(await ctx.agenda.salvarBlocosCronograma([], true)).toMatch(/Não foi possível salvar/);
    expect(ctx.banco.tabelas.itens_cronograma).toHaveLength(1);

    ctx.banco.falhas.delete('itens_cronograma:insert');
    ctx.banco.falhas.set('itens_cronograma:delete', { message: 'x' });
    expect(await ctx.agenda.salvarBlocosCronograma([], true)).toMatch(/não foi possível apagar/);
  });

  it('modo local (sem Supabase): guarda tudo no armazenamento do aparelho', async () => {
    const { agenda, memoria } = montar({ userId: null });
    await agenda.recarregarAgenda();
    expect(agenda.obterEstado().local).toBe(true);
    await agenda.salvarDisciplina({ nome: 'Química', professor: '', prioridade: 1, aulas: [], notas: '' });
    const d = agenda.obterEstado().dados!.disciplinas[0];
    await agenda.salvarDisciplina({ ...d, nome: 'Química II' }, d.id);
    await agenda.salvarCompromisso(form({ disciplinaId: d.id }));
    const c = agenda.obterEstado().dados!.compromissos[0];
    await agenda.salvarCompromisso(form({ titulo: 'P2' }), c.id);
    await agenda.alternarConcluido(c.id);
    const ini = new Date(Date.now() + 86_400_000);
    await agenda.salvarBlocosCronograma([{ disciplina_id: d.id, disciplina_nome: 'Química II', data_inicio: ini.toISOString(), data_fim: ini.toISOString() }], true);
    await agenda.salvarBlocosCronograma([], true);
    await new Promise((r) => setTimeout(r, 0));
    const salvo = JSON.parse(memoria.get('agenda_local')!);
    expect(salvo.disciplinas[0].nome).toBe('Química II');
    expect(salvo.compromissos.find((x: { id: string }) => x.id === c.id)).toMatchObject({ titulo: 'P2', concluido: true });
    expect(salvo.compromissos.filter((x: { origem: string }) => x.origem === 'cronograma')).toHaveLength(0);
    await agenda.excluirCompromisso(c.id);
    await agenda.excluirDisciplina(d.id);
    expect(agenda.obterEstado().dados).toEqual({ disciplinas: [], compromissos: [] });

    // Recarrega do armazenamento local.
    const outra = montar({ userId: null });
    outra.memoria.set('agenda_local', JSON.stringify({ disciplinas: [{ id: 'x', nome: 'Y', professor: '', prioridade: 2, aulas: [], notas: '' }], compromissos: [] }));
    await outra.agenda.recarregarAgenda();
    expect(outra.agenda.obterEstado().dados!.disciplinas).toHaveLength(1);
  });

  it('limparAgenda descarta o cache e cargas em andamento de outra conta', async () => {
    ctx.banco.tabelas.disciplinas.push({ id: 'd1', nome: 'Da conta A', professor: null, anotacoes: {}, user_id: USER });
    const carga = ctx.agenda.recarregarAgenda();
    ctx.agenda.limparAgenda();
    await carga;
    expect(ctx.agenda.obterEstado().dados).toBeNull();

    await ctx.agenda.recarregarAgenda();
    expect(ctx.agenda.obterEstado().dados!.disciplinas).toHaveLength(1);
    ctx.trocarUsuario('u2');
    await ctx.agenda.recarregarAgenda();
    expect(ctx.agenda.obterEstado().userId).toBe('u2');
    expect(ctx.agenda.obterEstado().dados!.disciplinas).toHaveLength(0);
  });
});

describe('helpers da agenda', () => {
  it('formata datas, horários e ordena', () => {
    expect(formatarData('')).toBe('Sem data');
    expect(formatarData('2026-11-20')).toBe('20/11/2026');
    expect(formatarData('2026-11-20', true)).toBe('sex, 20/11/2026');
    expect(formatarHorario({ horaInicio: '10:00', horaFim: '' })).toBe('10:00');
    expect(formatarHorario({ horaInicio: '10:00', horaFim: '11:00' })).toBe('10:00 – 11:00');
    const a = { ...form(), id: 'a', concluido: false, origem: null, data: '2026-11-21' };
    const b = { ...form(), id: 'b', concluido: false, origem: null, data: '2026-11-20', horaInicio: '08:00' };
    expect(ordenarCompromissos([a, b]).map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('valida datas e horários do formulário', () => {
    expect(validarCompromisso(form({ data: 'x' }))).toMatch(/data/);
    expect(validarCompromisso(form({ horaFim: '10:00' }))).toMatch(/início/);
    expect(validarCompromisso(form({ horaInicio: '10:00', horaFim: '09:00' }))).toMatch(/depois/);
    expect(validarCompromisso(form())).toBeNull();
  });

  it('intervalo, próximas provas e gerarId', () => {
    expect(intervaloDe({ data: '2026-11-20', horaInicio: '10:00', horaFim: '' }).fim.getHours()).toBe(10);
    const hoje = hojeStr();
    const provas = proximasProvas([
      { ...form({ disciplinaId: 'd1', data: '2000-01-01' }), id: '1', concluido: false, origem: null },
      { ...form({ disciplinaId: 'd1', data: amanha() }), id: '2', concluido: false, origem: null },
      { ...form({ disciplinaId: 'd1', data: '2999-01-01' }), id: '3', concluido: false, origem: null },
    ]);
    expect(provas.get('d1')).toBe(amanha());
    expect(hoje < amanha()).toBe(true);
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    expect(gerarId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
  });

  it('deLinha: só prazo, gmail, linha inválida e 00:00 sem término', () => {
    const fim = new Date(2026, 10, 20, 18, 0).toISOString();
    expect(deLinha({ id: 'a', nome: 'x', tipo: 'entrega', disciplina_id: null, data_inicio: null, data_fim: fim, descricao: null, completed: null, origem_externa_id: 'gmail:1' })).toMatchObject({
      tipo: 'trabalho',
      horaInicio: '18:00',
      origem: 'gmail',
    });
    expect(deLinha({ id: 'b', nome: 'x', tipo: 'x', disciplina_id: null, data_inicio: null, data_fim: null, descricao: null, completed: null, origem_externa_id: null })).toBeNull();
    const meiaNoite = new Date(2026, 10, 20, 0, 0).toISOString();
    expect(deLinha({ id: 'c', nome: 'x', tipo: 'atividade', disciplina_id: null, data_inicio: meiaNoite, data_fim: meiaNoite, descricao: null, completed: null, origem_externa_id: null })!.horaInicio).toBe('00:00');
  });
});

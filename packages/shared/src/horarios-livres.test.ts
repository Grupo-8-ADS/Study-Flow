import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ERRO_CARREGAR_HORARIOS,
  adicionarHorarioLivre,
  carregarHorariosLivres,
  ordenarHorariosLivres,
  removerHorarioLivre,
  type HorarioLivre,
} from './horarios-livres';

type Erro = { message: string } | null;

/** Supabase falso só com rotinas_semanais. */
function banco(linhas: Record<string, unknown>[] = [], falhas: Partial<Record<'select' | 'insert' | 'delete', Erro>> = {}) {
  const chamadas: string[] = [];
  const client = {
    from: (t: string) => {
      if (t !== 'rotinas_semanais') throw new Error(t);
      return {
        select: () => ({
          eq: async () => (falhas.select ? { data: null, error: falhas.select } : { data: linhas, error: null }),
        }),
        insert: (v: Record<string, unknown>) => ({
          select: () => ({
            single: async () => {
              chamadas.push(`insert:${JSON.stringify(v)}`);
              return falhas.insert ? { data: null, error: falhas.insert } : { data: { id: 'novo' }, error: null };
            },
          }),
        }),
        delete: () => ({
          eq: (_c: string, id: string) => ({
            eq: async () => {
              chamadas.push(`delete:${id}`);
              return { error: falhas.delete ?? null };
            },
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;
  return { client, chamadas };
}

const h = (id: string, dia_semana: number, hora_inicio: string, hora_fim: string): HorarioLivre => ({ id, dia_semana, hora_inicio, hora_fim });

describe('horários livres (rotinas_semanais)', () => {
  it('carrega normalizando o tipo time e ordenando', async () => {
    const { client } = banco([
      { id: 'b', dia_semana: 3, hora_inicio: '08:00:00', hora_fim: '10:00:00' },
      { id: 'a', dia_semana: 1, hora_inicio: '19:00:00', hora_fim: '21:00:00' },
    ]);
    expect(await carregarHorariosLivres(client, 'u')).toEqual({ ok: true, horarios: [h('a', 1, '19:00', '21:00'), h('b', 3, '08:00', '10:00')] });
  });

  it('falha ao carregar vira erro para a tela (sem cair para armazenamento local)', async () => {
    expect(await carregarHorariosLivres(banco([], { select: { message: 'x' } }).client, 'u')).toEqual({ ok: false, erros: [ERRO_CARREGAR_HORARIOS] });
  });

  it('adiciona validando campos vazios e sobreposição antes de gravar', async () => {
    const { client, chamadas } = banco();
    const atuais = [h('a', 1, '19:00', '21:00')];
    expect(await adicionarHorarioLivre(client, 'u', atuais, { dia_semana: 1, hora_inicio: '', hora_fim: '20:00' })).toEqual({
      ok: false,
      erros: ['Informe o horário de início e o de fim.'],
    });
    const sobreposto = await adicionarHorarioLivre(client, 'u', atuais, { dia_semana: 1, hora_inicio: '20:00', hora_fim: '22:00' });
    expect(sobreposto.ok).toBe(false);
    expect(chamadas).toEqual([]);

    const r = await adicionarHorarioLivre(client, 'u', atuais, { dia_semana: 0, hora_inicio: '09:00', hora_fim: '11:00' });
    expect(r).toEqual({ ok: true, horarios: [h('novo', 0, '09:00', '11:00'), ...atuais] });
    expect(chamadas[0]).toContain('"user_id":"u"');
  });

  it('erros do banco viram mensagens', async () => {
    const falho = banco([], { insert: { message: 'x' }, delete: { message: 'x' } });
    expect(await adicionarHorarioLivre(falho.client, 'u', [], { dia_semana: 2, hora_inicio: '08:00', hora_fim: '09:00' })).toMatchObject({ ok: false });
    expect(await removerHorarioLivre(falho.client, 'u', [h('a', 1, '08:00', '09:00')], 'a')).toMatchObject({ ok: false });
  });

  it('remove só o horário escolhido', async () => {
    const { client, chamadas } = banco();
    const r = await removerHorarioLivre(client, 'u', [h('a', 1, '08:00', '09:00'), h('b', 2, '08:00', '09:00')], 'a');
    expect(r).toEqual({ ok: true, horarios: [h('b', 2, '08:00', '09:00')] });
    expect(chamadas).toEqual(['delete:a']);
    expect(ordenarHorariosLivres([h('x', 2, '10:00', '11:00'), h('y', 2, '08:00', '09:00')]).map((x) => x.id)).toEqual(['y', 'x']);
  });
});

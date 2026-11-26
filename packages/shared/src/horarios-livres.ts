/**
 * Horários livres para estudar (tabela rotinas_semanais): leitura, inclusão e remoção com
 * a mesma validação no site e no app. É a base do gerador de cronograma.
 * @packageDocumentation
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { validarRotina, type RotinaSlot } from './scheduler';

export type HorarioLivre = RotinaSlot & { id: string };

/** Resultado das operações: a lista atualizada ou as mensagens para a tela. */
export type ResultadoHorariosLivres = { ok: true; horarios: HorarioLivre[] } | { ok: false; erros: string[] };

/** Normaliza "19:00:00" (tipo time do Postgres) para "19:00". */
const hhmm = (valor: string) => String(valor).slice(0, 5);

/** Em ordem de dia da semana e horário de início. */
export const ordenarHorariosLivres = (lista: HorarioLivre[]) =>
  [...lista].sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio));

export const ERRO_CARREGAR_HORARIOS = 'Não foi possível carregar seus horários livres. Verifique a conexão e tente novamente.';

export async function carregarHorariosLivres(client: SupabaseClient, userId: string): Promise<ResultadoHorariosLivres> {
  const { data, error } = await client.from('rotinas_semanais').select('id,dia_semana,hora_inicio,hora_fim').eq('user_id', userId);
  if (error) return { ok: false, erros: [ERRO_CARREGAR_HORARIOS] };
  const linhas = (data ?? []) as Array<{ id: string; dia_semana: number; hora_inicio: string; hora_fim: string }>;
  return {
    ok: true,
    horarios: ordenarHorariosLivres(linhas.map((r) => ({ id: r.id, dia_semana: r.dia_semana, hora_inicio: hhmm(r.hora_inicio), hora_fim: hhmm(r.hora_fim) }))),
  };
}

/** Valida o novo horário junto com os atuais (sem sobreposição) e grava. */
export async function adicionarHorarioLivre(
  client: SupabaseClient,
  userId: string,
  atuais: HorarioLivre[],
  novo: RotinaSlot,
): Promise<ResultadoHorariosLivres> {
  if (!novo.hora_inicio || !novo.hora_fim) return { ok: false, erros: ['Informe o horário de início e o de fim.'] };
  const slot: RotinaSlot = { dia_semana: novo.dia_semana, hora_inicio: novo.hora_inicio, hora_fim: novo.hora_fim };
  const erros = validarRotina([...atuais, slot]);
  if (erros.length > 0) return { ok: false, erros };

  const { data, error } = await client.from('rotinas_semanais').insert({ user_id: userId, ...slot }).select('id').single();
  if (error || !data) return { ok: false, erros: ['Não foi possível salvar o horário. Tente novamente.'] };
  return { ok: true, horarios: ordenarHorariosLivres([...atuais, { ...slot, id: (data as { id: string }).id }]) };
}

export async function removerHorarioLivre(client: SupabaseClient, userId: string, atuais: HorarioLivre[], id: string): Promise<ResultadoHorariosLivres> {
  const { error } = await client.from('rotinas_semanais').delete().eq('id', id).eq('user_id', userId);
  if (error) return { ok: false, erros: ['Não foi possível remover o horário. Tente novamente.'] };
  return { ok: true, horarios: atuais.filter((h) => h.id !== id) };
}

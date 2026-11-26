-- Traz para as migrations o que foi feito direto em produção (SQL Editor) e não estava
-- versionado, para que um banco montado só pelas migrations fique igual a produção.
-- Tudo é idempotente: em produção esta migration não muda nada.

-- 1) search_path fixo em set_updated_at (ajuste do Security Advisor aplicado à mão).
alter function public.set_updated_at() set search_path = public;

-- 2) A migration 20261106000200 renomeou "Especialista em História I" pelo id que a
--    conquista tem em produção; em bancos novos o id é outro e nada mudava. Aqui o
--    ajuste é pelo nome (que é único).
update public.user_conquistas uc
   set detalhe = 'História'
  from public.conquistas c
 where uc.conquista_id = c.id
   and c.nome = 'Especialista em História I'
   and uc.detalhe is null;

update public.conquistas
   set nome = 'Especialista em {disciplina}',
       descricao = 'Conclua 5 sessões na sua disciplina mais estudada.',
       criterio = '{"type":"top_subject_sessions","target":5}'::jsonb,
       icone = 'book',
       tier = 1
 where nome = 'Especialista em História I';

-- 3) Conquistas cadastradas direto em produção, que a 20261106000200 já esperava existir
--    (ela só ajustava o tier delas).
insert into public.conquistas (nome, descricao, criterio, pontos_recompensa, icone, category, tier)
values
  ('Sequência de Foco', 'Estude por cinco dias consecutivos.', '{"type":"streak","target":5}'::jsonb, 200, 'flame', 'perfil', 2),
  ('Explorador de Disciplinas', 'Registre estudos em cinco disciplinas diferentes.', '{"type":"unique_subjects","target":5}'::jsonb, 180, 'book', 'disciplina', 2)
on conflict (nome) do nothing;

-- 4) Avisos de prazo todo dia às 08:00 de Brasília (11:00 UTC), agendados à mão em produção.
--    Roda como postgres (dono das tabelas), então cobre todos os usuários. Só onde o pg_cron
--    existe: no Supabase sempre; nos bancos de teste locais (PGlite/Postgres puro) não.
--    cron.schedule com o mesmo nome atualiza o job existente em vez de duplicar.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('studyflow-prazos-diario', '0 11 * * *', 'select public.gerar_notificacoes_prazos()');
  end if;
end $$;

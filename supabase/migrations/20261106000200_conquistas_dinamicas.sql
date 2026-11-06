-- Conquistas dinâmicas e critérios que faltavam.
--
-- 1) O trigger só sabia avaliar sessions_completed, study_minutes e subject_progress:
--    "Sequência de Foco" (streak) e "Explorador de Disciplinas" (unique_subjects) nunca
--    eram concedidas. A avaliação vai para public.avaliar_conquistas e passa a cobrir
--    streak (dias seguidos no fuso de São Paulo), unique_subjects e top_subject_sessions.
-- 2) top_subject_sessions conta as sessões da disciplina mais estudada do usuário; o nome
--    usa o marcador {disciplina} ("Especialista em {disciplina}") e a disciplina do
--    momento do desbloqueio fica em user_conquistas.detalhe.
-- 3) "Especialista em História I" (fixa numa disciplina) vira "Especialista em {disciplina}",
--    mantendo o id para quem já a desbloqueou.
-- 4) Novas conquistas em três níveis (tier 1 bronze, 2 prata, 3 ouro) e concessão
--    retroativa para quem já cumpre os critérios.

alter table public.conquistas add column if not exists tier smallint not null default 1;
alter table public.user_conquistas add column if not exists detalhe text;

-- Quem já tinha a de História mantém o nome que ganhou.
update public.user_conquistas
   set detalhe = 'História'
 where conquista_id = 'fa611cf8-3bdb-413d-8311-3666ea48d61a' and detalhe is null;

update public.conquistas
   set nome = 'Especialista em {disciplina}',
       descricao = 'Conclua 5 sessões na sua disciplina mais estudada.',
       criterio = '{"type":"top_subject_sessions","target":5}'::jsonb,
       icone = 'book',
       tier = 1
 where id = 'fa611cf8-3bdb-413d-8311-3666ea48d61a';

update public.conquistas set tier = 1 where nome in ('Foco inicial', 'Estudante dedicado');
update public.conquistas set tier = 2 where nome in ('Mestre do Tempo', 'Sequência de Foco', 'Explorador de Disciplinas');

insert into public.conquistas (nome, descricao, criterio, pontos_recompensa, icone, category, tier)
select v.nome, v.descricao, v.criterio::jsonb, v.pontos, v.icone, v.categoria, v.tier
from (values
  ('Persistente', 'Conclua 25 sessões de foco.', '{"type":"sessions_completed","target":25}', 200, 'target', 'perfil', 2),
  ('Centurião', 'Conclua 100 sessões de foco.', '{"type":"sessions_completed","target":100}', 500, 'trophy', 'perfil', 3),
  ('Maratonista', 'Acumule 50 horas de estudo.', '{"type":"study_minutes","target":3000}', 600, 'mountain', 'perfil', 3),
  ('Hábito de Ferro', 'Estude por quinze dias seguidos.', '{"type":"streak","target":15}', 400, 'flame', 'perfil', 3),
  ('Primeiros Passos', 'Estude três dias seguidos.', '{"type":"streak","target":3}', 60, 'footprints', 'perfil', 1),
  ('Curioso', 'Registre estudos em três disciplinas diferentes.', '{"type":"unique_subjects","target":3}', 80, 'compass', 'disciplina', 1),
  ('Veterano em {disciplina}', 'Conclua 15 sessões na sua disciplina mais estudada.', '{"type":"top_subject_sessions","target":15}', 250, 'graduation', 'disciplina', 2),
  ('Mestre em {disciplina}', 'Conclua 40 sessões na sua disciplina mais estudada.', '{"type":"top_subject_sessions","target":40}', 500, 'crown', 'disciplina', 3)
) as v(nome, descricao, criterio, pontos, icone, categoria, tier)
where not exists (select 1 from public.conquistas c where c.nome = v.nome);

/**
 * Concede ao usuário as conquistas cujo critério já foi cumprido. Devolve o XP de bônus
 * das conquistas recém-concedidas (o chamador soma ao perfil).
 */
create or replace function public.avaliar_conquistas(p_user uuid, p_notificar boolean)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sessoes integer;
  v_minutos integer;
  v_unicas integer;
  v_top integer := 0;
  v_top_nome text;
  v_streak integer := 0;
  v_progresso integer;
  v_bonus integer := 0;
  v_nome text;
  v_conquista record;
begin
  select count(*), coalesce(sum(duracao_efetiva_min), 0), count(distinct disciplina_id)
    into v_sessoes, v_minutos, v_unicas
  from public.sessoes_estudo
  where user_id = p_user and xp_creditado;

  select d.nome, count(*)
    into v_top_nome, v_top
  from public.sessoes_estudo s
  join public.disciplinas d on d.id = s.disciplina_id
  where s.user_id = p_user and s.xp_creditado
  group by d.id, d.nome
  order by count(*) desc, min(s.data_inicio)
  limit 1;
  v_top := coalesce(v_top, 0);

  -- Maior sequência de dias seguidos (no fuso de São Paulo), mesmo já quebrada: quem
  -- fez 15 dias em outubro ganha a conquista mesmo sem estudar hoje.
  with dias as (
    select distinct (coalesce(data_inicio, created_at) at time zone 'America/Sao_Paulo')::date as d
    from public.sessoes_estudo
    where user_id = p_user and xp_creditado
  ), grupos as (
    select d, d - (row_number() over (order by d))::integer as grupo from dias
  )
  select max(n) into v_streak
  from (select count(*) as n from grupos group by grupo) as sequencias;
  v_streak := coalesce(v_streak, 0);

  for v_conquista in
    select c.id, c.nome, c.criterio, c.pontos_recompensa
    from public.conquistas c
    where not exists (
      select 1 from public.user_conquistas uc
      where uc.user_id = p_user and uc.conquista_id = c.id
    )
    order by c.created_at, c.nome
  loop
    v_progresso := case v_conquista.criterio ->> 'type'
      when 'sessions_completed' then v_sessoes
      when 'study_minutes' then v_minutos
      when 'unique_subjects' then v_unicas
      when 'streak' then v_streak
      when 'top_subject_sessions' then v_top
      when 'subject_progress' then (
        select count(*)::integer
        from public.sessoes_estudo s
        join public.disciplinas d on d.id = s.disciplina_id
        where s.user_id = p_user
          and s.xp_creditado
          and lower(d.nome) = lower(v_conquista.criterio ->> 'subject')
      )
      else 0
    end;

    if v_progresso >= coalesce((v_conquista.criterio ->> 'target')::integer, 1) then
      insert into public.user_conquistas (user_id, conquista_id, detalhe)
      values (
        p_user,
        v_conquista.id,
        case when v_conquista.criterio ->> 'type' = 'top_subject_sessions' then v_top_nome end
      )
      on conflict do nothing;

      if found then
        v_bonus := v_bonus + coalesce(v_conquista.pontos_recompensa, 0);
        v_nome := replace(v_conquista.nome, '{disciplina}', coalesce(v_top_nome, 'sua disciplina'));
        update public.profiles set last_achievement = v_nome where id = p_user;
        if p_notificar then
          insert into public.notificacoes (user_id, mensagem, tipo_evento)
          values (p_user, 'Conquista desbloqueada: ' || v_nome, 'conquista');
        end if;
      end if;
    end if;
  end loop;

  return v_bonus;
end;
$$;

revoke execute on function public.avaliar_conquistas(uuid, boolean) from public, anon, authenticated;

create or replace function public.processar_sessao_concluida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notifica boolean;
  v_bonus integer;
begin
  -- Credita só na primeira vez em que a sessão vira concluída.
  if not new.xp_creditado or (tg_op = 'UPDATE' and old.xp_creditado) then
    return new;
  end if;

  -- Serializa por usuário: sessões concluídas ao mesmo tempo contam na ordem certa.
  select recebe_notificacao_pref into v_notifica
  from public.profiles where id = new.user_id
  for update;

  v_bonus := public.avaliar_conquistas(new.user_id, coalesce(v_notifica, true));

  update public.profiles
     set xp = xp + new.exp + v_bonus,
         nivel_atual = public.nivel_por_xp(xp + new.exp + v_bonus)
   where id = new.user_id;

  return new;
end;
$$;

revoke execute on function public.processar_sessao_concluida() from public, anon, authenticated;

-- Concessão retroativa (sem notificação) para quem já cumpre os critérios.
do $$
declare
  v_user uuid;
  v_bonus integer;
begin
  for v_user in select distinct user_id from public.sessoes_estudo where xp_creditado loop
    perform 1 from public.profiles where id = v_user for update;
    v_bonus := public.avaliar_conquistas(v_user, false);
    if v_bonus > 0 then
      update public.profiles
         set xp = xp + v_bonus,
             nivel_atual = public.nivel_por_xp(xp + v_bonus)
       where id = v_user;
    end if;
  end loop;
end;
$$;

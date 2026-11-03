-- Regras de negócio no banco: valem igual para o web e o mobile.
-- RF003 (login por username), RNF001 (exclusão de conta), RF004 (XP e conquistas),
-- RF010 (notificações de prazo) e RF012 (armazenamento seguro do token do Gmail).

-- RF003: devolve só o e-mail do perfil, sem expor a tabela profiles ao anon.
drop function if exists public.get_email_by_username(text);
create function public.get_email_by_username(login_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.email
  from public.profiles p
  where lower(p.username) = lower(trim(login_username))
    and not p.deleted
  limit 1;
$$;

revoke all on function public.get_email_by_username(text) from public;
grant execute on function public.get_email_by_username(text) to anon, authenticated;

-- RNF001 (LGPD): o próprio usuário apaga a conta. O cascade de auth.users -> profiles
-- -> tabelas do usuário remove todos os dados pessoais.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado' using errcode = '42501';
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- RF004: nível a partir do XP (100 XP por nível, começando no nível 1).
create or replace function public.nivel_por_xp(p_xp integer)
returns integer
language sql
immutable
as $$
  select floor(greatest(coalesce(p_xp, 0), 0) / 100.0)::integer + 1;
$$;

-- RF004: ao concluir uma sessão, soma o XP, concede as conquistas cujo critério foi
-- atingido (com o bônus de pontos de cada uma) e avisa o usuário.
create or replace function public.processar_sessao_concluida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sessoes integer;
  v_minutos integer;
  v_progresso integer;
  v_bonus integer := 0;
  v_notifica boolean;
  v_conquista record;
begin
  if new.status <> 'concluida' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'concluida' then
    return new;
  end if;

  select count(*), coalesce(sum(duracao_efetiva_min), 0)
    into v_sessoes, v_minutos
  from public.sessoes_estudo
  where user_id = new.user_id and status = 'concluida';

  select recebe_notificacao_pref into v_notifica
  from public.profiles where id = new.user_id;

  for v_conquista in
    select c.id, c.nome, c.criterio, c.pontos_recompensa
    from public.conquistas c
    where not exists (
      select 1 from public.user_conquistas uc
      where uc.user_id = new.user_id and uc.conquista_id = c.id
    )
    order by c.created_at, c.nome
  loop
    v_progresso := case v_conquista.criterio ->> 'type'
      when 'sessions_completed' then v_sessoes
      when 'study_minutes' then v_minutos
      when 'subject_progress' then (
        select count(*)::integer
        from public.sessoes_estudo s
        join public.disciplinas d on d.id = s.disciplina_id
        where s.user_id = new.user_id
          and s.status = 'concluida'
          and lower(d.nome) = lower(v_conquista.criterio ->> 'subject')
      )
      else 0
    end;

    if v_progresso >= coalesce((v_conquista.criterio ->> 'target')::integer, 1) then
      insert into public.user_conquistas (user_id, conquista_id)
      values (new.user_id, v_conquista.id)
      on conflict do nothing;

      if found then
        v_bonus := v_bonus + coalesce(v_conquista.pontos_recompensa, 0);
        update public.profiles set last_achievement = v_conquista.nome where id = new.user_id;
        if coalesce(v_notifica, true) then
          insert into public.notificacoes (user_id, mensagem, tipo_evento)
          values (new.user_id, 'Conquista desbloqueada: ' || v_conquista.nome, 'conquista');
        end if;
      end if;
    end if;
  end loop;

  update public.profiles
     set xp = xp + greatest(coalesce(new.exp, 0), 0) + v_bonus,
         nivel_atual = public.nivel_por_xp(xp + greatest(coalesce(new.exp, 0), 0) + v_bonus)
   where id = new.user_id;

  return new;
end;
$$;

drop trigger if exists on_sessao_concluida on public.sessoes_estudo;
create trigger on_sessao_concluida
after insert or update of status on public.sessoes_estudo
for each row execute function public.processar_sessao_concluida();

-- RF010: avisos de prazo (prova, trabalho, entrega ou atividade) que vencem em até 3 dias.
-- Chamada pelo app (gera só para o usuário logado) e pelo agendamento diário (todos).
create unique index if not exists uq_notificacoes_item_evento
  on public.notificacoes (user_id, item_id, tipo_evento)
  where item_id is not null;

create or replace function public.gerar_notificacoes_prazos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  insert into public.notificacoes (user_id, item_id, mensagem, tipo_evento)
  select
    i.user_id,
    i.id,
    initcap(i.tipo) || ' "' || i.nome || '" '
      || case
           when (coalesce(i.data_fim, i.data_inicio) at time zone 'America/Sao_Paulo')::date
                = (now() at time zone 'America/Sao_Paulo')::date then 'é hoje'
           else 'vence em ' || to_char(coalesce(i.data_fim, i.data_inicio) at time zone 'America/Sao_Paulo', 'DD/MM')
         end,
    'prazo'
  from public.itens_cronograma i
  join public.profiles p on p.id = i.user_id
  where (auth.uid() is null or i.user_id = auth.uid())
    and p.recebe_notificacao_pref
    and not p.deleted
    and not i.completed
    and lower(i.tipo) in ('prova', 'trabalho', 'entrega', 'atividade')
    and coalesce(i.data_fim, i.data_inicio) between now() and now() + interval '3 days'
  on conflict (user_id, item_id, tipo_evento) where item_id is not null do nothing;

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke all on function public.gerar_notificacoes_prazos() from public, anon;
grant execute on function public.gerar_notificacoes_prazos() to authenticated;

-- RF012: o refresh token do Gmail fica numa tabela sem policies (só o service role,
-- usado pelas rotas do servidor, acessa). O cliente vê apenas o status em sinc_gmail.
alter table public.sinc_gmail drop column if exists token_acesso;
create unique index if not exists uq_sinc_gmail_user on public.sinc_gmail (user_id);

create table if not exists public.sinc_gmail_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.sinc_gmail_tokens enable row level security;
revoke all on public.sinc_gmail_tokens from anon, authenticated;

-- RF012: itens importados de e-mails guardam o id da mensagem para não duplicar.
alter table public.itens_cronograma add column if not exists origem_externa_id text;
create unique index if not exists uq_itens_origem_externa
  on public.itens_cronograma (user_id, origem_externa_id)
  where origem_externa_id is not null;

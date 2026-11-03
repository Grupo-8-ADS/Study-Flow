-- Study Flow Supabase schema
-- Run this file in Supabase SQL Editor after creating the project.
-- It adapts the project documentation to Supabase Auth:
-- auth.users stores credentials; public.profiles stores app profile data.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.meta_status as enum ('pendente', 'em_andamento', 'feito', 'atrasado');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.avaliacao_tipo as enum ('prova', 'trabalho', 'outro');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.status_sessao as enum ('ativa', 'concluida', 'cancelada', 'pausada');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.email_localizacao as enum ('assunto', 'corpo', 'remetente', 'destinatario');
exception when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  username text not null unique,
  email text not null unique,
  avatar_url text,
  banner_url text,
  bg_color text not null default '#0F1C1D',
  recebe_notificacao_pref boolean not null default true,
  horas_diarias integer not null default 0,
  nivel_atual integer not null default 1,
  xp integer not null default 0,
  last_achievement text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table if not exists public.disciplinas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  nome text not null,
  professor text,
  data_inicio date,
  data_fim date,
  anotacoes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  disciplina_id uuid not null references public.disciplinas(id) on delete cascade,
  nome text not null,
  tipo public.avaliacao_tipo not null default 'prova',
  data_entrega date,
  anotacoes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topicos (
  id uuid primary key default gen_random_uuid(),
  disciplina_id uuid not null references public.disciplinas(id) on delete cascade,
  nome text not null,
  descricao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.metas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  descricao text not null,
  data_criacao date not null default current_date,
  data_prazo date,
  status public.meta_status not null default 'pendente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.itens_cronograma (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  disciplina_id uuid references public.disciplinas(id) on delete set null,
  topico_id uuid references public.topicos(id) on delete set null,
  nome text not null,
  tipo text not null default 'atividade',
  prioridade smallint not null default 0,
  data_inicio timestamptz,
  data_fim timestamptz,
  descricao text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sessoes_estudo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid references public.itens_cronograma(id) on delete set null,
  disciplina_id uuid references public.disciplinas(id) on delete set null,
  data_inicio timestamptz not null default now(),
  data_fim timestamptz,
  duracao_efetiva_min integer,
  numero_pausas integer not null default 0,
  status public.status_sessao not null default 'ativa',
  exp integer not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid references public.itens_cronograma(id) on delete set null,
  mensagem text not null,
  tipo_evento text,
  read_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.conquistas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  criterio jsonb not null default '{}'::jsonb,
  pontos_recompensa integer not null default 0,
  icone text,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_conquistas (
  user_id uuid not null references public.profiles(id) on delete cascade,
  conquista_id uuid not null references public.conquistas(id) on delete cascade,
  data_conquista timestamptz not null default now(),
  primary key (user_id, conquista_id)
);

create table if not exists public.palavras_chave (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  palavra text not null,
  localizacao public.email_localizacao not null,
  created_at timestamptz not null default now(),
  unique (user_id, palavra, localizacao)
);

create table if not exists public.sinc_gmail (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  data_ultima_sinc timestamptz,
  email_sinc text,
  is_sincronizacao_auto boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_disciplinas_user on public.disciplinas(user_id);
create index if not exists idx_itens_user on public.itens_cronograma(user_id);
create index if not exists idx_sessoes_user on public.sessoes_estudo(user_id);
create index if not exists idx_notificacoes_user on public.notificacoes(user_id);
create index if not exists idx_avaliacoes_disciplina on public.avaliacoes(disciplina_id);
create index if not exists idx_topicos_disciplina on public.topicos(disciplina_id);
create index if not exists idx_disciplinas_anotacoes_gin on public.disciplinas using gin(anotacoes);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_disciplinas_updated_at on public.disciplinas;
create trigger set_disciplinas_updated_at
before update on public.disciplinas
for each row execute function public.set_updated_at();

drop trigger if exists set_avaliacoes_updated_at on public.avaliacoes;
create trigger set_avaliacoes_updated_at
before update on public.avaliacoes
for each row execute function public.set_updated_at();

drop trigger if exists set_topicos_updated_at on public.topicos;
create trigger set_topicos_updated_at
before update on public.topicos
for each row execute function public.set_updated_at();

drop trigger if exists set_metas_updated_at on public.metas;
create trigger set_metas_updated_at
before update on public.metas
for each row execute function public.set_updated_at();

drop trigger if exists set_itens_updated_at on public.itens_cronograma;
create trigger set_itens_updated_at
before update on public.itens_cronograma
for each row execute function public.set_updated_at();

drop trigger if exists set_sessoes_updated_at on public.sessoes_estudo;
create trigger set_sessoes_updated_at
before update on public.sessoes_estudo
for each row execute function public.set_updated_at();

drop trigger if exists set_sinc_gmail_updated_at on public.sinc_gmail;
create trigger set_sinc_gmail_updated_at
before update on public.sinc_gmail
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.disciplinas enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.topicos enable row level security;
alter table public.metas enable row level security;
alter table public.itens_cronograma enable row level security;
alter table public.sessoes_estudo enable row level security;
alter table public.notificacoes enable row level security;
alter table public.conquistas enable row level security;
alter table public.user_conquistas enable row level security;
alter table public.palavras_chave enable row level security;
alter table public.sinc_gmail enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "disciplinas_all_own" on public.disciplinas;
create policy "disciplinas_all_own" on public.disciplinas
for all using (auth.uid() = disciplinas.user_id) with check (auth.uid() = disciplinas.user_id);

drop policy if exists "metas_all_own" on public.metas;
create policy "metas_all_own" on public.metas
for all using (auth.uid() = metas.user_id) with check (auth.uid() = metas.user_id);

drop policy if exists "itens_all_own" on public.itens_cronograma;
create policy "itens_all_own" on public.itens_cronograma
for all using (auth.uid() = itens_cronograma.user_id) with check (auth.uid() = itens_cronograma.user_id);

drop policy if exists "sessoes_all_own" on public.sessoes_estudo;
create policy "sessoes_all_own" on public.sessoes_estudo
for all using (auth.uid() = sessoes_estudo.user_id) with check (auth.uid() = sessoes_estudo.user_id);

drop policy if exists "notificacoes_all_own" on public.notificacoes;
create policy "notificacoes_all_own" on public.notificacoes
for all using (auth.uid() = notificacoes.user_id) with check (auth.uid() = notificacoes.user_id);

drop policy if exists "palavras_chave_all_own" on public.palavras_chave;
create policy "palavras_chave_all_own" on public.palavras_chave
for all using (auth.uid() = palavras_chave.user_id) with check (auth.uid() = palavras_chave.user_id);

drop policy if exists "sinc_gmail_all_own" on public.sinc_gmail;
create policy "sinc_gmail_all_own" on public.sinc_gmail
for all using (auth.uid() = sinc_gmail.user_id) with check (auth.uid() = sinc_gmail.user_id);

drop policy if exists "avaliacoes_all_own_disciplina" on public.avaliacoes;
create policy "avaliacoes_all_own_disciplina" on public.avaliacoes
for all
using (
  exists (
    select 1 from public.disciplinas d
    where d.id = avaliacoes.disciplina_id
      and d.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.disciplinas d
    where d.id = avaliacoes.disciplina_id
      and d.user_id = auth.uid()
  )
);

drop policy if exists "topicos_all_own_disciplina" on public.topicos;
create policy "topicos_all_own_disciplina" on public.topicos
for all
using (
  exists (
    select 1 from public.disciplinas d
    where d.id = topicos.disciplina_id
      and d.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.disciplinas d
    where d.id = topicos.disciplina_id
      and d.user_id = auth.uid()
  )
);

drop policy if exists "conquistas_select_authenticated" on public.conquistas;
create policy "conquistas_select_authenticated" on public.conquistas
for select using (auth.role() = 'authenticated');

drop policy if exists "user_conquistas_all_own" on public.user_conquistas;
create policy "user_conquistas_all_own" on public.user_conquistas
for all using (auth.uid() = user_conquistas.user_id) with check (auth.uid() = user_conquistas.user_id);

insert into public.conquistas (nome, descricao, criterio, pontos_recompensa, icone, category)
values
  ('Foco inicial', 'Conclua sua primeira sessão de estudo.', '{"type":"sessions_completed","target":1}', 50, 'timer', 'perfil'),
  ('Estudante dedicado', 'Conclua cinco sessões de foco.', '{"type":"sessions_completed","target":5}', 120, 'user', 'perfil'),
  ('Mestre do Tempo', 'Acumule dez horas de estudo.', '{"type":"study_minutes","target":600}', 250, 'clock', 'perfil'),
  ('Especialista em História I', 'Registre progresso em História.', '{"type":"subject_progress","subject":"História","target":1}', 100, 'book', 'disciplina')
on conflict (nome) do nothing;

-- RF006: Rotina semanal do usuario (horarios disponiveis para estudo).
create table if not exists public.rotinas_semanais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fim time not null,
  created_at timestamptz not null default now(),
  check (hora_fim > hora_inicio)
);

create index if not exists idx_rotinas_semanais_user on public.rotinas_semanais(user_id);

alter table public.rotinas_semanais enable row level security;

drop policy if exists "rotinas_semanais_all_own" on public.rotinas_semanais;
create policy "rotinas_semanais_all_own" on public.rotinas_semanais
for all using (auth.uid() = rotinas_semanais.user_id) with check (auth.uid() = rotinas_semanais.user_id);

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

-- RF010: gera os avisos de prazo todo dia às 08:00 (horário de Brasília = 11:00 UTC).
-- Só roda onde a extensão pg_cron existe (Supabase); bancos de teste pulam este passo.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'studyflow-prazos-diario',
      '0 11 * * *',
      'select public.gerar_notificacoes_prazos()'
    );
  end if;
end;
$$;

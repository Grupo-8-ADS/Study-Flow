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
  token_acesso text,
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

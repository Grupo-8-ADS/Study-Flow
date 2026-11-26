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

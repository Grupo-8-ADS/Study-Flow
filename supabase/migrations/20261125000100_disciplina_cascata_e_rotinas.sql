-- 1) Excluir uma disciplina remove da agenda o que é dela (provas, trabalhos, atividades
--    e blocos de estudo). Antes a FK era "on delete set null" e os itens ficavam órfãos
--    no calendário. As sessões de estudo continuam (set null), para não apagar o histórico.
alter table public.itens_cronograma drop constraint if exists itens_cronograma_disciplina_id_fkey;
alter table public.itens_cronograma
  add constraint itens_cronograma_disciplina_id_fkey
  foreign key (disciplina_id) references public.disciplinas(id) on delete cascade;

-- Itens que já ficaram órfãos por exclusões antigas de disciplina continuam no calendário
-- como compromissos avulsos: não há como saber de qual disciplina eram.

-- 2) Atividades fixas da rotina (trabalho, academia, curso...): como as aulas de uma
--    disciplina, têm horários que se repetem toda semana. O app mostra no calendário e o
--    gerador de cronograma não marca estudo por cima delas.
create table if not exists public.atividades_rotina (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 120),
  -- [{ "dia_semana": 0-6, "inicio": "HH:MM", "fim": "HH:MM" }]
  horarios jsonb not null default '[]'::jsonb check (jsonb_typeof(horarios) = 'array'),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_atividades_rotina_user on public.atividades_rotina(user_id);

alter table public.atividades_rotina enable row level security;

drop policy if exists "atividades_rotina_all_own" on public.atividades_rotina;
create policy "atividades_rotina_all_own" on public.atividades_rotina
for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop trigger if exists set_atividades_rotina_updated_at on public.atividades_rotina;
create trigger set_atividades_rotina_updated_at
before update on public.atividades_rotina
for each row execute function public.set_updated_at();

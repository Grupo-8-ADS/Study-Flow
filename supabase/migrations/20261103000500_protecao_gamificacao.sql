-- Proteção da gamificação (RF004) e do login por username (RF003), após revisão do PR #14.

-- 1) O cliente não pode mais escrever XP, nível nem conquistas.
--    profiles: o app só edita os dados de perfil; o resto é do banco (trigger).
revoke insert, update on public.profiles from anon, authenticated;
grant update (nome, username, email, avatar_url, banner_url, bg_color, recebe_notificacao_pref, horas_diarias)
  on public.profiles to authenticated;

--    user_conquistas: o usuário só lê as próprias conquistas; quem concede é o trigger.
drop policy if exists "user_conquistas_all_own" on public.user_conquistas;
drop policy if exists "user_conquistas_select_own" on public.user_conquistas;
create policy "user_conquistas_select_own" on public.user_conquistas
for select using (auth.uid() = user_conquistas.user_id);
revoke insert, update, delete on public.user_conquistas from anon, authenticated;

-- 2) O XP da sessão é calculado pelo banco (1 XP por minuto, até 240 por sessão)
--    e cada sessão credita XP uma única vez, mesmo que o status vá e volte.
alter table public.sessoes_estudo add column if not exists xp_creditado boolean not null default false;

create or replace function public.preparar_sessao_estudo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Depois de creditada, a sessão mantém o XP que já rendeu.
  if tg_op = 'UPDATE' and old.xp_creditado then
    new.exp := old.exp;
    new.xp_creditado := true;
    return new;
  end if;

  new.exp := least(greatest(coalesce(new.duracao_efetiva_min, 0), 0), 240);
  if tg_op = 'INSERT' then
    new.xp_creditado := new.status = 'concluida';
  else
    new.xp_creditado := old.xp_creditado or new.status = 'concluida';
  end if;
  return new;
end;
$$;

drop trigger if exists before_sessao_estudo on public.sessoes_estudo;
create trigger before_sessao_estudo
before insert or update on public.sessoes_estudo
for each row execute function public.preparar_sessao_estudo();

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
  -- Credita só na primeira vez em que a sessão vira concluída.
  if not new.xp_creditado or (tg_op = 'UPDATE' and old.xp_creditado) then
    return new;
  end if;

  -- Serializa por usuário: sessões concluídas ao mesmo tempo contam na ordem certa.
  select recebe_notificacao_pref into v_notifica
  from public.profiles where id = new.user_id
  for update;

  select count(*), coalesce(sum(duracao_efetiva_min), 0)
    into v_sessoes, v_minutos
  from public.sessoes_estudo
  where user_id = new.user_id and xp_creditado;

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
          and s.xp_creditado
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
     set xp = xp + new.exp + v_bonus,
         nivel_atual = public.nivel_por_xp(xp + new.exp + v_bonus)
   where id = new.user_id;

  return new;
end;
$$;

drop trigger if exists on_sessao_concluida on public.sessoes_estudo;
create trigger on_sessao_concluida
after insert or update of status on public.sessoes_estudo
for each row execute function public.processar_sessao_concluida();

revoke execute on function public.processar_sessao_concluida() from public, anon, authenticated;
revoke execute on function public.preparar_sessao_estudo() from public, anon, authenticated;

-- Sessões concluídas antes desta migration já tiveram o XP contado.
update public.sessoes_estudo set xp_creditado = true where status = 'concluida' and not xp_creditado;

-- 3) Username único sem diferenciar maiúsculas (o login por username usa lower()).
create unique index if not exists uq_profiles_username_lower on public.profiles (lower(username));

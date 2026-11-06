-- Recompensas cosméticas por nível (molduras do avatar e banners prontos).
-- O catálogo fica em packages/shared/src/recompensas.ts; aqui só os níveis mínimos,
-- para o banco recusar equipar algo ainda bloqueado.

alter table public.profiles add column if not exists moldura text;
grant update (moldura) on public.profiles to authenticated;

create or replace function public.validar_recompensas_perfil()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_nivel integer;
  v_minimo integer;
begin
  v_nivel := coalesce(new.nivel_atual, 1);

  if new.moldura is distinct from old.moldura and new.moldura is not null then
    v_minimo := case new.moldura
      when 'bronze' then 3
      when 'prata' then 6
      when 'ouro' then 10
      when 'esmeralda' then 15
      when 'aurora' then 25
    end;
    if v_minimo is null then
      raise exception 'Moldura desconhecida: %', new.moldura using errcode = '22023';
    end if;
    if v_nivel < v_minimo then
      raise exception 'Moldura % exige nível %', new.moldura, v_minimo using errcode = '42501';
    end if;
  end if;

  if new.banner_url is distinct from old.banner_url and new.banner_url like 'preset:%' then
    v_minimo := case substring(new.banner_url from 8)
      when 'floresta' then 1
      when 'oceano' then 3
      when 'por-do-sol' then 6
      when 'noite' then 10
      when 'aurora' then 15
      when 'dourado' then 25
    end;
    if v_minimo is null then
      raise exception 'Banner desconhecido: %', new.banner_url using errcode = '22023';
    end if;
    if v_nivel < v_minimo then
      raise exception 'Banner % exige nível %', new.banner_url, v_minimo using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_recompensas_perfil() from public, anon, authenticated;

drop trigger if exists before_profiles_recompensas on public.profiles;
create trigger before_profiles_recompensas
before update on public.profiles
for each row execute function public.validar_recompensas_perfil();

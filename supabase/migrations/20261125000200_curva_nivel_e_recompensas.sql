-- 1) Curva de nível progressiva (RF004). Antes: 100 XP por nível, fixo — com 1 XP por
--    minuto de foco, subia-se um nível a cada ~1h40 de estudo. Agora subir do nível n para
--    o n+1 custa 100·n XP; o total para chegar ao nível n é 50·n·(n−1):
--    nível 2 = 100 XP, 3 = 300, 5 = 1000, 10 = 4500, 16 = 12000.
--    Precisa bater com nivelPorXp/xpParaNivel em packages/shared/src/gamificacao.ts.
create or replace function public.nivel_por_xp(p_xp integer)
returns integer
language sql
immutable
set search_path = public
as $$
  -- Inverso de 50·n·(n−1): n = floor((1 + sqrt(1 + 8·xp/100)) / 2). Nas fronteiras o
  -- radicando é um quadrado perfeito, então a raiz é exata.
  select greatest(floor((1 + sqrt(1 + 8 * greatest(coalesce(p_xp, 0), 0) / 100.0)) / 2)::integer, 1);
$$;

-- 2) Recompensas por nível, rebalanceadas para a curva nova e com a moldura e o banner
--    desenhados pela equipe ("Formatura" e "Raposa no outono"). Os níveis precisam bater
--    com MOLDURAS/BANNERS em packages/shared/src/recompensas.ts.
create or replace function public.nivel_minimo_moldura(p_id text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_id
    when 'bronze' then 3
    when 'formatura' then 4
    when 'prata' then 6
    when 'ouro' then 8
    when 'esmeralda' then 12
    when 'aurora' then 16
  end;
$$;

create or replace function public.nivel_minimo_banner(p_id text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case p_id
    when 'floresta' then 1
    when 'raposa-outono' then 2
    when 'oceano' then 3
    when 'por-do-sol' then 5
    when 'noite' then 8
    when 'aurora' then 12
    when 'dourado' then 16
  end;
$$;

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
    v_minimo := public.nivel_minimo_moldura(new.moldura);
    if v_minimo is null then
      raise exception 'Moldura desconhecida: %', new.moldura using errcode = '22023';
    end if;
    if v_nivel < v_minimo then
      raise exception 'Moldura % exige nível %', new.moldura, v_minimo using errcode = '42501';
    end if;
  end if;

  if new.banner_url is distinct from old.banner_url and new.banner_url like 'preset:%' then
    v_minimo := public.nivel_minimo_banner(substring(new.banner_url from 8));
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

-- 3) Recalcula o nível de quem já tinha XP e desequipa o que ficou acima do nível novo.
update public.profiles
   set nivel_atual = public.nivel_por_xp(xp)
 where nivel_atual is distinct from public.nivel_por_xp(xp);

update public.profiles
   set moldura = null
 where moldura is not null
   and coalesce(public.nivel_minimo_moldura(moldura), 999) > nivel_atual;

update public.profiles
   set banner_url = null
 where banner_url like 'preset:%'
   and coalesce(public.nivel_minimo_banner(substring(banner_url from 8)), 999) > nivel_atual;

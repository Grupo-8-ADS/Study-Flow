-- Remove a versão antiga (não versionada) de get_email_by_username com dois parâmetros.
-- Convivendo com a nova, o PostgREST não consegue escolher a função (PGRST203),
-- e ela também não fixava o search_path.
drop function if exists public.get_email_by_username(text, text);

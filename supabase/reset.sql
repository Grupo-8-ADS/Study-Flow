-- Study Flow Supabase reset script for demo/dev projects.
-- WARNING: This deletes Study Flow tables and policies from the public schema.
-- Use only if this Supabase project has no real data you need to keep.

drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.sinc_gmail cascade;
drop table if exists public.palavras_chave cascade;
drop table if exists public.user_conquistas cascade;
drop table if exists public.conquistas cascade;
drop table if exists public.notificacoes cascade;
drop table if exists public.sessoes_estudo cascade;
drop table if exists public.itens_cronograma cascade;
drop table if exists public.metas cascade;
drop table if exists public.topicos cascade;
drop table if exists public.avaliacoes cascade;
drop table if exists public.disciplinas cascade;
drop table if exists public.profiles cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;

drop type if exists public.email_localizacao cascade;
drop type if exists public.status_sessao cascade;
drop type if exists public.avaliacao_tipo cascade;
drop type if exists public.meta_status cascade;

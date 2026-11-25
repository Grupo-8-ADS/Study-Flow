-- Ajustes apontados pelo Security Advisor do Supabase.

-- 1) Login por nome de usuário: a rota do servidor (POST /api/auth/entrar, com a chave
--    secreta) descobre o e-mail e já devolve a sessão. Antes, get_email_by_username era
--    executável por anon: qualquer pessoa descobria o e-mail de qualquer username.
revoke execute on function public.get_email_by_username(text) from public, anon, authenticated;
grant execute on function public.get_email_by_username(text) to service_role;

-- 2) gerar_notificacoes_prazos não precisa de privilégio elevado: chamada por um usuário,
--    as policies de itens_cronograma, profiles e notificacoes já a limitam aos dados dele
--    (o mesmo que o filtro por auth.uid() fazia). Chamada sem usuário (servidor ou agendador,
--    como dono das tabelas), continua cobrindo todos.
alter function public.gerar_notificacoes_prazos() security invoker;

-- 3) Exceções intencionais, documentadas no próprio banco.
comment on function public.delete_own_account() is
  'SECURITY DEFINER de propósito: apaga a linha do próprio usuário em auth.users (o cascade remove o resto). Só usa auth.uid().';
comment on table public.sinc_gmail_tokens is
  'RLS ligado e sem policies de propósito: só o servidor, com a chave secreta, lê e grava os tokens do Gmail.';

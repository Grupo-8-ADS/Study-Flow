-- Endurecimento apontado pelo Security Advisor do Supabase.
-- Funções de trigger não devem ser chamáveis como RPC (/rest/v1/rpc/...).
revoke execute on function public.processar_sessao_concluida() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- search_path fixo também na função auxiliar de nível.
alter function public.nivel_por_xp(integer) set search_path = public;

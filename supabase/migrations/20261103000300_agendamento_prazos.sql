-- RF010: gera os avisos de prazo todo dia às 08:00 (horário de Brasília = 11:00 UTC).
-- Só roda onde a extensão pg_cron existe (Supabase); bancos de teste pulam este passo.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'studyflow-prazos-diario',
      '0 11 * * *',
      'select public.gerar_notificacoes_prazos()'
    );
  end if;
end;
$$;

-- Agenda: passa a gravar instantes reais (com fuso) em itens_cronograma.
--
-- Até aqui o web gravava "2026-11-10T19:00:00" sem fuso, que o Postgres guarda como
-- 19:00 UTC (16:00 em Brasília). As telas liam a hora "crua" e mostravam 19:00, mas os
-- lembretes (gerar_notificacoes_prazos, em America/Sao_Paulo) viam o horário 3 h antes
-- e, para itens de 00:00, até o dia anterior.
--
-- Esta migração reinterpreta os horários já gravados como hora de Brasília, para que
-- continuem aparecendo iguais depois que o app passou a ler o horário local.
-- Rodar uma única vez, junto com o deploy do web que grava ISO com fuso.

update public.itens_cronograma
set
  data_inicio = case when data_inicio is null then null
                     else (data_inicio at time zone 'UTC') at time zone 'America/Sao_Paulo' end,
  data_fim    = case when data_fim is null then null
                     else (data_fim at time zone 'UTC') at time zone 'America/Sao_Paulo' end
where created_at < timestamptz '2026-11-06 10:40:00-03';

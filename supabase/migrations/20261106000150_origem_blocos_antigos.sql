-- Blocos de estudo gerados antes da marcação de origem (nome "Estudo: <disciplina>",
-- sem origem_externa_id) passam a ter a origem "cronograma:<id>". Assim a opção
-- "substituir" do cronograma apaga só blocos gerados, filtrando no servidor, sem
-- depender do nome (que um item criado à mão também poderia ter).
update public.itens_cronograma
   set origem_externa_id = 'cronograma:' || id
 where origem_externa_id is null
   and lower(tipo) = 'estudo'
   and nome like 'Estudo: %'
   and created_at < '2026-11-06 12:00:00-03';

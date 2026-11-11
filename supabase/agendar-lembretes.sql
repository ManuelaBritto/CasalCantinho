-- =====================================================================
-- Nosso Cantinho — agenda o envio dos lembretes a cada 5 minutos
--
-- 1. TROQUE o endereço abaixo pelo endereço do seu site.
-- 2. Rode no SQL Editor do Supabase (depois de calendario.sql). Pode rodar de novo.
--
-- O próprio Supabase passa a chamar https://SEU-SITE/api/lembretes de 5 em 5 minutos.
-- É isso que faz os lembretes do calendário e as cartinhas agendadas chegarem
-- na hora, mesmo com todo mundo com o site fechado.
--
-- Se der erro em "create extension", ative "pg_cron" e "pg_net" em
-- Database > Extensions e rode de novo.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'cantinho-lembretes';

select cron.schedule(
  'cantinho-lembretes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://casalcantinho.vercel.app/api/lembretes',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Conferir: select jobname, schedule, active from cron.job;
-- Ver as últimas chamadas: select status_code, content, created from net._http_response order by created desc limit 5;
-- Parar: select cron.unschedule('cantinho-lembretes');

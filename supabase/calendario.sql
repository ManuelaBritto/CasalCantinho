-- =====================================================================
-- Nosso Cantinho — Calendário do casal e cartinha agendada
-- Rode no SQL Editor do Supabase DEPOIS de pessoa-em-varios-casais.sql
-- e de aviso-atualizacao.sql (usa a mesma senha AVISO_SEGREDO).
-- Pode rodar de novo sem problema.
--
--  - Calendário: datas do casal (aniversário de namoro, aniversários, viagens...)
--    com lembrete na véspera (19h) e no dia (8h, ou 1 hora antes do horário).
--  - Cartinha agendada: quem recebe só consegue ver a cartinha a partir da hora
--    marcada (o banco esconde antes disso). Na hora, chega a notificação.
--
-- Os lembretes são enviados por /api/lembretes, que o próprio Supabase chama
-- a cada 5 minutos (ver supabase/agendar-lembretes.sql).
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- Datas do calendário ----------
create table if not exists public.eventos (
  id              uuid primary key default gen_random_uuid(),
  casal_id        uuid not null references public.casais (id) on delete cascade,
  criado_por      uuid default auth.uid() references auth.users (id) on delete set null,
  titulo          text not null check (length(btrim(titulo)) between 1 and 80),
  tipo            text not null default 'outro' check (tipo in ('namoro', 'aniversario', 'viagem', 'compromisso', 'outro')),
  data            date not null,
  hora            time,
  repete          text not null default 'nao' check (repete in ('nao', 'anual', 'mensal')),
  avisar_vespera  boolean not null default true,
  avisar_dia      boolean not null default true,
  nota            text check (nota is null or length(nota) <= 300),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index if not exists eventos_casal_idx on public.eventos (casal_id, data);

alter table public.eventos enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.eventos from anon';
    execute 'grant select, insert, update, delete on public.eventos to authenticated';
  end if;
end $$;

drop policy if exists "casal ve eventos" on public.eventos;
create policy "casal ve eventos" on public.eventos
  for select to authenticated using (casal_id in (select public.meus_casais()));
drop policy if exists "casal cria eventos" on public.eventos;
create policy "casal cria eventos" on public.eventos
  for insert to authenticated with check (casal_id in (select public.meus_casais()) and criado_por = auth.uid());
drop policy if exists "casal altera eventos" on public.eventos;
create policy "casal altera eventos" on public.eventos
  for update to authenticated using (casal_id in (select public.meus_casais())) with check (casal_id in (select public.meus_casais()));
drop policy if exists "casal apaga eventos" on public.eventos;
create policy "casal apaga eventos" on public.eventos
  for delete to authenticated using (casal_id in (select public.meus_casais()));

-- Próxima vez que a data acontece, a partir de "desde" (anual: mesmo dia todo ano; mensal: mesmo dia todo mês)
create or replace function public.dia_seguro(p_ano int, p_mes int, p_dia int)
returns date
language sql
immutable
as $$
  select (make_date(p_ano, p_mes, 1)
          + (least(p_dia, extract(day from (make_date(p_ano, p_mes, 1) + interval '1 month - 1 day'))::int) - 1))::date
$$;

create or replace function public.evento_ocorrencia(p_data date, p_repete text, p_desde date)
returns date
language plpgsql
immutable
as $$
declare
  c date;
begin
  if p_repete = 'nao' or p_data >= p_desde then return p_data; end if;
  if p_repete = 'anual' then
    c := public.dia_seguro(extract(year from p_desde)::int, extract(month from p_data)::int, extract(day from p_data)::int);
    if c < p_desde then
      c := public.dia_seguro(extract(year from p_desde)::int + 1, extract(month from p_data)::int, extract(day from p_data)::int);
    end if;
    return c;
  end if;
  -- mensal
  c := public.dia_seguro(extract(year from p_desde)::int, extract(month from p_desde)::int, extract(day from p_data)::int);
  if c < p_desde then
    c := public.dia_seguro(extract(year from (p_desde + interval '1 month'))::int, extract(month from (p_desde + interval '1 month'))::int, extract(day from p_data)::int);
  end if;
  return c;
end
$$;

-- ---------- Cartinha agendada: quem recebe só vê a partir da hora marcada ----------
create or replace function public.carta_liberada(p_dados jsonb, p_criado_por uuid)
returns boolean
language plpgsql
stable
as $$
begin
  if p_criado_por is not null and p_criado_por = auth.uid() then return true; end if;
  if p_dados is null or p_dados->>'agendadaPara' is null then return true; end if;
  return (p_dados->>'agendadaPara')::timestamptz <= now();
exception when others then
  return true;
end
$$;

drop policy if exists "casal le" on public.cartas;
create policy "casal le" on public.cartas
  for select to authenticated
  using (casal_id in (select public.meus_casais()) and public.carta_liberada(dados, criado_por));

-- ---------- Lembretes pendentes (chamado pelo servidor, com a senha AVISO_SEGREDO) ----------
create schema if not exists privado;
revoke all on schema privado from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema privado from anon, authenticated'; end if;
end $$;

create table if not exists privado.lembretes_enviados (
  chave      text primary key,
  enviado_em timestamptz not null default now()
);

create or replace function public.lembretes_pendentes(segredo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions, privado
as $$
declare
  agora timestamptz := now();
  hoje date := (agora at time zone 'America/Sao_Paulo')::date;
  hora_local time := (agora at time zone 'America/Sao_Paulo')::time;
  saida jsonb := '[]'::jsonb;
  r record;
  n int;
  quando text;
  ocorr date;
begin
  if to_regprocedure('privado.segredo_confere(text, text)') is null then
    raise exception 'Rode antes o arquivo supabase/aviso-atualizacao.sql.' using errcode = '22023';
  end if;
  if not privado.segredo_confere('aviso-atualizacao', segredo) then
    raise exception 'segredo inválido' using errcode = '28000';
  end if;

  -- 1) Cartinhas agendadas que chegaram na hora (até 2 dias de atraso)
  for r in
    select c.id, c.casal_id, c.dados->>'para' as para, coalesce(p.apelido, p.nome, c.dados->>'autor', '') as de_nome,
           (c.dados->>'agendadaPara') as quando_txt
    from public.cartas c
    left join public.perfis p on p.casal_id = c.casal_id and p.nome = c.dados->>'de'
    where c.dados->>'agendadaPara' is not null and c.dados->>'enviadaEm' is not null and c.dados->>'para' is not null
  loop
    begin
      if r.quando_txt::timestamptz > agora or r.quando_txt::timestamptz < agora - interval '2 days' then continue; end if;
    exception when others then continue;
    end;
    insert into privado.lembretes_enviados (chave) values ('carta:' || r.id || ':' || r.quando_txt) on conflict do nothing;
    get diagnostics n = row_count;
    if n = 0 then continue; end if;
    saida := saida || jsonb_build_array(jsonb_build_object(
      'tipo', 'carta', 'id', r.id, 'casal', r.casal_id, 'de_nome', r.de_nome,
      'inscricoes', coalesce((select jsonb_agg(jsonb_build_object('endpoint', i.endpoint, 'p256dh', i.p256dh, 'auth', i.auth))
                              from public.push_inscricoes i where i.casal_id = r.casal_id and i.perfil = r.para), '[]'::jsonb)));
  end loop;

  -- 2) Datas do calendário: véspera às 19h e no dia às 8h (ou 1 hora antes do horário)
  for r in select e.* from public.eventos e where e.avisar_vespera or e.avisar_dia loop
    ocorr := public.evento_ocorrencia(r.data, r.repete, hoje);
    quando := null;
    if r.avisar_dia and ocorr = hoje and hora_local >= (case
         when r.hora is null then time '08:00'
         when r.hora < time '01:00' then time '00:00'
         else r.hora - interval '1 hour' end) then
      quando := 'dia';
    elsif r.avisar_vespera and ocorr = hoje + 1 and hora_local >= time '19:00' then
      quando := 'vespera';
    end if;
    if quando is null then continue; end if;
    insert into privado.lembretes_enviados (chave) values ('evento:' || r.id || ':' || ocorr || ':' || quando) on conflict do nothing;
    get diagnostics n = row_count;
    if n = 0 then continue; end if;
    saida := saida || jsonb_build_array(jsonb_build_object(
      'tipo', 'evento', 'id', r.id, 'casal', r.casal_id, 'quando', quando, 'titulo', r.titulo, 'tipo_evento', r.tipo,
      'hora', to_char(r.hora, 'HH24:MI'), 'repete', r.repete,
      'anos', case when r.repete = 'anual' then extract(year from ocorr)::int - extract(year from r.data)::int end,
      'meses', case when r.repete = 'mensal' then ((extract(year from ocorr) - extract(year from r.data)) * 12 + extract(month from ocorr) - extract(month from r.data))::int end,
      'inscricoes', coalesce((select jsonb_agg(jsonb_build_object('endpoint', i.endpoint, 'p256dh', i.p256dh, 'auth', i.auth))
                              from public.push_inscricoes i where i.casal_id = r.casal_id), '[]'::jsonb)));
  end loop;

  -- Limpa o histórico antigo (mais de 60 dias)
  delete from privado.lembretes_enviados where enviado_em < agora - interval '60 days';
  return saida;
end
$$;

revoke all on function public.lembretes_pendentes(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.lembretes_pendentes(text) to anon, authenticated';
  end if;
end $$;

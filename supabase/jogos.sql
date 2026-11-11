-- =====================================================================
-- Nosso Cantinho — Diversão: jogo da velha, forca e Resposta do dia
-- Rode no SQL Editor do Supabase DEPOIS de pessoa-em-varios-casais.sql.
-- Pode rodar de novo sem problema.
--
-- Regras garantidas pelo banco (não dá para burlar mexendo no navegador):
--  - cada casal só vê os próprios jogos e respostas;
--  - no jogo da velha, só joga quem está na vez, e só em casa vazia;
--  - na forca, a palavra fica guardada à parte: quem adivinha só recebe as
--    letras que já acertou (a palavra inteira aparece quando o jogo acaba);
--  - na Resposta do dia, a resposta do outro só aparece depois que você
--    responde a sua (ou quando o dia acaba).
-- =====================================================================
create extension if not exists pgcrypto;

create schema if not exists privado;
revoke all on schema privado from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema privado from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on schema privado from authenticated'; end if;
end $$;

-- Perfil (nome interno) da pessoa logada num casal; null se ela não é desse casal
create or replace function public.meu_perfil_no_casal(p_casal uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nome from public.perfis where user_id = auth.uid() and casal_id = p_casal limit 1
$$;

create or replace function public.outro_perfil_no_casal(p_casal uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nome from public.perfis
  where casal_id = p_casal and user_id is distinct from auth.uid()
  order by nome limit 1
$$;

-- Dia de hoje no horário de Brasília (o mesmo para os dois)
create or replace function public.hoje_brasilia()
returns date
language sql
stable
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

revoke all on function public.meu_perfil_no_casal(uuid) from public;
revoke all on function public.outro_perfil_no_casal(uuid) from public;

-- =====================================================================
-- Jogos
-- =====================================================================
create table if not exists public.jogos (
  id             uuid primary key default gen_random_uuid(),
  casal_id       uuid not null references public.casais (id) on delete cascade,
  tipo           text not null check (tipo in ('velha', 'forca')),
  status         text not null default 'andamento' check (status in ('andamento', 'fim', 'abandonado')),
  estado         jsonb not null default '{}'::jsonb,
  criado_por     text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists jogos_casal_idx on public.jogos (casal_id, tipo, criado_em desc);

create table if not exists privado.forca_palavras (
  jogo_id  uuid primary key references public.jogos (id) on delete cascade,
  palavra  text not null
);

alter table public.jogos enable row level security;
revoke all on public.jogos from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.jogos from anon, authenticated';
    execute 'grant select on public.jogos to authenticated';
  end if;
end $$;

-- Só leitura direta (e só do próprio casal). Criar e jogar: pelas funções abaixo.
drop policy if exists "casal ve jogos" on public.jogos;
create policy "casal ve jogos" on public.jogos
  for select to authenticated
  using (casal_id in (select public.meus_casais()));

-- Normaliza a palavra da forca: maiúsculas, sem acento, espaços simples
create or replace function public.forca_normalizar(p text)
returns text
language sql
immutable
as $$
  select btrim(regexp_replace(upper(translate(coalesce(p, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')), '\s+', ' ', 'g'))
$$;

-- Máscara da forca: letras acertadas aparecem, as outras ficam vazias, espaços continuam espaços
create or replace function public.forca_mascara(p_palavra text, p_letras text[])
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(
    case when c = ' ' then ' ' when c = any (p_letras) then c else '' end order by i), '[]'::jsonb)
  from unnest(string_to_array(p_palavra, null)) with ordinality as t(c, i)
$$;

-- Termina partidas em andamento do mesmo tipo (ao começar uma nova)
create or replace function public.jogos_encerrar_abertos(p_casal uuid, p_tipo text)
returns void
language plpgsql
security definer
set search_path = public, privado
as $$
declare j record;
begin
  for j in select id, tipo from public.jogos where casal_id = p_casal and tipo = p_tipo and status = 'andamento' for update loop
    if j.tipo = 'forca' then
      update public.jogos set status = 'abandonado', atualizado_em = now(),
        estado = estado || jsonb_build_object('fim', 'desistiu', 'palavra', (select palavra from privado.forca_palavras where jogo_id = j.id))
      where id = j.id;
    else
      update public.jogos set status = 'abandonado', atualizado_em = now() where id = j.id;
    end if;
  end loop;
end
$$;
revoke all on function public.jogos_encerrar_abertos(uuid, text) from public;

-- ---------- Jogo da velha ----------
create or replace function public.velha_nova(p_casal uuid)
returns public.jogos
language plpgsql
security definer
set search_path = public
as $$
declare
  eu text := public.meu_perfil_no_casal(p_casal);
  outro text := public.outro_perfil_no_casal(p_casal);
  ultimo_primeiro text;
  primeiro text;
  novo public.jogos;
begin
  if eu is null then raise exception 'Você não faz parte deste cantinho.' using errcode = '42501'; end if;
  if outro is null then raise exception 'Este cantinho ainda não tem a outra pessoa.' using errcode = '22023'; end if;
  perform public.jogos_encerrar_abertos(p_casal, 'velha');
  -- Revezam quem começa: começa quem não começou a última partida
  select estado->>'primeiro' into ultimo_primeiro from public.jogos
   where casal_id = p_casal and tipo = 'velha' order by criado_em desc limit 1;
  primeiro := case when ultimo_primeiro = eu then outro when ultimo_primeiro = outro then eu else eu end;
  insert into public.jogos (casal_id, tipo, criado_por, estado)
  values (p_casal, 'velha', eu, jsonb_build_object(
    'tab', jsonb_build_array('', '', '', '', '', '', '', '', ''),
    'jogadores', jsonb_build_array(eu, outro),
    'primeiro', primeiro, 'vez', primeiro, 'ultima', null, 'vencedor', null, 'linha', null, 'empate', false))
  returning * into novo;
  return novo;
end
$$;

create or replace function public.velha_jogar(p_jogo uuid, p_casa integer)
returns public.jogos
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.jogos;
  eu text;
  outro text;
  tab text[];
  linhas int[][] := array[[1,2,3],[4,5,6],[7,8,9],[1,4,7],[2,5,8],[3,6,9],[1,5,9],[3,5,7]];
  k int;
  venceu text := null;
  linha jsonb := null;
begin
  select * into j from public.jogos where id = p_jogo for update;
  if j.id is null then raise exception 'Partida não encontrada.' using errcode = '22023'; end if;
  eu := public.meu_perfil_no_casal(j.casal_id);
  if eu is null then raise exception 'Você não faz parte deste cantinho.' using errcode = '42501'; end if;
  if j.tipo <> 'velha' or j.status <> 'andamento' then raise exception 'Esta partida já acabou.' using errcode = '22023'; end if;
  if j.estado->>'vez' <> eu then raise exception 'Ainda não é a sua vez.' using errcode = '22023'; end if;
  if p_casa is null or p_casa < 0 or p_casa > 8 then raise exception 'Casa inválida.' using errcode = '22023'; end if;

  select array_agg(v order by i) into tab from jsonb_array_elements_text(j.estado->'tab') with ordinality as t(v, i);
  if tab[p_casa + 1] <> '' then raise exception 'Essa casa já foi usada.' using errcode = '22023'; end if;
  tab[p_casa + 1] := eu;

  for k in 1 .. 8 loop
    if tab[linhas[k][1]] <> '' and tab[linhas[k][1]] = tab[linhas[k][2]] and tab[linhas[k][2]] = tab[linhas[k][3]] then
      venceu := tab[linhas[k][1]];
      linha := jsonb_build_array(linhas[k][1] - 1, linhas[k][2] - 1, linhas[k][3] - 1);
      exit;
    end if;
  end loop;

  select x into outro from jsonb_array_elements_text(j.estado->'jogadores') as t(x) where x <> eu limit 1;
  update public.jogos set
    estado = j.estado || jsonb_build_object(
      'tab', to_jsonb(tab), 'ultima', p_casa,
      'vez', case when venceu is null and '' = any (tab) then outro else null end,
      'vencedor', venceu, 'linha', linha,
      'empate', venceu is null and not ('' = any (tab))),
    status = case when venceu is not null or not ('' = any (tab)) then 'fim' else 'andamento' end,
    atualizado_em = now()
  where id = p_jogo
  returning * into j;
  return j;
end
$$;

-- ---------- Forca ----------
create or replace function public.forca_nova(p_casal uuid, p_palavra text, p_dica text)
returns public.jogos
language plpgsql
security definer
set search_path = public, privado
as $$
declare
  eu text := public.meu_perfil_no_casal(p_casal);
  outro text := public.outro_perfil_no_casal(p_casal);
  v_palavra text := public.forca_normalizar(p_palavra);
  dica text := left(btrim(regexp_replace(coalesce(p_dica, ''), '\s+', ' ', 'g')), 80);
  novo public.jogos;
begin
  if eu is null then raise exception 'Você não faz parte deste cantinho.' using errcode = '42501'; end if;
  if outro is null then raise exception 'Este cantinho ainda não tem a outra pessoa.' using errcode = '22023'; end if;
  if v_palavra !~ '^[A-Z ]{3,24}$' or length(replace(v_palavra, ' ', '')) < 3 then
    raise exception 'Use só letras (de 3 a 24).' using errcode = '22023';
  end if;
  perform public.jogos_encerrar_abertos(p_casal, 'forca');
  insert into public.jogos (casal_id, tipo, criado_por, estado)
  values (p_casal, 'forca', eu, jsonb_build_object(
    'autor', eu, 'adivinha', outro, 'dica', dica, 'tamanho', length(replace(v_palavra, ' ', '')),
    'mascara', public.forca_mascara(v_palavra, '{}'), 'letras', '[]'::jsonb, 'erros', 0, 'fim', null))
  returning * into novo;
  insert into privado.forca_palavras (jogo_id, palavra) values (novo.id, v_palavra);
  return novo;
end
$$;

create or replace function public.forca_chutar(p_jogo uuid, p_letra text)
returns public.jogos
language plpgsql
security definer
set search_path = public, privado
as $$
declare
  j public.jogos;
  eu text;
  v_palavra text;
  letra text := public.forca_normalizar(p_letra);
  letras text[];
  erros int;
  mascara jsonb;
  acertou boolean;
  fim text := null;
begin
  select * into j from public.jogos where id = p_jogo for update;
  if j.id is null then raise exception 'Partida não encontrada.' using errcode = '22023'; end if;
  eu := public.meu_perfil_no_casal(j.casal_id);
  if eu is null then raise exception 'Você não faz parte deste cantinho.' using errcode = '42501'; end if;
  if j.tipo <> 'forca' or j.status <> 'andamento' then raise exception 'Esta forca já acabou.' using errcode = '22023'; end if;
  if j.estado->>'adivinha' <> eu then raise exception 'Quem escolheu a palavra não chuta letras.' using errcode = '22023'; end if;
  if letra !~ '^[A-Z]$' then raise exception 'Letra inválida.' using errcode = '22023'; end if;

  select array_agg(x) into letras from jsonb_array_elements_text(j.estado->'letras') as t(x);
  letras := coalesce(letras, '{}');
  if letra = any (letras) then raise exception 'Essa letra já foi.' using errcode = '22023'; end if;
  letras := letras || letra;

  select fp.palavra into v_palavra from privado.forca_palavras fp where fp.jogo_id = p_jogo;
  erros := (j.estado->>'erros')::int + case when position(letra in v_palavra) > 0 then 0 else 1 end;
  mascara := public.forca_mascara(v_palavra, letras);
  acertou := not exists (select 1 from jsonb_array_elements_text(mascara) as t(c) where c = '');
  if acertou then fim := 'acertou'; elsif erros >= 6 then fim := 'perdeu'; end if;

  update public.jogos set
    estado = j.estado || jsonb_build_object('letras', to_jsonb(letras), 'erros', erros, 'mascara', mascara, 'fim', fim)
             || case when fim is not null then jsonb_build_object('palavra', v_palavra) else '{}'::jsonb end,
    status = case when fim is not null then 'fim' else 'andamento' end,
    atualizado_em = now()
  where id = p_jogo
  returning * into j;
  return j;
end
$$;

-- Desistir / recomeçar a partida atual (na forca, mostra a palavra)
create or replace function public.jogo_desistir(p_jogo uuid)
returns public.jogos
language plpgsql
security definer
set search_path = public, privado
as $$
declare j public.jogos;
begin
  select * into j from public.jogos where id = p_jogo;
  if j.id is null or public.meu_perfil_no_casal(j.casal_id) is null then
    raise exception 'Partida não encontrada.' using errcode = '22023';
  end if;
  if j.status = 'andamento' then perform public.jogos_encerrar_abertos(j.casal_id, j.tipo); end if;
  select * into j from public.jogos where id = p_jogo;
  return j;
end
$$;

revoke all on function public.velha_nova(uuid) from public;
revoke all on function public.velha_jogar(uuid, integer) from public;
revoke all on function public.forca_nova(uuid, text, text) from public;
revoke all on function public.forca_chutar(uuid, text) from public;
revoke all on function public.jogo_desistir(uuid) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.velha_nova(uuid), public.velha_jogar(uuid, integer), public.forca_nova(uuid, text, text), public.forca_chutar(uuid, text), public.jogo_desistir(uuid) to authenticated';
    execute 'grant execute on function public.meu_perfil_no_casal(uuid), public.outro_perfil_no_casal(uuid) to authenticated';
  end if;
end $$;

-- =====================================================================
-- Resposta do dia
-- =====================================================================
create table if not exists public.respostas_dia (
  id             uuid primary key default gen_random_uuid(),
  casal_id       uuid not null references public.casais (id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  perfil         text not null,
  dia            date not null default public.hoje_brasilia(),
  pergunta       text not null check (length(pergunta) between 3 and 200),
  texto          text not null check (length(btrim(texto)) between 1 and 500),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (casal_id, perfil, dia)
);
create index if not exists respostas_dia_casal_idx on public.respostas_dia (casal_id, dia desc);

-- "Eu já respondi neste dia?" (função à parte para a regra não consultar a própria tabela)
create or replace function public.respondi_no_dia(p_casal uuid, p_dia date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.respostas_dia where casal_id = p_casal and dia = p_dia and user_id = auth.uid())
$$;
revoke all on function public.respondi_no_dia(uuid, date) from public;

alter table public.respostas_dia enable row level security;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.respostas_dia from anon, authenticated';
    execute 'grant select, insert, update (texto, atualizado_em) on public.respostas_dia to authenticated';
    execute 'grant execute on function public.respondi_no_dia(uuid, date), public.hoje_brasilia() to authenticated';
  end if;
end $$;

drop policy if exists "ve respostas do dia" on public.respostas_dia;
create policy "ve respostas do dia" on public.respostas_dia
  for select to authenticated
  using (
    casal_id in (select public.meus_casais())
    and (user_id = auth.uid() or dia < public.hoje_brasilia() or public.respondi_no_dia(casal_id, dia))
  );

drop policy if exists "responde a pergunta de hoje" on public.respostas_dia;
create policy "responde a pergunta de hoje" on public.respostas_dia
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and dia = public.hoje_brasilia()
    and perfil = public.meu_perfil_no_casal(casal_id)
  );

drop policy if exists "edita a propria resposta de hoje" on public.respostas_dia;
create policy "edita a propria resposta de hoje" on public.respostas_dia
  for update to authenticated
  using (user_id = auth.uid() and dia = public.hoje_brasilia())
  with check (user_id = auth.uid() and dia = public.hoje_brasilia());

-- Quantas respostas existem em cada dia (sem mostrar o texto): para o aviso "Fulano já respondeu"
create or replace function public.respostas_dia_quem(p_casal uuid, p_dia date)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select perfil from public.respostas_dia
  where casal_id = p_casal and dia = p_dia and public.meu_perfil_no_casal(p_casal) is not null
$$;
revoke all on function public.respostas_dia_quem(uuid, date) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.respostas_dia_quem(uuid, date) to authenticated';
  end if;
end $$;

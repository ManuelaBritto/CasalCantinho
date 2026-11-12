-- =====================================================================
-- Nosso Cantinho — avisos para o casal voltar ao app ("lembretes do cantinho")
-- Rode no SQL Editor do Supabase DEPOIS de calendario.sql (e de jogos.sql,
-- notificacoes.sql e aviso-atualizacao.sql). Pode rodar de novo sem problema.
--
-- Usa o mesmo agendador dos lembretes (agendar-lembretes.sql: a cada 5 minutos)
-- e a mesma senha AVISO_SEGREDO. Nada novo para configurar na Vercel.
--
-- Tipos (horário de Brasília):
--   de dia   · marcos     9h   "Hoje vocês completam 500 dias juntos!" / mêsversário
--            · nesse_dia  10h  cartinha ou memória de 1+ ano atrás, no mesmo dia
--            · pergunta   12h  a pergunta do dia (se a pessoa ainda não respondeu)
--   à noite  · resumo     domingo 18h  o que o casal fez na semana
--            · vez        19h  sua vez num jogo parado há mais de 1 dia
--            · saudade    19h  3+ dias sem abrir (no máximo 1 por semana)
--            · cinema     sexta 19h  um filme da lista "Queremos assistir"
--            · falta_voce 20h30 o par respondeu a pergunta do dia e você não
--
-- Todo dia, fora do limite abaixo (só para quem ainda não mandou um elogio):
--            · bom_dia    9h   "Já mandou um elogio de bom dia para a Kath hoje?"
--            · boa_noite  20h  "Dê um boa noite com um elogio para a Kath!"
--
-- Regras para não incomodar:
--   - no máximo 1 de dia e 1 à noite por pessoa (2 por dia, somando todos os cantinhos);
--   - nada entre 22h e 8h;
--   - "vez" e "saudade" só saem se a pessoa ainda não abriu o site naquele dia;
--   - cada pessoa liga/desliga cada tipo em Aparência (todos vêm ligados).
-- As notificações de ação (cartinha, jogo, calendário) não entram nesse limite.
-- =====================================================================
create extension if not exists pgcrypto;

create schema if not exists privado;
revoke all on schema privado from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema privado from anon, authenticated'; end if;
end $$;

-- ---------- Dados por pessoa ----------
alter table public.perfis add column if not exists visto_em date;
alter table public.perfis add column if not exists prefs_push jsonb not null default '{}'::jsonb;

create table if not exists privado.engajamento_envios (
  id          bigserial primary key,
  user_id     uuid not null,
  casal_id    uuid not null,
  perfil      text not null,
  dia         date not null,
  periodo     text not null check (periodo in ('dia', 'noite')),
  tipo        text not null,
  enviado_em  timestamptz not null default now(),
  unique (user_id, dia, periodo)
);
create index if not exists engajamento_envios_tipo_idx on privado.engajamento_envios (user_id, tipo, dia desc);

-- Bom dia / boa noite com elogio: um de cada por dia, em cada cantinho
create table if not exists privado.elogio_lembretes (
  id          bigserial primary key,
  casal_id    uuid not null,
  perfil      text not null,
  dia         date not null,
  tipo        text not null check (tipo in ('bom_dia', 'boa_noite')),
  enviado_em  timestamptz not null default now(),
  unique (casal_id, perfil, dia, tipo)
);

create table if not exists privado.engajamento_aberturas (
  id         bigserial primary key,
  casal_id   uuid not null,
  perfil     text not null,
  tipo       text not null,
  dia        date not null,
  aberto_em  timestamptz not null default now(),
  unique (casal_id, perfil, tipo, dia)
);

-- Lê datas guardadas em texto (dentro do jsonb) sem quebrar se vier algo estranho
create or replace function privado.data_ou_nula(p text, p_fuso text default 'America/Sao_Paulo')
returns date
language plpgsql
immutable
as $$
begin
  if p is null or p = '' then return null; end if;
  if p ~ '^\d{4}-\d{2}-\d{2}$' then return p::date; end if;
  return (p::timestamptz at time zone p_fuso)::date;
exception when others then
  return null;
end
$$;

create or replace function privado.ts_ou_nulo(p text)
returns timestamptz
language plpgsql
stable
as $$
begin
  return p::timestamptz;
exception when others then
  return null;
end
$$;

-- ---------- Chamadas do site (pessoa logada) ----------
-- Anota que a pessoa abriu o site hoje
create or replace function public.marcar_visto(p_casal uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.perfis set visto_em = (now() at time zone 'America/Sao_Paulo')::date
  where user_id = auth.uid() and casal_id = p_casal
$$;

-- Liga/desliga os tipos de aviso da pessoa
create or replace function public.salvar_prefs_push(p_casal uuid, p_prefs jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  limpas jsonb := '{}'::jsonb;
  k text;
begin
  foreach k in array array['bom_dia', 'boa_noite', 'marcos', 'nesse_dia', 'pergunta', 'resumo', 'vez', 'saudade', 'cinema'] loop
    if jsonb_typeof(p_prefs->k) = 'boolean' then limpas := limpas || jsonb_build_object(k, p_prefs->k); end if;
  end loop;
  update public.perfis set prefs_push = prefs_push || limpas
  where user_id = auth.uid() and casal_id = p_casal
  returning prefs_push into limpas;
  return limpas;
end
$$;

-- Conta quando alguém abre o site tocando num desses avisos (para saber o que funciona)
create or replace function public.registrar_abertura_push(p_casal uuid, p_tipo text)
returns void
language plpgsql
volatile
security definer
set search_path = public, privado
as $$
declare
  eu text;
begin
  if p_tipo not in ('bom_dia', 'boa_noite', 'marcos', 'nesse_dia', 'pergunta', 'resumo', 'vez', 'saudade', 'cinema', 'falta_voce') then return; end if;
  select nome into eu from public.perfis where user_id = auth.uid() and casal_id = p_casal limit 1;
  if eu is null then return; end if;
  insert into privado.engajamento_aberturas (casal_id, perfil, tipo, dia)
  values (p_casal, eu, p_tipo, (now() at time zone 'America/Sao_Paulo')::date)
  on conflict do nothing;
end
$$;

revoke all on function public.marcar_visto(uuid) from public;
revoke all on function public.salvar_prefs_push(uuid, jsonb) from public;
revoke all on function public.registrar_abertura_push(uuid, text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.marcar_visto(uuid), public.salvar_prefs_push(uuid, jsonb), public.registrar_abertura_push(uuid, text) to authenticated';
  end if;
end $$;

-- ---------- O que mandar agora (chamado pelo servidor, com a senha AVISO_SEGREDO) ----------
create or replace function public.engajamento_pendente(segredo text, p_agora timestamptz default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions, privado
as $$
declare
  agora timestamptz := coalesce(p_agora, now());
  hoje date := (agora at time zone 'America/Sao_Paulo')::date;
  hora time := (agora at time zone 'America/Sao_Paulo')::time;
  dow int := extract(dow from hoje)::int;           -- 0 = domingo, 5 = sexta
  v_periodo text := case when hora < time '17:00' then 'dia' else 'noite' end;
  tem_respostas boolean := to_regclass('public.respostas_dia') is not null;
  tem_jogos boolean := to_regclass('public.jogos') is not null;
  tem_eventos boolean := to_regclass('public.eventos') is not null;
  saida jsonb := '[]'::jsonb;
  p record;
  v_tipo text;
  v_dados jsonb;
  inicio date;
  dias int;
  meses int;
  n int;
  x record;
  extra jsonb;
  quer boolean;
begin
  if to_regprocedure('privado.segredo_confere(text, text)') is null then
    raise exception 'Rode antes o arquivo supabase/aviso-atualizacao.sql.' using errcode = '22023';
  end if;
  if not privado.segredo_confere('aviso-atualizacao', segredo) then
    raise exception 'segredo inválido' using errcode = '28000';
  end if;
  -- Silêncio: nada entre 22h e 8h
  if hora < time '08:00' or hora >= time '22:00' then return saida; end if;

  for p in
    select pf.user_id, pf.casal_id, pf.nome as perfil, pf.visto_em, coalesce(pf.prefs_push, '{}'::jsonb) as prefs,
           o.nome as outro, coalesce(o.apelido, o.nome) as outro_nome, o.tratamento as outro_tratamento,
           c.ajustes
    from public.perfis pf
    join public.casais c on c.id = pf.casal_id
    left join lateral (select * from public.perfis o where o.casal_id = pf.casal_id and o.nome <> pf.nome order by o.nome limit 1) o on true
    where exists (select 1 from public.push_inscricoes i where i.casal_id = pf.casal_id and i.perfil = pf.nome)
  loop
    -- Bom dia (9h) e boa noite (20h) com elogio: todo dia, fora do limite, se ainda não mandou um elogio
    v_tipo := null;
    if hora >= time '09:00' and hora < time '12:00' and coalesce((p.prefs->>'bom_dia')::boolean, true)
       and not exists (select 1 from public.cartas ct where ct.casal_id = p.casal_id and ct.dados->>'tipo' = 'elogio'
                         and ct.dados->>'de' = p.perfil and privado.data_ou_nula(ct.dados->>'enviadaEm') = hoje) then
      v_tipo := 'bom_dia';
    elsif hora >= time '20:00' and coalesce((p.prefs->>'boa_noite')::boolean, true)
       and not exists (select 1 from public.cartas ct where ct.casal_id = p.casal_id and ct.dados->>'tipo' = 'elogio'
                         and ct.dados->>'de' = p.perfil and privado.data_ou_nula(ct.dados->>'enviadaEm') = hoje
                         and (privado.ts_ou_nulo(ct.dados->>'enviadaEm') at time zone 'America/Sao_Paulo')::time >= time '18:00') then
      v_tipo := 'boa_noite';
    end if;
    if v_tipo is not null then
      insert into privado.elogio_lembretes (casal_id, perfil, dia, tipo) values (p.casal_id, p.perfil, hoje, v_tipo) on conflict do nothing;
      get diagnostics n = row_count;
      if n > 0 then
        saida := saida || jsonb_build_array(jsonb_build_object(
          'tipo', v_tipo, 'casal', p.casal_id, 'perfil', p.perfil, 'outro', p.outro_nome, 'outro_tratamento', p.outro_tratamento,
          'dados', '{}'::jsonb,
          'inscricoes', coalesce((select jsonb_agg(jsonb_build_object('endpoint', i.endpoint, 'p256dh', i.p256dh, 'auth', i.auth))
                                  from public.push_inscricoes i where i.casal_id = p.casal_id and i.perfil = p.perfil), '[]'::jsonb)));
      end if;
    end if;

    -- Já recebeu um neste período hoje (em qualquer cantinho)?
    if exists (select 1 from privado.engajamento_envios e where e.user_id = p.user_id and e.dia = hoje and e.periodo = v_periodo) then continue; end if;
    v_tipo := null;
    v_dados := null;

    if v_periodo = 'dia' then
      -- 1) Marcos do namoro (9h)
      if hora >= time '09:00' and coalesce((p.prefs->>'marcos')::boolean, true)
         and coalesce(p.ajustes->>'dataInicioExemplo', 'false') <> 'true' then
        inicio := privado.data_ou_nula(p.ajustes->>'dataInicio');
        if inicio is not null and inicio < hoje then
          dias := hoje - inicio;
          meses := (extract(year from hoje)::int - extract(year from inicio)::int) * 12 + extract(month from hoje)::int - extract(month from inicio)::int;
          if dias in (100, 200, 300, 500) or (dias >= 1000 and dias % 500 = 0) then
            v_tipo := 'marcos'; v_dados := jsonb_build_object('marco', 'dias', 'dias', dias);
          elsif meses > 0 and (
                  extract(day from hoje) = extract(day from inicio)
                  -- começou dia 31 e o mês acaba antes: comemora no último dia
                  or (extract(day from inicio) > extract(day from hoje) and hoje = (date_trunc('month', hoje) + interval '1 month - 1 day')::date)) then
            -- aniversário de anos: o calendário já avisa se tiver a data de namoro cadastrada
            if meses % 12 <> 0 or not tem_eventos
               or not exists (select 1 from public.eventos ev where ev.casal_id = p.casal_id and ev.tipo = 'namoro') then
              v_tipo := 'marcos'; v_dados := jsonb_build_object('marco', 'meses', 'anos', meses / 12, 'meses', meses % 12);
            end if;
          end if;
        end if;
      end if;

      -- 2) Nesse dia (10h): memória ou cartinha de 1+ ano atrás
      if v_tipo is null and hora >= time '10:00' and coalesce((p.prefs->>'nesse_dia')::boolean, true) then
        select m.id, m.dados->>'legenda' as legenda, privado.data_ou_nula(m.dados->>'data') as quando into x
        from public.memorias m
        where m.casal_id = p.casal_id and coalesce(m.dados->>'exemplo', 'false') <> 'true'
          and to_char(privado.data_ou_nula(m.dados->>'data'), 'MM-DD') = to_char(hoje, 'MM-DD')
          and privado.data_ou_nula(m.dados->>'data') < hoje - 300
        order by privado.data_ou_nula(m.dados->>'data') desc limit 1;
        if x.id is not null then
          v_tipo := 'nesse_dia';
          v_dados := jsonb_build_object('item', 'memoria', 'id', x.id, 'legenda', x.legenda, 'anos', extract(year from hoje)::int - extract(year from x.quando)::int);
        else
          select ct.id, ct.dados->>'titulo' as titulo, ct.dados->>'de' as de, privado.data_ou_nula(ct.dados->>'enviadaEm') as quando into x
          from public.cartas ct
          where ct.casal_id = p.casal_id and coalesce(ct.dados->>'exemplo', 'false') <> 'true'
            and (ct.dados->>'para' = p.perfil or ct.dados->>'de' = p.perfil)
            and to_char(privado.data_ou_nula(ct.dados->>'enviadaEm'), 'MM-DD') = to_char(hoje, 'MM-DD')
            and privado.data_ou_nula(ct.dados->>'enviadaEm') < hoje - 300
          order by privado.data_ou_nula(ct.dados->>'enviadaEm') desc limit 1;
          if x.id is not null then
            v_tipo := 'nesse_dia';
            v_dados := jsonb_build_object('item', 'carta', 'id', x.id, 'titulo', x.titulo, 'de_mim', x.de = p.perfil,
                                        'anos', extract(year from hoje)::int - extract(year from x.quando)::int);
          end if;
        end if;
      end if;

      -- 3) Pergunta do dia (12h), se ainda não respondeu
      if v_tipo is null and hora >= time '12:00' and tem_respostas and coalesce((p.prefs->>'pergunta')::boolean, true) then
        execute 'select exists (select 1 from public.respostas_dia where casal_id = $1 and perfil = $2 and dia = $3)'
          into quer using p.casal_id, p.perfil, hoje;
        if not quer then v_tipo := 'pergunta'; v_dados := jsonb_build_object('dia', hoje); end if;
      end if;

    else
      -- 4) Resumo da semana (domingo 18h)
      if dow = 0 and hora >= time '18:00' and coalesce((p.prefs->>'resumo')::boolean, true) then
        v_dados := jsonb_build_object(
          'cartas', (select count(*) from public.cartas ct where ct.casal_id = p.casal_id and coalesce(ct.dados->>'exemplo', 'false') <> 'true'
                       and privado.data_ou_nula(ct.dados->>'enviadaEm') between hoje - 6 and hoje
                       and (ct.dados->>'agendadaPara' is null or privado.data_ou_nula(ct.dados->>'agendadaPara') <= hoje)),
          'memorias', (select count(*) from public.memorias m where m.casal_id = p.casal_id and coalesce(m.dados->>'exemplo', 'false') <> 'true'
                       and m.criado_em >= agora - interval '7 days'));
        if tem_jogos then
          execute $q$ select jsonb_build_object(
                'partidas', count(*) filter (where tipo = 'velha'),
                'minhas', count(*) filter (where tipo = 'velha' and estado->>'vencedor' = $2),
                'dele', count(*) filter (where tipo = 'velha' and estado->>'vencedor' = $3),
                'forcas', count(*) filter (where tipo = 'forca'))
              from public.jogos where casal_id = $1 and status = 'fim' and atualizado_em >= $4 - interval '7 days' $q$
            into extra using p.casal_id, p.perfil, p.outro, agora;
          v_dados := v_dados || coalesce(extra, '{}'::jsonb);
        end if;
        if tem_respostas then
          execute 'select count(*) from (select dia from public.respostas_dia where casal_id = $1 and dia between $2 - 6 and $2 group by dia having count(distinct perfil) >= 2) t'
            into n using p.casal_id, hoje;
          v_dados := v_dados || jsonb_build_object('respostas', n);
        end if;
        if coalesce((v_dados->>'cartas')::int, 0) + coalesce((v_dados->>'memorias')::int, 0) + coalesce((v_dados->>'partidas')::int, 0)
           + coalesce((v_dados->>'forcas')::int, 0) + coalesce((v_dados->>'respostas')::int, 0) > 0 then
          v_tipo := 'resumo';
        else
          v_dados := null;
        end if;
      end if;

      -- 5) Sua vez num jogo parado há mais de 1 dia (19h, só se não abriu o site hoje)
      if v_tipo is null and tem_jogos and hora >= time '19:00' and coalesce((p.prefs->>'vez')::boolean, true)
         and (p.visto_em is null or p.visto_em < hoje)
         and not exists (select 1 from privado.engajamento_envios e where e.user_id = p.user_id and e.tipo = 'vez' and e.dia >= hoje - 1) then
        execute $q$ select tipo, floor(extract(epoch from ($3 - atualizado_em)) / 86400)::int as dias from public.jogos
              where casal_id = $1 and status = 'andamento' and atualizado_em < $3 - interval '1 day'
                and ((tipo = 'velha' and estado->>'vez' = $2) or (tipo = 'forca' and estado->>'adivinha' = $2))
              order by atualizado_em limit 1 $q$
          into x using p.casal_id, p.perfil, agora;
        if x.tipo is not null then v_tipo := 'vez'; v_dados := jsonb_build_object('jogo', x.tipo, 'dias', x.dias); end if;
      end if;

      -- 6) Saudade: 3+ dias sem abrir, no máximo 1 por semana (19h)
      if v_tipo is null and hora >= time '19:00' and coalesce((p.prefs->>'saudade')::boolean, true)
         and p.visto_em is not null and p.visto_em <= hoje - 3
         and not exists (select 1 from privado.engajamento_envios e where e.user_id = p.user_id and e.tipo = 'saudade' and e.dia > hoje - 7) then
        v_tipo := 'saudade';
        v_dados := jsonb_build_object('dias', hoje - p.visto_em,
          'cartas', (select count(*) from public.cartas ct where ct.casal_id = p.casal_id and ct.dados->>'para' = p.perfil
                       and ct.dados->>'enviadaEm' is not null and ct.dados->>'lidaEm' is null
                       and (ct.dados->>'agendadaPara' is null or privado.data_ou_nula(ct.dados->>'agendadaPara') <= hoje)));
      end if;

      -- 7) Sexta de cinema (19h): um filme da lista "Queremos assistir"
      if v_tipo is null and dow = 5 and hora >= time '19:00' and coalesce((p.prefs->>'cinema')::boolean, true) then
        select f.dados->>'titulo' as titulo into x from public.filmes f
        where f.casal_id = p.casal_id and coalesce(f.dados->>'status', 'quero') = 'quero' and coalesce(f.dados->>'titulo', '') <> ''
        order by md5(f.id::text || hoje::text) limit 1;
        if x.titulo is not null then v_tipo := 'cinema'; v_dados := jsonb_build_object('filme', x.titulo); end if;
      end if;

      -- 8) Falta você (20h30): o par respondeu a pergunta de hoje e você não
      if v_tipo is null and tem_respostas and hora >= time '20:30' and coalesce((p.prefs->>'pergunta')::boolean, true) and p.outro is not null then
        execute 'select exists (select 1 from public.respostas_dia where casal_id = $1 and perfil = $2 and dia = $4)
                    and not exists (select 1 from public.respostas_dia where casal_id = $1 and perfil = $3 and dia = $4)'
          into quer using p.casal_id, p.outro, p.perfil, hoje;
        if quer then v_tipo := 'falta_voce'; v_dados := jsonb_build_object('dia', hoje); end if;
      end if;
    end if;

    if v_tipo is null then continue; end if;
    insert into privado.engajamento_envios (user_id, casal_id, perfil, dia, periodo, tipo)
    values (p.user_id, p.casal_id, p.perfil, hoje, v_periodo, v_tipo)
    on conflict do nothing;
    get diagnostics n = row_count;
    if n = 0 then continue; end if;
    saida := saida || jsonb_build_array(jsonb_build_object(
      'tipo', v_tipo, 'casal', p.casal_id, 'perfil', p.perfil, 'outro', p.outro_nome, 'outro_tratamento', p.outro_tratamento,
      'dados', v_dados,
      'inscricoes', coalesce((select jsonb_agg(jsonb_build_object('endpoint', i.endpoint, 'p256dh', i.p256dh, 'auth', i.auth))
                              from public.push_inscricoes i where i.casal_id = p.casal_id and i.perfil = p.perfil), '[]'::jsonb)));
  end loop;

  delete from privado.engajamento_envios where dia < hoje - 120;
  delete from privado.elogio_lembretes where dia < hoje - 30;
  return saida;
end
$$;

revoke all on function public.engajamento_pendente(text, timestamptz) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.engajamento_pendente(text, timestamptz) to anon, authenticated';
  end if;
end $$;

-- ---------- Para você acompanhar (rode no SQL Editor quando quiser) ----------
-- Quantos avisos de cada tipo saíram e quantos foram abertos nos últimos 30 dias:
--
-- select e.tipo, count(*) as enviados,
--        (select count(*) from privado.engajamento_aberturas a where a.tipo = e.tipo and a.dia >= current_date - 30) as abertos
-- from privado.engajamento_envios e where e.dia >= current_date - 30
-- group by e.tipo order by enviados desc;

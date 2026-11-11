-- =====================================================================
-- Nosso Cantinho — notificação "chegou uma atualização nova"
-- Rode no SQL Editor do Supabase DEPOIS do notificacoes.sql.
-- Pode rodar de novo sem problema.
--
-- Quando sai uma versão nova do site, o servidor (api/avisar-atualizacao.js)
-- chama a função abaixo com uma senha (AVISO_SEGREDO) que só ele conhece.
-- A função devolve os aparelhos de todos os cantinhos UMA vez por versão.
-- Sem a senha, ninguém consegue ler os aparelhos nem disparar o aviso.
--
-- Depois de rodar este arquivo, rode também a linha que o comando
--   npm run segredo-aviso
-- mostra (ela guarda só o "resumo" da senha, não a senha).
-- =====================================================================
create extension if not exists pgcrypto;

create schema if not exists privado;
revoke all on schema privado from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on schema privado from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on schema privado from authenticated'; end if;
end $$;

create table if not exists privado.segredos (
  nome  text primary key,
  hash  text not null
);

create table if not exists privado.avisos_atualizacao (
  versao      text primary key,
  enviado_em  timestamptz not null default now()
);

-- Confere a senha (compara o sha256 dela com o resumo guardado)
create or replace function privado.segredo_confere(nome_segredo text, segredo text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions, privado
as $$
  select exists (
    select 1 from privado.segredos s
    where s.nome = nome_segredo
      and segredo is not null and length(segredo) between 20 and 200
      and s.hash = encode(digest(segredo, 'sha256'), 'hex')
  )
$$;

-- Marca a versão como avisada e devolve os aparelhos (um por endereço).
-- Se a versão já foi avisada, devolve a lista vazia.
create or replace function public.aviso_atualizacao(segredo text, versao text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions, privado
as $$
declare
  nova boolean;
begin
  if not privado.segredo_confere('aviso-atualizacao', segredo) then
    raise exception 'segredo inválido' using errcode = '28000';
  end if;
  if versao is null or versao !~ '^[A-Za-z0-9_.-]{1,100}$' then
    raise exception 'versão inválida' using errcode = '22023';
  end if;

  insert into privado.avisos_atualizacao (versao) values (versao) on conflict do nothing;
  get diagnostics nova = row_count;
  if not nova then
    return jsonb_build_object('ja_enviado', true, 'inscricoes', '[]'::jsonb);
  end if;

  return jsonb_build_object('ja_enviado', false, 'inscricoes', coalesce((
    select jsonb_agg(jsonb_build_object('endpoint', i.endpoint, 'p256dh', i.p256dh, 'auth', i.auth))
    from (select distinct on (endpoint) endpoint, p256dh, auth
          from public.push_inscricoes order by endpoint, criado_em desc) i
  ), '[]'::jsonb));
end
$$;

-- Remove aparelhos que desinstalaram o app ou desativaram as notificações
create or replace function public.aviso_atualizacao_limpar(segredo text, enderecos text[])
returns integer
language plpgsql
volatile
security definer
set search_path = public, extensions, privado
as $$
declare
  n integer;
begin
  if not privado.segredo_confere('aviso-atualizacao', segredo) then
    raise exception 'segredo inválido' using errcode = '28000';
  end if;
  delete from public.push_inscricoes where endpoint = any (coalesce(enderecos, '{}'));
  get diagnostics n = row_count;
  return n;
end
$$;

revoke all on function privado.segredo_confere(text, text) from public;
revoke all on function public.aviso_atualizacao(text, text) from public;
revoke all on function public.aviso_atualizacao_limpar(text, text[]) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.aviso_atualizacao(text, text) to anon, authenticated';
    execute 'grant execute on function public.aviso_atualizacao_limpar(text, text[]) to anon, authenticated';
  end if;
end $$;

-- Conferir: versões já avisadas
-- select * from privado.avisos_atualizacao order by enviado_em desc;

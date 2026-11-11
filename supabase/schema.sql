-- =====================================================================
-- Nosso Cantinho — esquema do Supabase (versão beta)
--
-- Como usar: Supabase > SQL Editor > New query > cole este arquivo > Run.
-- Depois siga a seção "Configurar o Supabase" do README para criar as
-- contas da Kath e do Drico e vinculá-las ao casal.
--
-- Segurança:
--   * Todas as tabelas têm RLS. Cada pessoa só enxerga os dados do PRÓPRIO casal.
--   * O vínculo usuário → casal fica em `perfis` e só pode ser criado pelo
--     painel/SQL (não existe política de INSERT para usuários).
--   * Usuários só podem alterar `perfis.tema_preferido` e `casais.ajustes`.
--   * Fotos ficam num bucket PRIVADO, em pastas com o id do casal.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Casal e perfis ----------
create table if not exists public.casais (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null default 'Nosso Cantinho',
  ajustes    jsonb not null default '{}'::jsonb check (jsonb_typeof(ajustes) = 'object'),
  criado_em  timestamptz not null default now()
);

create table if not exists public.perfis (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  casal_id        uuid not null references public.casais (id) on delete cascade,
  nome            text not null constraint perfis_nome_check check (nome ~ '^[a-z0-9._-]{2,30}$'), -- login (kath, drico, lavi…)
  apelido         text,                                   -- nome mostrado no site
  tratamento      text not null default 'neutro' constraint perfis_tratamento_check check (tratamento in ('ela', 'ele', 'neutro')),
  tema_padrao     text constraint perfis_tema_padrao_check check (tema_padrao is null or tema_padrao in ('mistica', 'punk', 'laco', 'onda', 'aquarela', 'cinza', 'azul')),
  tema_preferido  text constraint perfis_tema_preferido_check check (tema_preferido in ('mistica', 'punk', 'laco', 'onda', 'aquarela', 'cinza', 'azul')),
  criado_em       timestamptz not null default now(),
  unique (casal_id, nome)
);

-- Casal do usuário logado (security definer evita recursão nas políticas de `perfis`)
create or replace function public.meu_casal()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select casal_id from public.perfis where user_id = auth.uid()
$$;
revoke all on function public.meu_casal() from public, anon;
grant execute on function public.meu_casal() to authenticated;

alter table public.casais enable row level security;
alter table public.perfis enable row level security;

drop policy if exists "membros leem o casal" on public.casais;
create policy "membros leem o casal" on public.casais
  for select to authenticated using (id = public.meu_casal());

drop policy if exists "membros alteram ajustes do casal" on public.casais;
create policy "membros alteram ajustes do casal" on public.casais
  for update to authenticated using (id = public.meu_casal()) with check (id = public.meu_casal());

drop policy if exists "membros veem perfis do casal" on public.perfis;
create policy "membros veem perfis do casal" on public.perfis
  for select to authenticated using (casal_id = public.meu_casal());

drop policy if exists "cada um altera o proprio perfil" on public.perfis;
create policy "cada um altera o proprio perfil" on public.perfis
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Restringe as COLUNAS que podem ser alteradas pelo app
revoke all on public.casais, public.perfis from anon;
revoke insert, update, delete on public.casais, public.perfis from authenticated;
grant select on public.casais, public.perfis to authenticated;
grant update (ajustes) on public.casais to authenticated;
grant update (tema_preferido) on public.perfis to authenticated;

-- ---------- Conteúdo do casal ----------
-- Na beta, cada item guarda seus campos em `dados` (jsonb). Os itens de uma
-- lista ficam dentro de listas.dados.itens. Ver README > "Próximos passos".
do $$
declare
  t text;
begin
  foreach t in array array['cartas', 'listas', 'filmes', 'videos', 'memorias', 'mensagens', 'desenhos'] loop
    execute format($f$
      create table if not exists public.%1$I (
        id             uuid primary key default gen_random_uuid(),
        casal_id       uuid not null default public.meu_casal() references public.casais (id) on delete cascade,
        criado_por     uuid default auth.uid() references auth.users (id) on delete set null,
        dados          jsonb not null default '{}'::jsonb
                       check (jsonb_typeof(dados) = 'object' and pg_column_size(dados) < 200000),
        criado_em      timestamptz not null default now(),
        atualizado_em  timestamptz not null default now()
      )$f$, t);

    execute format('create index if not exists %1$s_casal_idx on public.%1$I (casal_id, criado_em desc)', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format('drop policy if exists "casal le" on public.%I', t);
    execute format('create policy "casal le" on public.%I for select to authenticated using (casal_id = public.meu_casal())', t);

    execute format('drop policy if exists "casal cria" on public.%I', t);
    execute format('create policy "casal cria" on public.%I for insert to authenticated with check (casal_id = public.meu_casal() and criado_por = auth.uid())', t);

    execute format('drop policy if exists "casal altera" on public.%I', t);
    execute format('create policy "casal altera" on public.%I for update to authenticated using (casal_id = public.meu_casal()) with check (casal_id = public.meu_casal())', t);

    execute format('drop policy if exists "casal exclui" on public.%I', t);
    execute format('create policy "casal exclui" on public.%I for delete to authenticated using (casal_id = public.meu_casal())', t);
  end loop;
end
$$;

-- ---------- Fotos (Storage) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memorias', 'memorias', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "casal le fotos" on storage.objects;
create policy "casal le fotos" on storage.objects
  for select to authenticated
  using (bucket_id = 'memorias' and (storage.foldername(name))[1] = public.meu_casal()::text);

drop policy if exists "casal envia fotos" on storage.objects;
create policy "casal envia fotos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'memorias' and (storage.foldername(name))[1] = public.meu_casal()::text);

drop policy if exists "casal apaga fotos" on storage.objects;
create policy "casal apaga fotos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'memorias' and (storage.foldername(name))[1] = public.meu_casal()::text);

-- ---------- Cinema: assistir junto (Realtime, canal privado do casal) ----------
drop policy if exists "casal entra na sala do cinema" on realtime.messages;
create policy "casal entra na sala do cinema" on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'cinema:' || public.meu_casal()::text);

drop policy if exists "casal envia na sala do cinema" on realtime.messages;
create policy "casal envia na sala do cinema" on realtime.messages
  for insert to authenticated
  with check (realtime.topic() = 'cinema:' || public.meu_casal()::text);

-- ---------- Notificações no celular (Web Push) ----------
create table if not exists public.push_inscricoes (
  id          uuid primary key default gen_random_uuid(),
  casal_id    uuid not null default public.meu_casal() references public.casais (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  perfil      text not null constraint push_inscricoes_perfil_check check (perfil ~ '^[a-z0-9._-]{2,30}$'),
  endpoint    text not null unique check (endpoint like 'https://%'),
  p256dh      text not null,
  auth        text not null,
  aparelho    text,
  criado_em   timestamptz not null default now()
);

create index if not exists push_inscricoes_casal_perfil on public.push_inscricoes (casal_id, perfil);

alter table public.push_inscricoes enable row level security;

grant select, insert, delete on public.push_inscricoes to authenticated;

drop policy if exists "casal ve inscricoes" on public.push_inscricoes;
create policy "casal ve inscricoes" on public.push_inscricoes
  for select to authenticated
  using (casal_id = public.meu_casal());

-- Só dá para cadastrar o PRÓPRIO aparelho, com o PRÓPRIO perfil
drop policy if exists "cada um inscreve o proprio aparelho" on public.push_inscricoes;
create policy "cada um inscreve o proprio aparelho" on public.push_inscricoes
  for insert to authenticated
  with check (
    casal_id = public.meu_casal()
    and user_id = auth.uid()
    and perfil = (select p.nome from public.perfis p where p.user_id = auth.uid())
  );

-- Qualquer um do casal pode remover (limpa aparelhos trocados de conta ou desativados)
drop policy if exists "casal remove inscricoes" on public.push_inscricoes;
create policy "casal remove inscricoes" on public.push_inscricoes
  for delete to authenticated
  using (casal_id = public.meu_casal());

-- =====================================================================
-- PRÓXIMO PASSO: crie as contas da Kath e do Drico em Authentication > Users
-- e rode o arquivo supabase/vincular-contas.sql (trocando os e-mails).
-- =====================================================================

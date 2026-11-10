-- =====================================================================
-- Nosso Cantinho — uma pessoa em mais de um casal + casal 3 (Lavi e Ric)
--
-- Rode DEPOIS de supabase/varios-casais.sql, no SQL Editor do Supabase.
-- Pode rodar de novo sem problema.
--
-- 1. Uma conta pode participar de vários casais (ex.: a Lavi está com a Marih
--    e com o Ric). Ao entrar, ela escolhe em qual cantinho quer ficar.
--    As regras de segurança passam a ser "os casais de que eu participo":
--    a Marih continua sem ver nada do Ric, e o Ric nada da Marih.
-- 2. Cria o casal 3: Lavi (a mesma conta) e Rick
--      login "rick" → rick@nossocantinho.app (senha inicial rick1234: troque depois)
--    Se a conta já existir (como "rick" ou "ric"), não mexe nela.
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- 1. Participação em vários casais ----------

-- Todos os casais de que a pessoa logada participa
create or replace function public.meus_casais()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select casal_id from public.perfis where user_id = auth.uid()
$$;
revoke all on function public.meus_casais() from public, anon;
grant execute on function public.meus_casais() to authenticated;

-- Continua existindo (valor padrão das tabelas): devolve o primeiro casal da pessoa.
-- O site sempre informa o casal ao gravar, então quem tem dois casais não depende disto.
create or replace function public.meu_casal()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select casal_id from public.perfis where user_id = auth.uid() order by criado_em, casal_id limit 1
$$;

-- Um perfil por (pessoa, casal)
alter table public.perfis drop constraint if exists perfis_pkey;
alter table public.perfis add constraint perfis_pkey primary key (user_id, casal_id);

-- Casal e perfis
drop policy if exists "membros leem o casal" on public.casais;
create policy "membros leem o casal" on public.casais
  for select to authenticated using (id in (select public.meus_casais()));

drop policy if exists "membros alteram ajustes do casal" on public.casais;
create policy "membros alteram ajustes do casal" on public.casais
  for update to authenticated using (id in (select public.meus_casais())) with check (id in (select public.meus_casais()));

drop policy if exists "membros veem perfis do casal" on public.perfis;
create policy "membros veem perfis do casal" on public.perfis
  for select to authenticated using (casal_id in (select public.meus_casais()));

-- Conteúdo (cartinhas, listas, filmes, vídeos, memórias, chat, desenhos)
do $$
declare
  t text;
begin
  foreach t in array array['cartas', 'listas', 'filmes', 'videos', 'memorias', 'mensagens', 'desenhos'] loop
    continue when to_regclass('public.' || t) is null;
    execute format('drop policy if exists "casal le" on public.%I', t);
    execute format('create policy "casal le" on public.%I for select to authenticated using (casal_id in (select public.meus_casais()))', t);
    execute format('drop policy if exists "casal cria" on public.%I', t);
    execute format('create policy "casal cria" on public.%I for insert to authenticated with check (casal_id in (select public.meus_casais()) and criado_por = auth.uid())', t);
    execute format('drop policy if exists "casal altera" on public.%I', t);
    execute format('create policy "casal altera" on public.%I for update to authenticated using (casal_id in (select public.meus_casais())) with check (casal_id in (select public.meus_casais()))', t);
    execute format('drop policy if exists "casal exclui" on public.%I', t);
    execute format('create policy "casal exclui" on public.%I for delete to authenticated using (casal_id in (select public.meus_casais()))', t);
  end loop;
end
$$;

-- Fotos (pasta com o id do casal)
drop policy if exists "casal le fotos" on storage.objects;
create policy "casal le fotos" on storage.objects
  for select to authenticated
  using (bucket_id = 'memorias' and (storage.foldername(name))[1] in (select public.meus_casais()::text));

drop policy if exists "casal envia fotos" on storage.objects;
create policy "casal envia fotos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'memorias' and (storage.foldername(name))[1] in (select public.meus_casais()::text));

drop policy if exists "casal apaga fotos" on storage.objects;
create policy "casal apaga fotos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'memorias' and (storage.foldername(name))[1] in (select public.meus_casais()::text));

-- Tempo real (Cinema, avisos, chat): sala de cada casal
drop policy if exists "casal entra na sala do cinema" on realtime.messages;
create policy "casal entra na sala do cinema" on realtime.messages
  for select to authenticated
  using (realtime.topic() in (select 'cinema:' || c::text from public.meus_casais() as c));

drop policy if exists "casal envia na sala do cinema" on realtime.messages;
create policy "casal envia na sala do cinema" on realtime.messages
  for insert to authenticated
  with check (realtime.topic() in (select 'cinema:' || c::text from public.meus_casais() as c));

-- Notificações: o mesmo celular pode receber de cada casal da pessoa
do $$
begin
  if to_regclass('public.push_inscricoes') is null then return; end if;
  alter table public.push_inscricoes drop constraint if exists push_inscricoes_endpoint_key;
  alter table public.push_inscricoes drop constraint if exists push_inscricoes_endpoint_casal_key;
  alter table public.push_inscricoes add constraint push_inscricoes_endpoint_casal_key unique (endpoint, casal_id);

  drop policy if exists "casal ve inscricoes" on public.push_inscricoes;
  create policy "casal ve inscricoes" on public.push_inscricoes
    for select to authenticated using (casal_id in (select public.meus_casais()));

  drop policy if exists "cada um inscreve o proprio aparelho" on public.push_inscricoes;
  create policy "cada um inscreve o proprio aparelho" on public.push_inscricoes
    for insert to authenticated
    with check (
      user_id = auth.uid()
      and exists (select 1 from public.perfis p
                  where p.user_id = auth.uid() and p.casal_id = push_inscricoes.casal_id and p.nome = push_inscricoes.perfil)
    );

  drop policy if exists "casal remove inscricoes" on public.push_inscricoes;
  create policy "casal remove inscricoes" on public.push_inscricoes
    for delete to authenticated using (casal_id in (select public.meus_casais()));
end
$$;

-- ---------- 2. Casal 3: Lavi e Rick ----------
do $$
declare
  email_ric text := 'rick@nossocantinho.app';
  id_ric uuid;
  id_lavi uuid;
  id_casal uuid;
begin
  select id into id_lavi from auth.users where lower(split_part(email, '@', 1)) = 'lavi' limit 1;
  if id_lavi is null then
    raise exception 'Conta da Lavi não encontrada. Rode antes o arquivo supabase/varios-casais.sql.';
  end if;

  select id into id_ric from auth.users where lower(split_part(email, '@', 1)) in ('rick', 'ric') limit 1;
  if id_ric is null then
    id_ric := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', id_ric, 'authenticated', 'authenticated',
      email_ric, crypt('rick1234', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), id_ric, id_ric::text,
      jsonb_build_object('sub', id_ric::text, 'email', email_ric, 'email_verified', true),
      'email', now(), now(), now()
    );
    raise notice 'Conta criada: %', email_ric;
  end if;

  -- Casal NOVO do Ric (nunca o casal da Lavi com a Marih)
  select casal_id into id_casal from public.perfis where user_id = id_ric limit 1;
  if id_casal is null then
    insert into public.casais (nome) values ('Cantinho da Lavi e do Rick') returning id into id_casal;
  end if;

  insert into public.perfis (user_id, casal_id, nome, apelido, tratamento, tema_padrao)
  values
    (id_ric,  id_casal, 'ric',  'Rick', 'ele', 'onda'),
    (id_lavi, id_casal, 'lavi', 'Lavi', 'ela', 'mistica')
  on conflict (user_id, casal_id) do nothing;

  raise notice 'Pronto! Lavi e Rick no casal %', id_casal;
end
$$;

-- Conferência: a Lavi aparece em DOIS casais (um com a Marih, outro com o Ric)
select p.casal_id, c.nome as cantinho, p.nome, p.apelido, p.tratamento, u.email
from public.perfis p
join public.casais c on c.id = p.casal_id
join auth.users u on u.id = p.user_id
order by c.criado_em, p.nome;

-- =====================================================================
-- Nosso Cantinho — vários casais + casal 2 (Lavi e Marih)
--
-- Rode UMA VEZ no SQL Editor do Supabase (pode rodar de novo sem problema).
--
-- 1. Libera perfis com qualquer nome (antes só existiam "kath" e "drico")
--    e acrescenta: apelido (nome mostrado), tratamento (ela/ele/neutro, usado
--    em frases como "Bem-vinda"/"Bem-vindo") e tema_padrao.
-- 2. Completa os dados da Kath e do Drico (casal 1). Nada do que já existe muda.
-- 3. Cria o casal 2, separado do casal 1:
--      login "lavi"  → lavi@nossocantinho.app   senha: lavi1234
--      login "marih" → marih@nossocantinho.app  senha: marih1234
--    No site a pessoa digita só o NOME (lavi / marih) e a senha.
--
-- Cada casal só enxerga os próprios dados (as regras de segurança usam o casal
-- de quem está logado). Se mudou LOGIN_DOMINIO, troque o domínio dos e-mails.
-- Troque as senhas depois (Authentication > Users).
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- 1. Perfis com qualquer nome ----------
alter table public.perfis drop constraint if exists perfis_nome_check;
alter table public.perfis add constraint perfis_nome_check check (nome ~ '^[a-z0-9._-]{2,30}$');

alter table public.perfis add column if not exists apelido text;
alter table public.perfis add column if not exists tratamento text not null default 'neutro';
alter table public.perfis add column if not exists tema_padrao text;
alter table public.perfis drop constraint if exists perfis_tratamento_check;
alter table public.perfis add constraint perfis_tratamento_check check (tratamento in ('ela', 'ele', 'neutro'));
alter table public.perfis drop constraint if exists perfis_tema_padrao_check;
update public.perfis set tema_padrao = case tema_padrao when 'kath' then 'laco' when 'drico' then 'punk' when 'neutro' then null else tema_padrao end
  where tema_padrao in ('kath', 'drico', 'neutro');
alter table public.perfis add constraint perfis_tema_padrao_check check (tema_padrao is null or tema_padrao in ('mistica', 'punk', 'laco', 'onda', 'aquarela', 'cinza', 'azul'));

do $$
begin
  if to_regclass('public.push_inscricoes') is not null then
    alter table public.push_inscricoes drop constraint if exists push_inscricoes_perfil_check;
    alter table public.push_inscricoes add constraint push_inscricoes_perfil_check check (perfil ~ '^[a-z0-9._-]{2,30}$');
  end if;
end
$$;

-- ---------- 2. Casal 1: Kath e Drico ----------
update public.perfis set apelido = coalesce(apelido, 'Kath'), tratamento = 'ela', tema_padrao = coalesce(tema_padrao, 'laco') where nome = 'kath';
update public.perfis set apelido = coalesce(apelido, 'Drico'), tratamento = 'ele', tema_padrao = coalesce(tema_padrao, 'punk') where nome = 'drico';

-- ---------- 3. Casal 2: Lavi e Marih ----------
do $$
declare
  conta record;
  novo_id uuid;
  id_lavi uuid;
  id_marih uuid;
  id_casal uuid;
begin
  -- Contas de login (já confirmadas)
  for conta in
    select * from (values
      ('lavi@nossocantinho.app',  'lavi1234'),
      ('marih@nossocantinho.app', 'marih1234')
    ) as v(email, senha)
  loop
    if not exists (select 1 from auth.users where lower(split_part(email, '@', 1)) = lower(split_part(conta.email, '@', 1))) then
      novo_id := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', novo_id, 'authenticated', 'authenticated',
        conta.email, crypt(conta.senha, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
        '', '', '', ''
      );
      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), novo_id, novo_id::text,
        jsonb_build_object('sub', novo_id::text, 'email', conta.email, 'email_verified', true),
        'email', now(), now(), now()
      );
      raise notice 'Conta criada: %', conta.email;
    else
      raise notice 'Conta já existia (não alterada): %', conta.email;
    end if;
  end loop;

  select id into id_lavi from auth.users where lower(split_part(email, '@', 1)) = 'lavi' limit 1;
  select id into id_marih from auth.users where lower(split_part(email, '@', 1)) = 'marih' limit 1;

  -- Casal NOVO (nunca reaproveita o casal da Kath e do Drico)
  select casal_id into id_casal from public.perfis where user_id in (id_lavi, id_marih) limit 1;
  if id_casal is null then
    insert into public.casais (nome) values ('Cantinho da Lavi e da Marih') returning id into id_casal;
  end if;

  insert into public.perfis (user_id, casal_id, nome, apelido, tratamento, tema_padrao)
  values
    (id_lavi,  id_casal, 'lavi',  'Lavi',  'ela', 'mistica'),
    (id_marih, id_casal, 'marih', 'Marih', 'ela', 'aquarela')
  on conflict do nothing;

  raise notice 'Pronto! Lavi e Marih no casal %', id_casal;
end
$$;

-- Conferência: Kath e Drico com um casal_id; Lavi e Marih com OUTRO casal_id
select p.casal_id, p.nome, p.apelido, p.tratamento, u.email
from public.perfis p
join auth.users u on u.id = p.user_id
order by p.casal_id, p.nome;

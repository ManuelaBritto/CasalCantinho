-- =====================================================================
-- Nosso Cantinho — criar as contas de login direto pelo SQL (opcional)
--
-- Cria (se ainda não existirem) as duas contas já confirmadas:
--     login "kathh" → kathh@nossocantinho.app   senha: kath1234
--     login "drico" → drico@nossocantinho.app  senha: drico1234
-- No site a pessoa digita só o NOME (kath / drico) e a senha.
--
-- Atenção: troque as senhas depois de entrar pela primeira vez
-- (Authentication > Users > ... > Send password recovery / Update user).
-- Se mudou LOGIN_DOMINIO, troque o domínio dos e-mails abaixo.
-- Pode rodar mais de uma vez: não duplica nem altera contas existentes.
-- Alternativa: criar as contas manualmente em Authentication > Users.
-- =====================================================================
create extension if not exists pgcrypto;

do $$
declare
  conta record;
  novo_id uuid;
begin
  for conta in
    select * from (values
      ('kathh@nossocantinho.app',  'kath1234'),
      ('drico@nossocantinho.app', 'drico1234')
    ) as v(email, senha)
  loop
    if not exists (select 1 from auth.users where lower(email) = lower(conta.email)) then
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
end
$$;

-- =====================================================================
-- Nosso Cantinho — PARTE 2: vincular as contas da Kath e do Drico ao casal
--
-- ANTES: crie as duas contas em Authentication > Users > Add user, com
-- estes e-mails internos (o login no site é só pelo NOME + senha):
--     kath@nossocantinho.app      e      drico@nossocantinho.app
-- Se mudou LOGIN_DOMINIO no .env/Vercel, troque o domínio abaixo também.
-- Pode rodar mais de uma vez sem problema (não duplica o casal nem os perfis).
-- =====================================================================
do $$
declare
  email_kath text := 'kath@nossocantinho.app';
  email_drico text := 'drico@nossocantinho.app';
  id_kath   uuid;
  id_drico  uuid;
  id_casal  uuid;
begin
  select id into id_kath from auth.users where lower(email) = lower(email_kath);
  select id into id_drico from auth.users where lower(email) = lower(email_drico);

  if id_kath is null then
    raise exception 'Conta da Kath (%) não encontrada. Crie em Authentication > Users ou confira o e-mail.', email_kath;
  end if;
  if id_drico is null then
    raise exception 'Conta do Drico (%) não encontrada. Crie em Authentication > Users ou confira o e-mail.', email_drico;
  end if;

  -- Reaproveita o casal se uma das contas já estiver vinculada
  select casal_id into id_casal from public.perfis where user_id in (id_kath, id_drico) limit 1;
  if id_casal is null then
    insert into public.casais default values returning id into id_casal;
  end if;

  insert into public.perfis (user_id, casal_id, nome)
  values (id_kath, id_casal, 'kath'), (id_drico, id_casal, 'drico')
  on conflict (user_id) do nothing;

  raise notice 'Pronto! Kath e Drico vinculados ao casal %', id_casal;
end
$$;

-- Conferência: devem aparecer 2 linhas (kath e drico) com o mesmo casal_id
select p.nome, u.email, p.casal_id
from public.perfis p
join auth.users u on u.id = p.user_id
order by p.nome;

-- =====================================================================
--  Temas novos (um por pessoa)
--  Rode UMA vez no SQL Editor do Supabase, depois dos outros arquivos.
--  Pode rodar de novo sem problema.
--
--  Temas:  mistica  = Lua Mística   (Lavi)
--          punk     = Estrela Punk  (Drico)
--          laco     = Laço de Rosa  (Kath)
--          onda     = Onda Coral    (Rick)
--          aquarela = Aquarela      (Marih)
--          cinza    = Cinza         (admin, teste)
--          azul     = Azul          (admin2, teste)
--
--  Cada casal só enxerga os temas das duas pessoas dele (o site cuida disso).
--  Os temas antigos (Neutro, Gótico, Girassol) deixam de existir.
-- =====================================================================

begin;

alter table public.perfis add column if not exists tema_padrao text;

-- 1) Tira as regras antigas
alter table public.perfis drop constraint if exists perfis_tema_padrao_check;
alter table public.perfis drop constraint if exists perfis_tema_preferido_check;

-- 2) Converte o que já estava salvo
update public.perfis set tema_preferido = case tema_preferido
    when 'kath' then 'laco'
    when 'drico' then 'punk'
    else null end
  where tema_preferido is not null and tema_preferido not in ('mistica', 'punk', 'laco', 'onda', 'aquarela', 'cinza', 'azul');

-- 3) Tema de cada pessoa
update public.perfis set tema_padrao = 'laco'     where nome = 'kath';
update public.perfis set tema_padrao = 'punk'     where nome = 'drico';
update public.perfis set tema_padrao = 'mistica'  where nome = 'lavi';
update public.perfis set tema_padrao = 'aquarela' where nome = 'marih';
update public.perfis set tema_padrao = 'onda'     where nome in ('ric', 'rick');
update public.perfis set tema_padrao = 'cinza'    where nome = 'admin';
update public.perfis set tema_padrao = 'azul'     where nome = 'admin2';
update public.perfis set tema_padrao = null
  where tema_padrao is not null and tema_padrao not in ('mistica', 'punk', 'laco', 'onda', 'aquarela', 'cinza', 'azul');

-- 4) Regras novas
alter table public.perfis add constraint perfis_tema_padrao_check
  check (tema_padrao is null or tema_padrao in ('mistica', 'punk', 'laco', 'onda', 'aquarela', 'cinza', 'azul'));
alter table public.perfis add constraint perfis_tema_preferido_check
  check (tema_preferido is null or tema_preferido in ('mistica', 'punk', 'laco', 'onda', 'aquarela', 'cinza', 'azul'));

commit;

-- Conferir:
-- select c.nome as casal, p.nome, p.apelido, p.tema_padrao, p.tema_preferido
--   from public.perfis p join public.casais c on c.id = p.casal_id order by 1, 2;

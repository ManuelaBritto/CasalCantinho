-- =====================================================================
-- Nosso Cantinho — quadro branco (aba Diversão). Os desenhos do "Como eu te vejo" vão para as cartinhas.
-- Rode UMA vez no SQL Editor do Supabase (pode rodar de novo sem problema).
-- Cria a tabela "desenhos" com as mesmas regras das outras: só o casal lê e escreve.
-- (Quem rodar o schema.sql completo de novo já ganha esta tabela.)
-- =====================================================================
create table if not exists public.desenhos (
  id             uuid primary key default gen_random_uuid(),
  casal_id       uuid not null default public.meu_casal() references public.casais (id) on delete cascade,
  criado_por     uuid default auth.uid() references auth.users (id) on delete set null,
  dados          jsonb not null default '{}'::jsonb
                 check (jsonb_typeof(dados) = 'object' and pg_column_size(dados) < 200000),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists desenhos_casal_idx on public.desenhos (casal_id, criado_em desc);
alter table public.desenhos enable row level security;
revoke all on public.desenhos from anon;
grant select, insert, update, delete on public.desenhos to authenticated;

drop policy if exists "casal le" on public.desenhos;
create policy "casal le" on public.desenhos
  for select to authenticated using (casal_id = public.meu_casal());

drop policy if exists "casal cria" on public.desenhos;
create policy "casal cria" on public.desenhos
  for insert to authenticated with check (casal_id = public.meu_casal() and criado_por = auth.uid());

drop policy if exists "casal altera" on public.desenhos;
create policy "casal altera" on public.desenhos
  for update to authenticated using (casal_id = public.meu_casal()) with check (casal_id = public.meu_casal());

drop policy if exists "casal exclui" on public.desenhos;
create policy "casal exclui" on public.desenhos
  for delete to authenticated using (casal_id = public.meu_casal());

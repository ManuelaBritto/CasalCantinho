-- =====================================================================
-- Nosso Cantinho — Notificações no celular (Web Push)
-- Rode no SQL Editor do Supabase DEPOIS dos outros arquivos
-- (pode rodar de novo sem problema, em qualquer ordem depois deles).
--
-- Guarda os aparelhos em que cada perfil ativou as notificações.
-- Cada linha é a "inscrição" de um navegador/app instalado (não tem senha nem
-- dado pessoal: é o endereço do serviço de push e as chaves públicas do aparelho).
-- Cada casal só enxerga as próprias inscrições; cada um só cria as suas.
-- Quem está em dois cantinhos (ex.: Lavi) tem uma linha por cantinho no mesmo aparelho.
-- =====================================================================

-- Todos os casais de que a pessoa logada participa (o mesmo de pessoa-em-varios-casais.sql)
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

create table if not exists public.push_inscricoes (
  id          uuid primary key default gen_random_uuid(),
  casal_id    uuid not null default public.meu_casal() references public.casais (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  perfil      text not null constraint push_inscricoes_perfil_check check (perfil ~ '^[a-z0-9._-]{2,30}$'),
  endpoint    text not null check (endpoint like 'https://%'),
  p256dh      text not null,
  auth        text not null,
  aparelho    text,
  criado_em   timestamptz not null default now()
);

-- Um aparelho pode estar em mais de um cantinho (uma linha por casal)
alter table public.push_inscricoes drop constraint if exists push_inscricoes_endpoint_key;
alter table public.push_inscricoes drop constraint if exists push_inscricoes_endpoint_casal_key;
alter table public.push_inscricoes add constraint push_inscricoes_endpoint_casal_key unique (endpoint, casal_id);

create index if not exists push_inscricoes_casal_perfil on public.push_inscricoes (casal_id, perfil);

alter table public.push_inscricoes enable row level security;

grant select, insert, delete on public.push_inscricoes to authenticated;

drop policy if exists "casal ve inscricoes" on public.push_inscricoes;
create policy "casal ve inscricoes" on public.push_inscricoes
  for select to authenticated
  using (casal_id in (select public.meus_casais()));

-- Só dá para cadastrar o PRÓPRIO aparelho, com o PRÓPRIO perfil daquele casal
drop policy if exists "cada um inscreve o proprio aparelho" on public.push_inscricoes;
create policy "cada um inscreve o proprio aparelho" on public.push_inscricoes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.perfis p
                where p.user_id = auth.uid() and p.casal_id = push_inscricoes.casal_id and p.nome = push_inscricoes.perfil)
  );

-- Qualquer um do casal pode remover (limpa aparelhos trocados de conta ou desativados)
drop policy if exists "casal remove inscricoes" on public.push_inscricoes;
create policy "casal remove inscricoes" on public.push_inscricoes
  for delete to authenticated
  using (casal_id in (select public.meus_casais()));

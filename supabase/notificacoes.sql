-- =====================================================================
-- Nosso Cantinho — Notificações no celular (Web Push)
-- Rode UMA vez no SQL Editor do Supabase (pode rodar de novo sem problema).
--
-- Guarda os aparelhos em que cada perfil ativou as notificações.
-- Cada linha é a "inscrição" de um navegador/app instalado (não tem senha nem
-- dado pessoal: é o endereço do serviço de push e as chaves públicas do aparelho).
-- Só o casal enxerga as próprias inscrições; cada um só cria as suas.
-- =====================================================================

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

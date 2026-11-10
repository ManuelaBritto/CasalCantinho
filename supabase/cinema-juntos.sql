-- =====================================================================
-- Nosso Cantinho — "Assistir junto" no Cinema (Supabase Realtime)
--
-- Libera o canal PRIVADO "cinema:<id do casal>" só para as duas contas do casal.
-- Por ele passam: vídeo carregado, play/pause/posição e reações.
-- Nada fica gravado: são mensagens ao vivo (Broadcast) e presença (Presence).
--
-- Como usar: Supabase > SQL Editor > New query > cole este arquivo > Run.
-- Pode rodar mais de uma vez.
-- =====================================================================

drop policy if exists "casal entra na sala do cinema" on realtime.messages;
create policy "casal entra na sala do cinema" on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'cinema:' || public.meu_casal()::text);

drop policy if exists "casal envia na sala do cinema" on realtime.messages;
create policy "casal envia na sala do cinema" on realtime.messages
  for insert to authenticated
  with check (realtime.topic() = 'cinema:' || public.meu_casal()::text);

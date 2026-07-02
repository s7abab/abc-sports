create table if not exists public.chat_messages (
  id uuid primary key,
  player_id text not null,
  author text not null check (char_length(author) between 1 and 28),
  body text not null check (char_length(body) between 1 and 280),
  kind text not null check (kind in ('message', 'reaction')),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_room_time_idx
  on public.chat_messages (player_id, created_at desc);

alter table public.chat_messages enable row level security;

drop policy if exists "Anyone can read live chat" on public.chat_messages;
create policy "Anyone can read live chat"
  on public.chat_messages
  for select
  using (true);

drop policy if exists "Server route writes live chat" on public.chat_messages;
create policy "Server route writes live chat"
  on public.chat_messages
  for insert
  with check (true);

alter publication supabase_realtime add table public.chat_messages;

-- Optional scheduled cleanup for larger rooms:
-- delete from public.chat_messages
-- where created_at < now() - interval '24 hours';

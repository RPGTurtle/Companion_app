-- Esegui questo script nell'SQL Editor di Supabase per abilitare gli orologi/countdown
-- (i "clock" a spicchi, gestiti dal GM e visibili a tutta la stanza)

create table if not exists room_clocks (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  nome text not null,
  segmenti_totali int not null,
  segmenti_completati int not null default 0,
  ordine bigint not null default extract(epoch from now()) * 1000,
  created_at timestamptz not null default now()
);

create index if not exists room_clocks_room_code_idx on room_clocks (room_code, ordine);

alter table room_clocks enable row level security;

create policy "Chiunque può leggere gli orologi della stanza"
  on room_clocks for select
  using (true);

create policy "Chiunque può creare orologi"
  on room_clocks for insert
  with check (true);

create policy "Chiunque può aggiornare gli orologi"
  on room_clocks for update
  using (true);

create policy "Chiunque può eliminare gli orologi"
  on room_clocks for delete
  using (true);

alter publication supabase_realtime add table room_clocks;

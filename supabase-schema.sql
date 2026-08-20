-- Esegui questo script nell'SQL Editor di Supabase (Dashboard → SQL Editor → New query)

create table if not exists rolls (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  nickname text not null,
  dice_count int not null default 0,
  dice_sides int not null default 0,
  modifier int not null default 0,
  notation text,
  breakdown jsonb,
  results int[] not null,
  total int not null,
  created_at timestamptz not null default now()
);

create index if not exists rolls_room_code_idx on rolls (room_code, created_at);

-- Attiva Row Level Security
alter table rolls enable row level security;

-- Chiunque può leggere i tiri di una stanza (nessun dato sensibile)
create policy "Chiunque può leggere i tiri"
  on rolls for select
  using (true);

-- Chiunque può inserire un nuovo tiro
create policy "Chiunque può inserire un tiro"
  on rolls for insert
  with check (true);

-- Abilita la pubblicazione realtime sulla tabella
alter publication supabase_realtime add table rolls;

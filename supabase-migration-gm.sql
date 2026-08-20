-- Esegui questo script nell'SQL Editor di Supabase per abilitare il ruolo Game Master
-- (sfondo personalizzato + musica condivisa per la stanza)

create table if not exists room_settings (
  room_code text primary key,
  background_color text,
  background_image text,
  media_url text,
  media_type text,
  updated_at timestamptz not null default now()
);

alter table room_settings enable row level security;

create policy "Chiunque può leggere le impostazioni stanza"
  on room_settings for select
  using (true);

create policy "Chiunque può creare impostazioni stanza"
  on room_settings for insert
  with check (true);

create policy "Chiunque può aggiornare impostazioni stanza"
  on room_settings for update
  using (true);

alter publication supabase_realtime add table room_settings;

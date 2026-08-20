-- Esegui questo script nell'SQL Editor di Supabase per abilitare il caricamento
-- di immagini e file mp3 dal dispositivo (invece di incollare solo link esterni)

-- Crea il bucket pubblico per i file della stanza (se non esiste già)
insert into storage.buckets (id, name, public)
values ('room-media', 'room-media', true)
on conflict (id) do nothing;

-- Permette a chiunque di leggere i file caricati (necessario per mostrarli/riprodurli)
create policy "Chiunque può leggere i file della stanza"
  on storage.objects for select
  using (bucket_id = 'room-media');

-- Permette a chiunque di caricare file nel bucket (coerente con l'accesso aperto del resto dell'app)
create policy "Chiunque può caricare file nella stanza"
  on storage.objects for insert
  with check (bucket_id = 'room-media');

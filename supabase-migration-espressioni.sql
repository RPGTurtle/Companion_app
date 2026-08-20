-- Esegui questo script nell'SQL Editor di Supabase per abilitare le espressioni multi-dado
-- (es. "2d6+1d20+2d4+3"). Va eseguito DOPO supabase-migration-dadi.sql se non l'hai già fatto.

alter table rolls add column if not exists notation text;
alter table rolls add column if not exists breakdown jsonb;

-- Rende dice_count e dice_sides opzionali per i nuovi tiri multi-dado
-- (restano compilati per compatibilità con lo storico, ma non descrivono più l'intero tiro)
alter table rolls alter column dice_count set default 0;
alter table rolls alter column dice_sides set default 0;

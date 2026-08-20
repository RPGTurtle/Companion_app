-- Esegui questo script nell'SQL Editor di Supabase per aggiornare la tabella esistente
-- (aggiunge il supporto a più tipi di dado e ai modificatori, senza perdere i tiri già salvati)

alter table rolls add column if not exists dice_sides int not null default 6;
alter table rolls add column if not exists modifier int not null default 0;

-- Esegui questo script nell'SQL Editor di Supabase per correggere un bug:
-- l'eliminazione di un orologio funzionava sul database ma l'evento realtime
-- non veniva recapitato ai client (compreso il GM che l'aveva eliminato),
-- perché per default Postgres invia solo l'ID nelle righe cancellate, e il
-- filtro per stanza ha bisogno anche della colonna room_code per funzionare.

alter table room_clocks replica identity full;

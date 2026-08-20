# Tavolo — companion dadi per gdr

Web app per lanciare d6 in tempo reale con i tuoi giocatori, condivisa tramite link. Nessuna app da installare: funziona da mobile e desktop nel browser.

## 1. Crea il progetto Supabase

1. Vai su [supabase.com](https://supabase.com) → **New project** (piano free)
2. Una volta creato, apri **SQL Editor** → **New query**, incolla il contenuto di `supabase-schema.sql` ed esegui (▶ Run)
3. Vai su **Project Settings → API**: copia **Project URL** e **anon public key**, ti serviranno tra poco

## 2. Configura il progetto in locale

```bash
npm install
cp .env.example .env
```

Apri `.env` e incolla i valori copiati da Supabase:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Prova in locale:

```bash
npm run dev
```

## 3. Pubblica su Netlify

**Opzione A — da terminale (più veloce):**

```bash
npm install -g netlify-cli
netlify login
netlify init
```

Segui la procedura guidata (crea nuovo sito). Poi imposta le variabili d'ambiente:

```bash
netlify env:set VITE_SUPABASE_URL "https://xxxxx.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "eyJ..."
netlify deploy --prod
```

**Opzione B — da interfaccia web:**

1. Carica questa cartella su GitHub
2. Su [app.netlify.com](https://app.netlify.com) → **Add new site → Import an existing project**, collega la repo
3. In **Site settings → Environment variables** aggiungi `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
4. Deploy

## Aggiornamento: più tipi di dado

Se hai già un progetto Supabase configurato per la versione precedente (solo d6), devi eseguire una piccola migrazione prima di ridistribuire l'app:

1. Vai su **SQL Editor** nella dashboard Supabase → **New query**
2. Incolla il contenuto di `supabase-migration-dadi.sql` ed esegui (▶ Run)

Questo aggiunge le colonne `dice_sides` e `modifier` alla tabella esistente senza toccare i tiri già salvati. Se stai partendo da zero, ti basta `supabase-schema.sql` (già aggiornato con queste colonne).

## Aggiornamento: espressioni multi-dado (es. 2d6+1d20+2d4+3)

Se hai già configurato Supabase in precedenza, esegui anche `supabase-migration-espressioni.sql` nell'SQL Editor (dopo quella dei dadi). Aggiunge le colonne `notation` e `breakdown` per salvare l'espressione completa e il dettaglio di ogni gruppo di dadi lanciato.

Nell'app ora c'è un campo di testo dove scrivere l'espressione direttamente (es. `2d6+1d20+2d4+3`), con dei pulsanti rapidi `+d6`, `+d20` ecc. per comporla senza doverla digitare tutta a mano. Le parentesi sono accettate ma ignorate nel calcolo (l'addizione è associativa, quindi non cambiano il risultato).

Poi ricarica i nuovi file su GitHub (sovrascrivendo `App.jsx` e `style.css`) — Netlify farà il redeploy automaticamente.

## Aggiornamento: ruolo Game Master

Se hai già configurato Supabase in precedenza, esegui anche `supabase-migration-gm.sql` nell'SQL Editor. Aggiunge la tabella `room_settings` per sfondo personalizzato e musica condivisa.

Chi crea la stanza (bottone "Crea una nuova stanza") diventa automaticamente Game Master per quella stanza, e vede un pulsante "🎛️ Pannello GM" nell'intestazione con:

- **Sfondo colorato**: 5 tonalità predefinite, applicate a tutti i giocatori in tempo reale
- **Sfondo immagine**: incolla un URL di un'immagine, si applica come sfondo per l'intera stanza
- **Musica condivisa**: incolla un link `.mp3`, un link YouTube o un link Spotify — appare un player per tutti i giocatori nella stanza

**Limite onesto**: la musica non è sincronizzata al secondo tra i dispositivi — ogni giocatore avvia/mette in pausa il proprio player. Funziona bene come sottofondo d'atmosfera, non come "ascolto sincronizzato".

Il ruolo di GM è legato al browser che ha creato la stanza (salvato localmente): se il GM apre la stanza da un altro dispositivo o cancella i dati del browser, perde l'accesso al pannello per quella stanza.

### Caricare file dal dispositivo (invece di solo link)

Per permettere al GM di caricare direttamente un'immagine o un file mp3 dal proprio computer/telefono (oltre a incollare link esterni), esegui anche `supabase-storage-setup.sql` nell'SQL Editor. Crea un bucket pubblico `room-media` su Supabase Storage con permessi di lettura/scrittura aperti (coerente con l'accesso libero del resto dell'app, senza autenticazione).

Limiti applicati lato app: 8 MB per le immagini, 15 MB per gli mp3 — pensati per restare comodamente dentro il piano gratuito di Supabase Storage (1 GB totali).

## Aggiornamento: orologi/countdown

Se hai già configurato Supabase in precedenza, esegui anche `supabase-migration-clocks.sql` nell'SQL Editor. Aggiunge la tabella `room_clocks`.

Nel pannello GM è comparsa una sezione **"Orologi / countdown"**: il GM può creare un cerchio a spicchi (4, 6, 8, 10 o 12), dargli un nome, e poi usare i pulsanti +/− per marcare quanti spicchi sono completati. Ogni orologio creato compare **subito a tutti i giocatori nella stanza**, sopra il pannello di lancio, aggiornato in tempo reale. Quando tutti gli spicchi sono completati compare un'etichetta "✓ Completo" — la rimozione dalla visualizzazione resta comunque una scelta del GM (bottone 🗑️ nel pannello), non è automatica.

## Aggiornamento: videochiamata condivisa

Nessuna migrazione richiesta — è un semplice iframe incorporato, nessun dato passa da Supabase.

Ogni giocatore trova un pulsante **"🎥 Video/Audio"** nell'intestazione della stanza (non solo il GM: chiunque può aprirlo). Apre/chiude una videochiamata tramite [Jitsi Meet](https://meet.jit.si), gratuita e senza account: tutti quelli che aprono il pannello nella stessa stanza di gioco finiscono automaticamente nella stessa chiamata (il nome della "stanza Jitsi" è derivato dal codice della stanza). Il nome mostrato in chiamata corrisponde al nickname scelto per giocare.

**Limite onesto**: Jitsi Meet pubblico (`meet.jit.si`) è un servizio di terzi gratuito e stabile, ma non è infrastruttura tua — in rari casi di sovraccarico del server pubblico la qualità può risentirne. Per un progetto senza budget resta comunque l'opzione più solida, senza limiti di traffico noti e senza bisogno di creare account.

## Aggiornamento: videochiamata condivisa (JaaS invece di meet.jit.si)

`meet.jit.si` ha smesso di supportare bene l'incorporamento via iframe/API esterna (limita le sessioni embedded a pochi minuti), quindi la videochiamata usa ora **JaaS (Jitsi as a Service)**, il servizio gestito da 8x8: gratuito fino a 25 utenti attivi al mese, nessuna carta di credito richiesta.

JaaS richiede un token (JWT) firmato con una chiave privata per ogni partecipante — la genera una piccola funzione server-side (**Supabase Edge Function**, gratuita fino a 500.000 chiamate/mese). Su richiesta esplicita, AppID/Key ID/chiave privata sono scritti direttamente nel file `supabase/functions/jaas-token/index.ts` invece che nei secrets di Supabase: **questo va bene solo se il repository GitHub resta privato**, perché chiunque acceda al codice ottiene accesso completo alla chiave (può generare token validi per qualsiasi stanza del tuo account JaaS).

### Passi di configurazione

**1. Installa il Supabase CLI in locale** (se non l'hai già)
```
npm install -g supabase
supabase login
```

**2. Collega il CLI al tuo progetto Supabase**

Nella cartella del progetto (quella con `supabase/functions/jaas-token/`):
```
supabase link --project-ref uxhfdcrwjufsdrlduett
```

**3. Distribuisci la funzione**
```
supabase functions deploy jaas-token
```

Il codice della funzione (già con le chiavi incluse) va comunque caricato su Supabase tramite questo comando — caricarlo solo su GitHub non basta, GitHub non esegue codice, serve il deploy per attivarla davvero.

Da questo momento il pulsante "🎥 Video/Audio" nella stanza userà JaaS invece di meet.jit.si, senza limiti di tempo per sessione, restando nel piano gratuito.

## Come funziona

- Chi apre il sito clicca **"Crea una nuova stanza"** → viene generato un codice tipo `LUPO-4821` e un link `tuosito.netlify.app/r/LUPO-4821`
- Condividi quel link con i giocatori (bottone "Invita giocatori" nella stanza copia il link)
- Ognuno inserisce un nickname all'ingresso
- I tiri di dado sono sincronizzati in tempo reale tra tutti i partecipanti tramite Supabase Realtime

## Prossimi passi possibili

- Schede personaggio
- Log/note di sessione persistenti

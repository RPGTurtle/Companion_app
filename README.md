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

## Come funziona

- Chi apre il sito clicca **"Crea una nuova stanza"** → viene generato un codice tipo `LUPO-4821` e un link `tuosito.netlify.app/r/LUPO-4821`
- Condividi quel link con i giocatori (bottone "Invita giocatori" nella stanza copia il link)
- Ognuno inserisce un nickname all'ingresso
- I tiri di dado sono sincronizzati in tempo reale tra tutti i partecipanti tramite Supabase Realtime

## Prossimi passi possibili

- Altri tipi di dado (d4, d8, d10, d20) e modificatori (`2d6+3`)
- Schede personaggio
- Log/note di sessione persistenti

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

## Aggiornamento: videochiamata condivisa (JaaS, distribuita tramite GitHub Actions)

La videochiamata usa **JaaS (Jitsi as a Service)**, il servizio gestito da 8x8: gratuito fino a 25 utenti attivi al mese, nessuna carta di credito richiesta (a differenza di Daily.co, scartato perché la richiedeva anche sul piano gratuito).

JaaS richiede un token (JWT) firmato con una chiave privata per ogni partecipante — la genera una piccola funzione server-side (**Supabase Edge Function**). Il deploy della funzione e l'impostazione dei suoi secrets avvengono **automaticamente tramite una GitHub Action** ad ogni push, così non serve un terminale/Supabase CLI in locale: basta caricare i file su GitHub da qualsiasi dispositivo, browser incluso.

### Passi di configurazione (una tantum)

**1. Crea l'account e la chiave API su JaaS** (se non l'hai già fatto)
- Vai su [jaas.8x8.vc](https://jaas.8x8.vc), registrati gratuitamente
- Copia il tuo **AppID** (in alto nella dashboard, tipo `vpaas-magic-cookie-...`)
- Vai su **API Keys → Add API key → Generate API key pair**
- Scarica subito la **chiave privata** (non è recuperabile dopo) e annota il **Key ID**

**2. Genera un token di accesso Supabase**
- Vai su [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) (funziona anche da telefono)
- **Generate new token**, copialo (compare una sola volta)

**3. Aggiungi 5 secrets al repository GitHub**

Nel repository → **Settings → Secrets and variables → Actions → New repository secret**, uno alla volta:

| Nome | Valore |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | il token generato al passo 2 |
| `SUPABASE_PROJECT_REF` | `uxhfdcrwjufsdrlduett` |
| `JAAS_APP_ID` | il tuo AppID JaaS |
| `JAAS_KEY_ID` | il tuo Key ID JaaS |
| `JAAS_PRIVATE_KEY` | il contenuto completo del file `.pk` della chiave privata (incollalo così com'è, comprese le righe `-----BEGIN PRIVATE KEY-----` e `-----END PRIVATE KEY-----`) |

**4. Carica i file su GitHub**

Basta caricare `App.jsx`, `style.css` e la cartella `supabase/functions/jaas-token/` (più `.github/workflows/deploy-functions.yml`, se non l'hai già) — l'Action parte da sola e distribuisce tutto su Supabase. Puoi seguirne l'esito nella scheda **Actions** del repository.

Da questo momento il pulsante "🎥 Video/Audio" nella stanza userà JaaS, senza limiti di tempo per sessione, restando nel piano gratuito, senza mai dover toccare un terminale per gli aggiornamenti futuri.

**Limite onesto**: 2.000 minuti-partecipante/mese bastano per qualche sessione di gioco al mese con un gruppo di 4-5 persone; se giocate spesso o siete in tanti, la quota gratuita può esaurirsi prima della fine del mese — in quel caso Daily richiede un piano a pagamento per continuare quel mese.

## Come funziona

- Chi apre il sito clicca **"Crea una nuova stanza"** → viene generato un codice tipo `LUPO-4821` e un link `tuosito.netlify.app/r/LUPO-4821`
- Condividi quel link con i giocatori (bottone "Invita giocatori" nella stanza copia il link)
- Ognuno inserisce un nickname all'ingresso
- I tiri di dado sono sincronizzati in tempo reale tra tutti i partecipanti tramite Supabase Realtime

## Prossimi passi possibili

- Schede personaggio
- Log/note di sessione persistenti

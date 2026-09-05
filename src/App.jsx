import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { lanciaEspressione, formattaNotazione } from './diceNotation'
import { Dice3DTray } from './Dice3D'
import { PALETTE_SFONDI, scurisciHex, classificaMedia, pathSpicchio, hexToRgba } from './roomExtras'

// --- Utility: codice stanza leggibile, tipo "CERVO-4821" ---
const ANIMALI = [
  'CERVO', 'LUPO', 'CORVO', 'ORSO', 'FALCO', 'TASSO', 'GUFO', 'VOLPE',
  'LINCE', 'AQUILA', 'DRAGO', 'GRIFONE',
]
function generaCodiceStanza() {
  const animale = ANIMALI[Math.floor(Math.random() * ANIMALI.length)]
  const numero = Math.floor(1000 + Math.random() * 9000)
  return `${animale}-${numero}`
}

// Trasforma un nome scelto dall'utente in un codice-stanza valido per l'URL
// (maiuscolo, solo lettere/numeri/trattini). Se dopo la pulizia non resta
// nulla di utilizzabile, si ricade sul codice generico animale-numero.
function sanificaNomeStanza(testo) {
  return testo
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

// Percorso base dell'app: "/" in locale, "/Companion_app/" su GitHub Pages
const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, '')

function getPath() {
  const pathname = window.location.pathname

  if (BASE_PATH && pathname.startsWith(BASE_PATH)) {
    return pathname.slice(BASE_PATH.length) || '/'
  }

  return pathname
}

function roomUrl(code) {
  return `${BASE_PATH}/r/${code}`
}

// --- Colore deterministico per giocatore, derivato dal nickname ---
function colorePerNickname(nome) {
  let hash = 0
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 62%, 58%)`
}

// --- Cerchio a spicchi (orologio/countdown) ---
function OrologioSVG({ totale, completati, size = 90 }) {
  const cx = 50, cy = 50, r = 46
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {Array.from({ length: totale }).map((_, i) => (
        <path
          key={i}
          d={pathSpicchio(cx, cy, r, i, totale)}
          fill={i < completati ? '#C9A227' : '#0F1D15'}
          stroke="#E8DCC4"
          strokeOpacity="0.3"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  )
}

// --- Dadi rapidi da inserire nell'espressione con un tap ---
const TIPI_DADO = [4, 6, 8, 10, 12, 20, 100]

// --- Faccia 2D statica (solo decorativa, per le schermate di landing/nickname) ---
const PIP_LAYOUTS_D6 = {
  3: [[25, 25], [50, 50], [75, 75]],
}
function DiceFace2D({ size = 72 }) {
  const pips = PIP_LAYOUTS_D6[3]
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <rect x="4" y="4" width="92" height="92" rx="16" fill="#E8DCC4" stroke="rgba(15,29,21,0.35)" strokeWidth="1.5" />
      {pips.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" fill="#0F1D15" />
      ))}
    </svg>
  )
}

// --- Schermata iniziale ---
function Landing() {
  const [joinCode, setJoinCode] = useState('')
  const [nomeStanzaInput, setNomeStanzaInput] = useState('')

  function creaStanza() {
    const nomePulito = sanificaNomeStanza(nomeStanzaInput)
    const code = nomePulito || generaCodiceStanza()
    sessionStorage.setItem(`gm:${code}`, '1')
    window.location.href = roomUrl(code)
  }

  function entraStanza(e) {
    e.preventDefault()
    if (joinCode.trim()) {
     window.location.href = roomUrl(joinCode.trim().toUpperCase())
    }
  }

  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="hero-die">
          <DiceFace2D size={88} />
        </div>
        <h1>Tavolo</h1>
        <p className="hero-sub">Il companion dadi per le tue campagne di gioco di ruolo.</p>
      </div>

      <div className="landing-actions">
        <input
          type="text"
          placeholder="Nome della stanza (facoltativo)"
          value={nomeStanzaInput}
          onChange={(e) => setNomeStanzaInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') creaStanza() }}
          className="join-input"
          maxLength={40}
        />
        <button className="btn-primary" onClick={creaStanza}>
          Crea una nuova stanza
        </button>

        <div className="divider"><span>oppure</span></div>

        <form onSubmit={entraStanza} className="join-form">
          <input
            type="text"
            placeholder="CODICE-STANZA"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="join-input"
          />
          <button type="submit" className="btn-secondary">Entra</button>
        </form>
      </div>
    </div>
  )
}

// --- Ingresso nickname ---
function NicknameGate({ roomCode, onJoin }) {
  const [nickname, setNickname] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = nickname.trim()
    if (!trimmed) return
    sessionStorage.setItem(`nickname:${roomCode}`, trimmed)
    onJoin(trimmed)
  }

  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="hero-die">
          <DiceFace2D size={72} />
        </div>
        <h1>Unisciti al tavolo</h1>
        <p className="hero-sub">
          Stanza <span className="room-code-inline">{roomCode}</span>
        </p>
      </div>
      <form onSubmit={handleSubmit} className="join-form join-form-vertical">
        <input
          type="text"
          placeholder="Il tuo nome"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="join-input"
          autoFocus
          maxLength={24}
        />
        <button type="submit" className="btn-primary">Entra al tavolo</button>
      </form>
    </div>
  )
}

// --- Stanza principale ---
function Room({ roomCode }) {
  const [nickname, setNickname] = useState(() => sessionStorage.getItem(`nickname:${roomCode}`))
  const isGM = useMemo(() => sessionStorage.getItem(`gm:${roomCode}`) === '1', [roomCode])
  const [espressione, setEspressione] = useState('')
  const [errore, setErrore] = useState(null)
  const [tiri, setTiri] = useState([])
  const [rolling, setRolling] = useState(false)
  const [ultimoBreakdown, setUltimoBreakdown] = useState(null)
  const [copiato, setCopiato] = useState(false)
  const [impostazioni, setImpostazioni] = useState(null)
  const [pannelloAperto, setPannelloAperto] = useState(false)
  const [linkMedia, setLinkMedia] = useState('')
  const [linkImmagine, setLinkImmagine] = useState('')
  const [erroreGM, setErroreGM] = useState(null)
  const [caricamentoFile, setCaricamentoFile] = useState(null)
  const [orologi, setOrologi] = useState([])
  const [nuovoNomeOrologio, setNuovoNomeOrologio] = useState('')
  const [nuovaTagliaOrologio, setNuovaTagliaOrologio] = useState('')
  const [videoAperto, setVideoAperto] = useState(false)
  const [griglia, setGriglia] = useState(null)
  const [pedine, setPedine] = useState([])
  const [righeInput, setRigheInput] = useState('')
  const [colonneInput, setColonneInput] = useState('')
  const [nuovaEtichettaPedina, setNuovaEtichettaPedina] = useState('')
  const [nuovoTipoPedina, setNuovoTipoPedina] = useState('giocatore')
  const [modalitaGriglia, setModalitaGriglia] = useState('pedine') // 'pedine' | 'disegno'
  const [coloreDisegno, setColoreDisegno] = useState('#C9A227')
  const [stati, setStati] = useState([])
  const [statoTarget, setStatoTarget] = useState('')
  const [statoTesto, setStatoTesto] = useState('')
  const [easterEgg, setEasterEgg] = useState(false)
  const [tiroNascosto, setTiroNascosto] = useState(false)
  const [tiriNascosti, setTiriNascosti] = useState([])
  const [chatAperta, setChatAperta] = useState(false)
  const [messaggi, setMessaggi] = useState([])
  const [testoMessaggio, setTestoMessaggio] = useState('')
  const [caricamentoImmagineChat, setCaricamentoImmagineChat] = useState(false)
  const [destinatario, setDestinatario] = useState('') // '' = chat pubblica, altrimenti nickname
  const chatEndRef = useRef(null)
  const listEndRef = useRef(null)
  const listContainerRef = useRef(null)

  useEffect(() => {
    if (!nickname) return

    let mounted = true

    async function caricaStorico() {
      const { data } = await supabase
        .from('rolls')
        .select('*')
        .eq('room_code', roomCode)
        .order('created_at', { ascending: true })
        .limit(50)
      if (mounted && data) setTiri(data)
    }
    caricaStorico()

    async function caricaImpostazioni() {
      const { data } = await supabase
        .from('room_settings')
        .select('*')
        .eq('room_code', roomCode)
        .maybeSingle()
      if (mounted && data) setImpostazioni(data)
    }
    caricaImpostazioni()

    async function caricaOrologi() {
      const { data } = await supabase
        .from('room_clocks')
        .select('*')
        .eq('room_code', roomCode)
        .order('ordine', { ascending: true })
      if (mounted && data) setOrologi(data)
    }
    caricaOrologi()

    async function caricaMessaggi() {
      const { data } = await supabase
        .from('room_messages')
        .select('*')
        .eq('room_code', roomCode)
        .or(`recipient.is.null,recipient.eq.${nickname},sender.eq.${nickname}`)
        .order('created_at', { ascending: true })
        .limit(200)
      if (mounted && data) setMessaggi(data)
    }
    caricaMessaggi()

    async function caricaGriglia() {
      const { data } = await supabase
        .from('room_grid')
        .select('*')
        .eq('room_code', roomCode)
        .maybeSingle()
      if (mounted && data) setGriglia(data)
    }
    caricaGriglia()

    async function caricaPedine() {
      const { data } = await supabase
        .from('room_tokens')
        .select('*')
        .eq('room_code', roomCode)
        .order('created_at', { ascending: true })
      if (mounted && data) setPedine(data)
    }
    caricaPedine()

    async function caricaStati() {
      const { data } = await supabase
        .from('room_statuses')
        .select('*')
        .eq('room_code', roomCode)
      if (mounted && data) setStati(data)
    }
    caricaStati()

    const channel = supabase
      .channel(`room:${roomCode}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rolls', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          setTiri((prev) => [...prev, payload.new])
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_settings', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          if (payload.new) setImpostazioni(payload.new)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_clocks', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          setOrologi((prev) => [...prev, payload.new].sort((a, b) => a.ordine - b.ordine))
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'room_clocks', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          setOrologi((prev) => prev.map((o) => (o.id === payload.new.id ? payload.new : o)))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'room_clocks', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          setOrologi((prev) => prev.filter((o) => o.id !== payload.old.id))
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          const m = payload.new
          // Filtro lato client: mostra solo i messaggi pubblici o quelli che mi riguardano
          const miRiguarda = !m.recipient || m.recipient === nickname || m.sender === nickname
          if (miRiguarda) setMessaggi((prev) => [...prev, m])
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'room_grid', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          if (payload.new) setGriglia(payload.new)
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_tokens', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          setPedine((prev) => [...prev, payload.new])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'room_tokens', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          setPedine((prev) => prev.map((p) => (p.id === payload.new.id ? payload.new : p)))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'room_tokens', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          setPedine((prev) => prev.filter((p) => p.id !== payload.old.id))
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'room_statuses', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          setStati((prev) => [...prev, payload.new])
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'room_statuses', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          setStati((prev) => prev.filter((s) => s.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [nickname, roomCode])

  useEffect(() => {
    // Scorre solo l'elenco interno della cronologia, senza spostare la pagina
    // (prima "strappava" la visuale da qualunque punto ci si trovasse, es. il video)
    if (listContainerRef.current) {
      listContainerRef.current.scrollTop = listContainerRef.current.scrollHeight
    }
  }, [tiri])

  useEffect(() => {
    if (chatAperta) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messaggi, chatAperta])

  async function inviaMessaggio() {
    const testo = testoMessaggio.trim()
    if (!testo) return
    setTestoMessaggio('')
    await supabase.from('room_messages').insert({
      room_code: roomCode,
      sender: nickname,
      recipient: destinatario || null,
      content: testo,
    })
  }

  async function inviaImmagineChat(file) {
    if (!file) return
    const limiteMB = 8
    if (file.size > limiteMB * 1024 * 1024) {
      setErroreGM(null)
      alert(`Immagine troppo grande (max ${limiteMB} MB)`)
      return
    }

    setCaricamentoImmagineChat(true)
    const percorso = `${roomCode}/chat/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`

    const { error: erroreUpload } = await supabase.storage
      .from('room-media')
      .upload(percorso, file, { upsert: true })

    if (erroreUpload) {
      setCaricamentoImmagineChat(false)
      alert(`Errore nel caricamento dell'immagine: ${erroreUpload.message}`)
      return
    }

    const { data } = supabase.storage.from('room-media').getPublicUrl(percorso)

    await supabase.from('room_messages').insert({
      room_code: roomCode,
      sender: nickname,
      recipient: destinatario || null,
      content: testoMessaggio.trim() || null,
      image_url: data.publicUrl,
    })
    setTestoMessaggio('')
    setCaricamentoImmagineChat(false)
  }

  // Nickname visti finora nella stanza (dai tiri e dai messaggi), per scegliere il destinatario del DM
  const giocatoriVisti = useMemo(() => {
    const nomi = new Set()
    tiri.forEach((t) => { if (t.nickname !== nickname) nomi.add(t.nickname) })
    messaggi.forEach((m) => {
      if (m.sender !== nickname) nomi.add(m.sender)
      if (m.recipient && m.recipient !== nickname) nomi.add(m.recipient)
    })
    return Array.from(nomi)
  }, [tiri, messaggi, nickname])

  // Include anche te stesso, utile per piazzare la propria pedina sulla griglia
  const tuttiIGiocatori = useMemo(() => [nickname, ...giocatoriVisti], [nickname, giocatoriVisti])

  // Elenco combinato di chi può ricevere uno stato: giocatori (per nickname) + pedine nemico/altro (per id)
  const bersagliStato = useMemo(() => {
    const daGiocatori = tuttiIGiocatori.map((nome) => ({
      valore: `player::${nome}`,
      etichetta: `👤 ${nome}`,
    }))
    const daPedine = pedine
      .filter((p) => p.tipo !== 'giocatore')
      .map((p) => ({
        valore: `token::${p.id}`,
        etichetta: `${ICONE_TIPO_PEDINA[p.tipo] || '❓'} ${p.etichetta}`,
      }))
    return [...daGiocatori, ...daPedine]
  }, [tuttiIGiocatori, pedine])

  function aggiungiDado(sides) {
    setEspressione((prev) => {
      const base = prev.trim()
      if (!base) return `1d${sides}`
      return /[+-]$/.test(base) ? `${base}1d${sides}` : `${base}+1d${sides}`
    })
  }

  async function lancia() {
    if (rolling) return
    setErrore(null)

    const nascosto = isGM && tiroNascosto

    // 🐖 easter egg nascosto: nessun pulsante, bisogna sapere la parola magica
    if (espressione.trim().toLowerCase() === 'porco') {
      setRolling(true)
      setEspressione('')
      setTimeout(async () => {
        setRolling(false)
        setEasterEgg(true)
        if (nascosto) {
          setTiriNascosti((prev) => [
            { id: Date.now(), notation: '🐖', breakdown: [], total: 0, created_at: new Date().toISOString() },
            ...prev,
          ].slice(0, 30))
        } else {
          await supabase.from('rolls').insert({
            room_code: roomCode,
            nickname,
            results: [],
            total: 0,
            notation: '🐖',
            breakdown: [],
            modifier: 0,
          })
        }
        setTimeout(() => setEasterEgg(false), 2500)
      }, 500)
      return
    }

    let esito
    try {
      esito = lanciaEspressione(espressione)
    } catch (err) {
      setErrore(err.message)
      return
    }

    setRolling(true)
    setUltimoBreakdown(esito.breakdown)
    setEspressione('')

    setTimeout(async () => {
      setRolling(false)
      const notazione = formattaNotazione(esito.breakdown, esito.modificatoreFisso)

      if (nascosto) {
        setTiriNascosti((prev) => [
          { id: Date.now(), notation: notazione, breakdown: esito.breakdown, total: esito.totale, created_at: new Date().toISOString() },
          ...prev,
        ].slice(0, 30))
        return
      }

      await supabase.from('rolls').insert({
        room_code: roomCode,
        nickname,
        results: esito.breakdown.flatMap((g) => g.values),
        total: esito.totale,
        notation: notazione,
        breakdown: esito.breakdown,
        modifier: esito.modificatoreFisso,
      })
    }, 550)
  }

  function copiaLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopiato(true)
    setTimeout(() => setCopiato(false), 1800)
  }

  async function salvaImpostazioni(campi) {
    const { data, error } = await supabase
      .from('room_settings')
      .upsert({ room_code: roomCode, ...campi }, { onConflict: 'room_code' })
      .select()
      .single()

    if (error) {
      setErroreGM(`Errore nel salvataggio: ${error.message}`)
      return false
    }
    setImpostazioni(data)
    return true
  }

  async function applicaColore(colore) {
    setErroreGM(null)
    await salvaImpostazioni({ background_color: colore, background_image: null })
  }

  async function applicaImmagine() {
    const url = linkImmagine.trim()
    if (!url) return
    setErroreGM(null)
    const ok = await salvaImpostazioni({ background_image: url })
    if (ok) setLinkImmagine('')
  }

  async function rimuoviImmagine() {
    setErroreGM(null)
    await salvaImpostazioni({ background_image: null })
  }

  async function applicaMedia() {
    setErroreGM(null)
    const riconosciuto = classificaMedia(linkMedia)
    if (!riconosciuto) {
      setErroreGM('Link non riconosciuto: usa un .mp3, un link YouTube o un link Spotify')
      return
    }
    const ok = await salvaImpostazioni({ media_url: linkMedia.trim(), media_type: riconosciuto.tipo })
    if (ok) setLinkMedia('')
  }

  async function fermaMedia() {
    setErroreGM(null)
    await salvaImpostazioni({ media_url: null, media_type: null })
  }

  // --- Caricamento file dal dispositivo (immagine di sfondo o mp3) ---
  async function caricaFile(file, tipo) {
    setErroreGM(null)

    const limiteMB = tipo === 'immagine' ? 8 : 15
    if (file.size > limiteMB * 1024 * 1024) {
      setErroreGM(`File troppo grande (max ${limiteMB} MB)`)
      return
    }

    setCaricamentoFile(tipo)
    const percorso = `${roomCode}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`

    const { error: erroreUpload } = await supabase.storage
      .from('room-media')
      .upload(percorso, file, { upsert: true })

    if (erroreUpload) {
      setCaricamentoFile(null)
      setErroreGM(`Errore nel caricamento: ${erroreUpload.message}`)
      return
    }

    const { data } = supabase.storage.from('room-media').getPublicUrl(percorso)
    const urlPubblico = data.publicUrl

    if (tipo === 'immagine') {
      await salvaImpostazioni({ background_image: urlPubblico })
    } else {
      await salvaImpostazioni({ media_url: urlPubblico, media_type: 'mp3' })
    }
    setCaricamentoFile(null)
  }

  // --- Gestione orologi/countdown (solo GM) ---
  async function creaOrologio() {
    const nome = nuovoNomeOrologio.trim()
    const taglia = Math.max(2, parseInt(nuovaTagliaOrologio, 10) || 6)
    if (!nome) return
    await supabase.from('room_clocks').insert({
      room_code: roomCode,
      nome,
      segmenti_totali: taglia,
      segmenti_completati: 0,
    })
    setNuovoNomeOrologio('')
    setNuovaTagliaOrologio('')
  }

  async function aggiornaOrologio(id, completati) {
    await supabase.from('room_clocks').update({ segmenti_completati: completati }).eq('id', id)
  }

  async function eliminaOrologio(id) {
    setOrologi((prev) => prev.filter((o) => o.id !== id))
    const { error } = await supabase.from('room_clocks').delete().eq('id', id)
    if (error) setErroreGM(`Errore nell'eliminazione: ${error.message}`)
  }

  // --- Gestione griglia di battaglia (solo GM) ---
  async function creaGriglia() {
    const righe = Math.min(30, Math.max(2, parseInt(righeInput, 10) || 8))
    const colonne = Math.min(30, Math.max(2, parseInt(colonneInput, 10) || 8))
    const { data, error } = await supabase
      .from('room_grid')
      .upsert({ room_code: roomCode, righe, colonne }, { onConflict: 'room_code' })
      .select()
      .single()
    if (error) {
      setErroreGM(`Errore nella creazione della griglia: ${error.message}`)
      return
    }
    setGriglia(data)
  }

  async function eliminaGriglia() {
    await supabase.from('room_grid').delete().eq('room_code', roomCode)
    await supabase.from('room_tokens').delete().eq('room_code', roomCode)
    setGriglia(null)
    setPedine([])
  }

  async function aggiungiPedina() {
    const etichetta = nuovoTipoPedina === 'giocatore'
      ? nuovaEtichettaPedina.trim()
      : nuovaEtichettaPedina.trim().slice(0, 4)
    if (!etichetta || !griglia) return
    const posizione = pedine.length
    const riga = posizione % griglia.righe
    const colonna = Math.floor(posizione / griglia.righe) % griglia.colonne
    const { error } = await supabase.from('room_tokens').insert({
      room_code: roomCode,
      etichetta,
      tipo: nuovoTipoPedina,
      riga,
      colonna,
    })
    if (error) setErroreGM(`Errore nell'aggiunta della pedina: ${error.message}`)
    setNuovaEtichettaPedina('')
  }

  async function eliminaPedina(id) {
    setPedine((prev) => prev.filter((p) => p.id !== id))
    await supabase.from('room_tokens').delete().eq('id', id)
  }

  async function spostaPedina(id, riga, colonna) {
    setPedine((prev) => prev.map((p) => (p.id === id ? { ...p, riga, colonna } : p)))
    await supabase.from('room_tokens').update({ riga, colonna }).eq('id', id)
  }

  async function salvaDisegno(nuovoDisegno) {
    setGriglia((prev) => (prev ? { ...prev, disegno: nuovoDisegno } : prev))
    await supabase.from('room_grid').update({ disegno: nuovoDisegno }).eq('room_code', roomCode)
  }

  async function cancellaDisegno() {
    await salvaDisegno([])
  }

  // --- Gestione stati/condizioni (solo GM) ---
  async function assegnaStato() {
    const testo = statoTesto.trim().slice(0, 30)
    if (!testo || !statoTarget) return
    const [targetType, targetKey] = statoTarget.split('::')
    const { error } = await supabase.from('room_statuses').insert({
      room_code: roomCode,
      target_type: targetType,
      target_key: targetKey,
      etichetta: testo,
    })
    if (error) setErroreGM(`Errore nell'assegnare lo stato: ${error.message}`)
    setStatoTesto('')
  }

  async function rimuoviStato(id) {
    setStati((prev) => prev.filter((s) => s.id !== id))
    await supabase.from('room_statuses').delete().eq('id', id)
  }

  function statiDi(targetType, targetKey) {
    return stati.filter((s) => s.target_type === targetType && s.target_key === targetKey)
  }

  if (!nickname) {
    return <NicknameGate roomCode={roomCode} onJoin={setNickname} />
  }

  const sfondoStile = impostazioni?.background_image
    ? { backgroundImage: `linear-gradient(rgba(15,29,21,0.55), rgba(15,29,21,0.75)), url(${impostazioni.background_image})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }
    : impostazioni?.background_color
    ? { background: `radial-gradient(ellipse at top, ${impostazioni.background_color} 0%, ${scurisciHex(impostazioni.background_color)} 70%)` }
    : undefined

  const colorePannelli = impostazioni?.background_color ? hexToRgba(impostazioni.background_color, 0.35) : null

  return (
    <div className="room-scene" style={sfondoStile}>
      <div className="room">
        <header className="room-header">
          <div>
            <h2>Tavolo <span className="room-code-inline">{roomCode}</span></h2>
            <p className="room-sub">
              Giochi come <strong>{nickname}</strong>
              {isGM && <span className="gm-badge">Game Master</span>}
            </p>
          </div>
          <div className="room-header-actions">
            <button className="btn-ghost" onClick={() => setChatAperta((v) => !v)}>
              {chatAperta ? 'Chiudi chat' : '💬 Chat'}
            </button>
            <button className="btn-ghost" onClick={() => setVideoAperto((v) => !v)}>
              {videoAperto ? 'Chiudi video' : '🎥 Video/Audio'}
            </button>
            {isGM && (
              <button className="btn-ghost" onClick={() => setPannelloAperto((v) => !v)}>
                {pannelloAperto ? 'Chiudi pannello' : '🎛️ Pannello GM'}
              </button>
            )}
            <button className="btn-ghost" onClick={copiaLink}>
              {copiato ? 'Link copiato ✓' : 'Invita giocatori'}
            </button>
          </div>
        </header>

        {chatAperta && (
          <div className="chat-panel">
            <div className="chat-header">
              <label className="chat-dest-label">
                A:
                <select
                  className="gm-select chat-dest-select"
                  value={destinatario}
                  onChange={(e) => setDestinatario(e.target.value)}
                >
                  <option value="">💬 Tutta la stanza</option>
                  {giocatoriVisti.map((nome) => (
                    <option key={nome} value={nome}>🔒 {nome} (privato)</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="chat-messages">
              {messaggi.length === 0 && <p className="storico-empty">Nessun messaggio ancora.</p>}
              {messaggi.map((m) => {
                const isDM = !!m.recipient
                const mioMessaggio = m.sender === nickname
                return (
                  <div key={m.id ?? m.created_at} className={`chat-bubble ${mioMessaggio ? 'chat-bubble-mio' : ''} ${isDM ? 'chat-bubble-dm' : ''}`}>
                    <span className="chat-bubble-meta">
                      {isDM && '🔒 '}
                      <strong style={{ color: colorePerNickname(m.sender) }}>{m.sender}</strong>
                      {statiDi('player', m.sender).map((s) => (
                        <span key={s.id} className="status-badge" title={s.etichetta}>{s.etichetta}</span>
                      ))}
                      {isDM && (mioMessaggio ? ` → ${m.recipient}` : ' → te')}
                    </span>
                    {m.image_url && (
                      <a href={m.image_url} target="_blank" rel="noopener noreferrer">
                        <img src={m.image_url} alt="Immagine condivisa in chat" className="chat-bubble-immagine" />
                      </a>
                    )}
                    {m.content && <span className="chat-bubble-testo">{m.content}</span>}
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>

            <div className="chat-input-row">
              <input
                type="text"
                className="expression-input chat-input"
                placeholder={destinatario ? `Messaggio privato a ${destinatario}…` : 'Scrivi alla stanza…'}
                value={testoMessaggio}
                onChange={(e) => setTestoMessaggio(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') inviaMessaggio() }}
                maxLength={500}
              />
              <label className="chat-image-btn" title="Invia immagine">
                {caricamentoImmagineChat ? '…' : '📷'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={caricamentoImmagineChat}
                  onChange={(e) => { if (e.target.files[0]) inviaImmagineChat(e.target.files[0]); e.target.value = '' }}
                />
              </label>
              <button className="btn-secondary" onClick={inviaMessaggio}>Invia</button>
            </div>
          </div>
        )}

        {videoAperto && <VideoChiamata roomCode={roomCode} nickname={nickname} isGM={isGM} />}

        {impostazioni?.media_url && (
          <MediaPlayer tipo={impostazioni.media_type} url={impostazioni.media_url} />
        )}

        {isGM && pannelloAperto && (
          <div className="gm-panel">
            <h3>Pannello Game Master</h3>

            <div className="gm-section">
              <label>Colore sfondo</label>
              <div className="gm-swatches">
                {PALETTE_SFONDI.map((p) => (
                  <button
                    key={p.colore}
                    type="button"
                    className="gm-swatch"
                    style={{ background: p.colore }}
                    title={p.nome}
                    onClick={() => applicaColore(p.colore)}
                  />
                ))}
              </div>
            </div>

            <div className="gm-section">
              <label>Immagine di sfondo</label>
              <div className="gm-inline-form">
                <input
                  type="text"
                  className="expression-input"
                  placeholder="https://... (o carica un file)"
                  value={linkImmagine}
                  onChange={(e) => setLinkImmagine(e.target.value)}
                />
                <button className="btn-secondary" onClick={applicaImmagine}>Applica link</button>
              </div>
              <label className="gm-file-btn">
                {caricamentoFile === 'immagine' ? 'Caricamento…' : '📁 Carica immagine dal dispositivo'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={caricamentoFile !== null}
                  onChange={(e) => { if (e.target.files[0]) caricaFile(e.target.files[0], 'immagine'); e.target.value = '' }}
                />
              </label>
              {impostazioni?.background_image && (
                <button className="btn-ghost gm-remove-btn" onClick={rimuoviImmagine}>Rimuovi immagine</button>
              )}
            </div>

            <div className="gm-section">
              <label>Musica per la stanza</label>
              <div className="gm-inline-form">
                <input
                  type="text"
                  className="expression-input"
                  placeholder="Link YouTube, Spotify o .mp3"
                  value={linkMedia}
                  onChange={(e) => { setLinkMedia(e.target.value); setErroreGM(null) }}
                />
                <button className="btn-secondary" onClick={applicaMedia}>Applica link</button>
              </div>
              <label className="gm-file-btn">
                {caricamentoFile === 'mp3' ? 'Caricamento…' : '📁 Carica mp3 dal dispositivo'}
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,.mp3"
                  hidden
                  disabled={caricamentoFile !== null}
                  onChange={(e) => { if (e.target.files[0]) caricaFile(e.target.files[0], 'mp3'); e.target.value = '' }}
                />
              </label>
              {erroreGM && <p className="expression-error">{erroreGM}</p>}
              {impostazioni?.media_url && (
                <button className="btn-ghost gm-remove-btn" onClick={fermaMedia}>Ferma musica</button>
              )}
              <p className="gm-hint">
                Ogni giocatore riproduce il brano dal proprio dispositivo: non è sincronizzato al secondo tra tutti, ma serve bene come sottofondo d'atmosfera.
              </p>
            </div>

            <div className="gm-section">
              <label>Orologi / countdown</label>
              <div className="gm-inline-form">
                <input
                  type="text"
                  className="expression-input"
                  placeholder="Nome (es. Allarme, Ritirata, Rituale)"
                  value={nuovoNomeOrologio}
                  onChange={(e) => setNuovoNomeOrologio(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') creaOrologio() }}
                />
                <input
                  type="number"
                  className="gm-select gm-taglia-input"
                  min="2"
                  placeholder="6"
                  value={nuovaTagliaOrologio}
                  onChange={(e) => setNuovaTagliaOrologio(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') creaOrologio() }}
                  title="Numero di spicchi"
                />
                <button className="btn-secondary" onClick={creaOrologio}>Crea</button>
              </div>

              {orologi.length > 0 && (
                <div className="gm-clocks-list">
                  {orologi.map((o) => (
                    <div key={o.id} className="gm-clock-row">
                      <OrologioSVG totale={o.segmenti_totali} completati={o.segmenti_completati} size={52} />
                      <div className="gm-clock-info">
                        <span className="gm-clock-nome">
                          {o.nome}
                          {o.segmenti_completati >= o.segmenti_totali && <span className="gm-clock-completo">✓ Completo</span>}
                        </span>
                        <div className="gm-clock-steppers">
                          <button
                            type="button"
                            className="stepper-btn"
                            onClick={() => aggiornaOrologio(o.id, Math.max(0, o.segmenti_completati - 1))}
                          >
                            −
                          </button>
                          <span className="gm-clock-frazione">{o.segmenti_completati}/{o.segmenti_totali}</span>
                          <button
                            type="button"
                            className="stepper-btn"
                            onClick={() => aggiornaOrologio(o.id, Math.min(o.segmenti_totali, o.segmenti_completati + 1))}
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <button className="btn-ghost gm-clock-delete" onClick={() => eliminaOrologio(o.id)} title="Elimina orologio">
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="gm-section">
              <label>Griglia di battaglia</label>
              <div className="gm-inline-form">
                <input
                  type="number"
                  className="gm-select gm-taglia-input"
                  min="2"
                  max="30"
                  placeholder="righe"
                  value={righeInput}
                  onChange={(e) => setRigheInput(e.target.value)}
                />
                <input
                  type="number"
                  className="gm-select gm-taglia-input"
                  min="2"
                  max="30"
                  placeholder="colonne"
                  value={colonneInput}
                  onChange={(e) => setColonneInput(e.target.value)}
                />
                <button className="btn-secondary" onClick={creaGriglia}>
                  {griglia ? 'Ridimensiona' : 'Crea griglia'}
                </button>
              </div>

              {griglia && (
                <>
                  <div className="gm-inline-form" style={{ marginTop: 10 }}>
                    <select
                      className="gm-select"
                      value={nuovoTipoPedina}
                      onChange={(e) => {
                        setNuovoTipoPedina(e.target.value)
                        setNuovaEtichettaPedina('')
                      }}
                    >
                      <option value="giocatore">👤 Giocatore</option>
                      <option value="nemico">👹 Nemico</option>
                      <option value="altro">❓ Altro</option>
                    </select>

                    {nuovoTipoPedina === 'giocatore' ? (
                      <select
                        className="gm-select"
                        value={nuovaEtichettaPedina}
                        onChange={(e) => setNuovaEtichettaPedina(e.target.value)}
                      >
                        <option value="">Scegli il giocatore…</option>
                        {tuttiIGiocatori.map((nome) => (
                          <option key={nome} value={nome}>{nome}{nome === nickname ? ' (tu)' : ''}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="expression-input"
                        placeholder="Etichetta (es. Orco, G1)"
                        value={nuovaEtichettaPedina}
                        onChange={(e) => setNuovaEtichettaPedina(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') aggiungiPedina() }}
                        maxLength={4}
                      />
                    )}
                    <button className="btn-secondary" onClick={aggiungiPedina}>Aggiungi</button>
                  </div>

                  <div className="gm-inline-form" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className={`btn-secondary ${modalitaGriglia === 'pedine' ? 'gm-mode-attiva' : ''}`}
                      onClick={() => setModalitaGriglia('pedine')}
                    >
                      🎯 Sposta pedine
                    </button>
                    <button
                      type="button"
                      className={`btn-secondary ${modalitaGriglia === 'disegno' ? 'gm-mode-attiva' : ''}`}
                      onClick={() => setModalitaGriglia('disegno')}
                    >
                      ✏️ Disegna
                    </button>
                  </div>

                  {modalitaGriglia === 'disegno' && (
                    <div className="gm-inline-form" style={{ marginTop: 8 }}>
                      {['#C9A227', '#8B3A3A', '#E8DCC4', '#2E8B57'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          className="gm-swatch"
                          style={{ background: c, border: coloreDisegno === c ? '2px solid white' : '2px solid rgba(232,220,196,0.3)' }}
                          onClick={() => setColoreDisegno(c)}
                        />
                      ))}
                      <button className="btn-ghost gm-remove-btn" onClick={cancellaDisegno}>Cancella disegno</button>
                    </div>
                  )}

                  <p className="gm-hint">
                    {modalitaGriglia === 'pedine'
                      ? 'Trascina le pedine direttamente sulla griglia per spostarle. Tocca la ✕ su una pedina per eliminarla.'
                      : 'Disegna liberamente sulla griglia (muri, percorsi, aree) — visibile a tutti, sotto le pedine.'}
                  </p>
                  <button className="btn-ghost gm-remove-btn" onClick={eliminaGriglia}>Rimuovi griglia</button>
                </>
              )}
            </div>

            <div className="gm-section">
              <label>Stati / condizioni</label>
              <div className="gm-inline-form">
                <select
                  className="gm-select"
                  value={statoTarget}
                  onChange={(e) => setStatoTarget(e.target.value)}
                >
                  <option value="">Assegna a…</option>
                  {bersagliStato.map((b) => (
                    <option key={b.valore} value={b.valore}>{b.etichetta}</option>
                  ))}
                </select>
                <input
                  type="text"
                  className="expression-input"
                  placeholder="es. Avvelenato"
                  value={statoTesto}
                  onChange={(e) => setStatoTesto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') assegnaStato() }}
                  maxLength={30}
                />
                <button className="btn-secondary" onClick={assegnaStato}>Assegna</button>
              </div>

              {stati.length > 0 && (
                <div className="gm-clocks-list">
                  {stati.map((s) => (
                    <div key={s.id} className="gm-stato-row">
                      <span className="gm-stato-badge">{s.etichetta}</span>
                      <span className="gm-stato-bersaglio">
                        {s.target_type === 'player'
                          ? `👤 ${s.target_key}`
                          : bersagliStato.find((b) => b.valore === `token::${s.target_key}`)?.etichetta || s.target_key}
                      </span>
                      <button className="gm-stato-elimina" onClick={() => rimuoviStato(s.id)} title="Rimuovi stato">✕</button>
                    </div>
                  ))}
                </div>
              )}
              <p className="gm-hint">Gli stati compaiono accanto al nome nella cronologia lanci, nei messaggi in chat e come badge sulle pedine.</p>
            </div>
          </div>
        )}

        {griglia && (
          <GrigliaBattaglia
            griglia={griglia}
            pedine={pedine}
            isGM={isGM}
            onSposta={spostaPedina}
            onElimina={eliminaPedina}
            colorePannelli={colorePannelli}
            modalitaDisegno={isGM && modalitaGriglia === 'disegno'}
            coloreDisegno={coloreDisegno}
            onDisegnaFine={salvaDisegno}
            stati={stati}
          />
        )}

        {orologi.length > 0 && (
          <div className="clocks-display" style={colorePannelli ? { backgroundColor: colorePannelli } : undefined}>
            {orologi.map((o) => (
              <div key={o.id} className="clock-display-item">
                <OrologioSVG totale={o.segmenti_totali} completati={o.segmenti_completati} size={84} />
                <span className="clock-display-nome">
                  {o.nome}
                  {o.segmenti_completati >= o.segmenti_totali && <span className="gm-clock-completo">✓</span>}
                </span>
                <span className="clock-display-frazione">{o.segmenti_completati}/{o.segmenti_totali}</span>
              </div>
            ))}
          </div>
        )}

        <div className="dice-panel" style={colorePannelli ? { backgroundColor: colorePannelli } : undefined}>
        {easterEgg ? (
          <div className="easter-egg-pig">🐖</div>
        ) : (
          <Dice3DTray breakdown={ultimoBreakdown} rolling={rolling} color={colorePerNickname(nickname)} />
        )}

        <div className="dice-type-selector">
          {TIPI_DADO.map((tipo) => (
            <button
              key={tipo}
              type="button"
              className="dice-type-btn"
              onClick={() => aggiungiDado(tipo)}
              title={`Aggiungi 1d${tipo} all'espressione`}
            >
              +d{tipo}
            </button>
          ))}
        </div>

        <div className="dice-controls">
          <label htmlFor="espressione">Espressione (es. 2d6+1d20+2d4+3)</label>
          <input
            id="espressione"
            type="text"
            className="expression-input"
            value={espressione}
            onChange={(e) => { setEspressione(e.target.value); setErrore(null) }}
            onKeyDown={(e) => { if (e.key === 'Enter') lancia() }}
            placeholder="2d6+1d20+2d4+3"
          />
          {errore && <p className="expression-error">{errore}</p>}

          {isGM && (
            <label className="tiro-nascosto-toggle">
              <input
                type="checkbox"
                checked={tiroNascosto}
                onChange={(e) => setTiroNascosto(e.target.checked)}
              />
              🙈 Tiro nascosto (solo tu lo vedi)
            </label>
          )}

          <button
            className={`btn-primary btn-roll ${tiroNascosto ? 'btn-roll-nascosto' : ''}`}
            onClick={lancia}
            disabled={rolling || !espressione.trim()}
          >
            {rolling ? 'Lancio…' : espressione.trim() ? `Lancia ${espressione}${tiroNascosto ? ' 🙈' : ''}` : 'Lancia'}
          </button>
        </div>
      </div>

      {isGM && tiriNascosti.length > 0 && (
        <div className="storico storico-nascosto">
          <h3>🙈 Tiri nascosti (visibili solo a te)</h3>
          <ul className="storico-list">
            {tiriNascosti.map((t) => (
              <li key={t.id} className="storico-item storico-item-nascosto">
                <span className="storico-nome">{t.notation}</span>
                <span className="storico-dadi">{formattaDettaglioTiro(t)}</span>
                <span className="storico-totale">{t.total}</span>
              </li>
            ))}
          </ul>
          <p className="gm-hint">Questi tiri non sono mai stati inviati agli altri giocatori e si perdono se ricarichi la pagina.</p>
        </div>
      )}

      <div className="storico">
        <h3>Cronologia tiri</h3>
        {tiri.length === 0 && <p className="storico-empty">Nessun tiro ancora. Rompete il ghiaccio!</p>}
        <ul className="storico-list" ref={listContainerRef}>
          {tiri.map((t) => (
            <li
              key={t.id ?? `${t.created_at}-${t.nickname}`}
              className="storico-item"
              style={{
                borderLeftColor: colorePerNickname(t.nickname),
                ...(colorePannelli ? { backgroundColor: colorePannelli } : {}),
              }}
            >
              <span className="storico-nome" style={{ color: colorePerNickname(t.nickname) }}>
                {t.nickname}
                {statiDi('player', t.nickname).map((s) => (
                  <span key={s.id} className="status-badge" title={s.etichetta}>{s.etichetta}</span>
                ))}
              </span>
              <span className="storico-dadi">
                {t.notation || `${t.dice_count}d${t.dice_sides}`}: {formattaDettaglioTiro(t)}
              </span>
              <span className="storico-totale">{t.total}</span>
            </li>
          ))}
          <li ref={listEndRef} />
        </ul>
      </div>
      </div>
    </div>
  )
}

// --- Player musicale condiviso, visibile a tutti i giocatori della stanza ---
// Il volume è locale al browser di ciascuno: non viene mai sincronizzato con gli altri.
function useVolumeLocale() {
  const [volume, setVolume] = useState(() => {
    const salvato = localStorage.getItem('tavolo-volume')
    return salvato !== null ? Number(salvato) : 70
  })

  function aggiorna(v) {
    setVolume(v)
    localStorage.setItem('tavolo-volume', String(v))
  }

  return [volume, aggiorna]
}

function ControlloVolume({ volume, onChange }) {
  return (
    <div className="volume-control">
      <span className="volume-icon">{volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}</span>
      <input
        type="range"
        min="0"
        max="100"
        value={volume}
        onChange={(e) => onChange(Number(e.target.value))}
        className="volume-slider"
        aria-label="Volume (solo per te)"
      />
      <span className="volume-value">{volume}</span>
    </div>
  )
}

function MediaPlayer({ tipo, url }) {
  const [volume, setVolume] = useVolumeLocale()
  const audioRef = useRef(null)
  const iframeRef = useRef(null)
  const [autoplayBloccato, setAutoplayBloccato] = useState(false)

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100
  }, [volume, tipo])

  useEffect(() => {
    if (tipo !== 'youtube' || !iframeRef.current) return
    iframeRef.current.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: 'setVolume', args: [volume] }),
      '*'
    )
  }, [volume, tipo])

  // Per l'mp3 il tag <audio autoPlay> non basta sempre in tutti i browser: tentiamo
  // anche un avvio esplicito via JS, e se viene comunque bloccato lo segnaliamo.
  useEffect(() => {
    if (tipo !== 'mp3' || !audioRef.current) return
    const tentativo = audioRef.current.play()
    if (tentativo?.catch) {
      tentativo.catch(() => setAutoplayBloccato(true))
    }
  }, [tipo, url])

  function avviaManualmente() {
    audioRef.current?.play()
    setAutoplayBloccato(false)
  }

  if (tipo === 'youtube') {
    const matchVideo = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/)
    const matchLista = url.match(/[?&]list=([a-zA-Z0-9_-]+)/)
    const videoId = matchVideo ? matchVideo[1] : null
    const listaId = matchLista ? matchLista[1] : null

    if (!videoId && !listaId) return null

    let src
    if (listaId && !videoId) {
      // Link a una playlist pura (senza un video specifico di partenza)
      src = `https://www.youtube.com/embed/videoseries?list=${listaId}&enablejsapi=1&autoplay=1&loop=1`
    } else if (listaId && videoId) {
      // Link a un video che fa parte di una playlist: riproduce l'intera playlist partendo da lì
      src = `https://www.youtube.com/embed/${videoId}?list=${listaId}&enablejsapi=1&autoplay=1&loop=1`
    } else {
      // Video singolo: il trucco playlist=stesso-id serve a farlo ripetere in loop
      src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&loop=1&playlist=${videoId}`
    }

    return (
      <div className="media-player">
        <p className="media-player-label">🎵 Musica impostata dal GM</p>
        <iframe
          ref={iframeRef}
          className="youtube-frame"
          width="100%"
          src={src}
          title="Musica della stanza"
          frameBorder="0"
          allow="autoplay; encrypted-media"
          allowFullScreen
          onLoad={() => {
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ event: 'command', func: 'setVolume', args: [volume] }),
              '*'
            )
          }}
        />
        <ControlloVolume volume={volume} onChange={setVolume} />
      </div>
    )
  }

  if (tipo === 'spotify') {
    const match = url.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/)
    if (!match) return null
    const [, categoria, id] = match
    return (
      <div className="media-player">
        <p className="media-player-label">🎵 Musica impostata dal GM</p>
        <iframe
          src={`https://open.spotify.com/embed/${categoria}/${id}?autoplay=1`}
          width="100%"
          height="80"
          frameBorder="0"
          allow="autoplay; encrypted-media"
          title="Musica della stanza"
        />
        <p className="volume-hint">Volume e loop si regolano direttamente nel player Spotify qui sopra (Spotify non permette di controllarli dall'esterno).</p>
      </div>
    )
  }

  if (tipo === 'mp3') {
    return (
      <div className="media-player">
        <p className="media-player-label">🎵 Musica impostata dal GM</p>
        <audio ref={audioRef} controls autoPlay loop src={url} style={{ width: '100%' }} />
        <ControlloVolume volume={volume} onChange={setVolume} />
        {autoplayBloccato && (
          <button className="btn-ghost autoplay-fallback-btn" onClick={avviaManualmente}>
            ▶️ Il browser ha bloccato l'avvio automatico — tocca per avviare
          </button>
        )}
      </div>
    )
  }

  return null
}

// --- Videochiamata condivisa (JaaS / Jitsi as a Service, tramite token generato dalla Edge Function) ---
function caricaScriptJaas(appId) {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = `https://8x8.vc/${appId}/external_api.js`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Impossibile caricare lo script di 8x8/JaaS'))
    document.body.appendChild(script)
  })
}

function VideoChiamata({ roomCode, nickname, isGM }) {
  const containerRef = useRef(null)
  const apiRef = useRef(null)
  const [stato, setStato] = useState('caricamento') // caricamento | pronto | errore
  const [erroreVideo, setErroreVideo] = useState(null)
  const nomeStanzaJaas = `TavoloDadi-${roomCode}-companiongdr`.replace(/[^a-zA-Z0-9-]/g, '')

  useEffect(() => {
    let annullato = false

    async function avvia() {
      try {
        const { data, error } = await supabase.functions.invoke('jaas-token', {
          body: { room: nomeStanzaJaas, nickname, isGM },
        })
        if (error) throw error
        if (!data?.token || !data?.appId) throw new Error('Token non ricevuto')
        if (annullato) return

        await caricaScriptJaas(data.appId)
        if (annullato || !containerRef.current) return

        apiRef.current = new window.JitsiMeetExternalAPI('8x8.vc', {
          roomName: `${data.appId}/${data.room}`,
          jwt: data.token,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          configOverwrite: { prejoinPageEnabled: false, disableDeepLinking: true },
          userInfo: { displayName: nickname },
        })

        setStato('pronto')
      } catch (err) {
        if (!annullato) {
          setErroreVideo(err.message || 'Errore nel connettersi alla videochiamata')
          setStato('errore')
        }
      }
    }
    avvia()

    return () => {
      annullato = true
      apiRef.current?.dispose?.()
      apiRef.current = null
    }
  }, [roomCode, nickname])

  function apriSchermoIntero() {
    containerRef.current?.requestFullscreen?.()
  }

  return (
    <div className="video-panel">
      <div className="video-frame-wrap">
        <div ref={containerRef} className="video-iframe" />
        {stato === 'caricamento' && <p className="video-status">Connessione alla videochiamata…</p>}
        {stato === 'errore' && <p className="video-status video-status-errore">⚠️ {erroreVideo}</p>}
        {stato === 'pronto' && (
          <button className="video-fullscreen-btn" onClick={apriSchermoIntero} title="Schermo intero">
            ⛶
          </button>
        )}
      </div>
      <p className="gm-hint">
        Videochiamata tramite Jitsi as a Service (8x8): tutti i giocatori che aprono "🎥 Video/Audio" nella stessa stanza finiscono automaticamente nella stessa chiamata.
      </p>
    </div>
  )
}

// --- Griglia di battaglia con pedine trascinabili (drag & drop touch-friendly) ---
const CELLA_PX = 42

const COLORI_TIPO_PEDINA = {
  giocatore: '#C9A227',
  nemico: '#8B3A3A',
  altro: '#6d7a72',
}
const ICONE_TIPO_PEDINA = {
  giocatore: '👤',
  nemico: '👹',
  altro: '❓',
}

function GrigliaBattaglia({ griglia, pedine, isGM, onSposta, onElimina, colorePannelli, modalitaDisegno, coloreDisegno, onDisegnaFine, stati }) {
  const containerRef = useRef(null)
  const [trascinando, setTrascinando] = useState(null) // { id, left, top }
  const [trattoInCorso, setTrattoInCorso] = useState(null) // array di punti {x,y} mentre si disegna

  const larghezza = griglia.colonne * CELLA_PX
  const altezza = griglia.righe * CELLA_PX
  const disegno = griglia.disegno || []

  function puntoRelativo(e) {
    const rect = containerRef.current.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function iniziaTrascinamento(e, pedina) {
    if (!isGM || modalitaDisegno) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setTrascinando({ id: pedina.id, left: pedina.colonna * CELLA_PX, top: pedina.riga * CELLA_PX })
  }

  function durante(e) {
    if (!trascinando || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const left = e.clientX - rect.left - CELLA_PX / 2
    const top = e.clientY - rect.top - CELLA_PX / 2
    setTrascinando((prev) => (prev ? { ...prev, left, top } : prev))
  }

  function fine(e) {
    if (!trascinando || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const xRel = e.clientX - rect.left - CELLA_PX / 2
    const yRel = e.clientY - rect.top - CELLA_PX / 2
    const colonna = Math.min(griglia.colonne - 1, Math.max(0, Math.round(xRel / CELLA_PX)))
    const riga = Math.min(griglia.righe - 1, Math.max(0, Math.round(yRel / CELLA_PX)))
    onSposta(trascinando.id, riga, colonna)
    setTrascinando(null)
  }

  // --- Disegno libero (solo GM, in modalità "disegna") ---
  function iniziaTratto(e) {
    if (!modalitaDisegno || !containerRef.current) return
    containerRef.current.setPointerCapture(e.pointerId)
    setTrattoInCorso([puntoRelativo(e)])
  }

  function continuaTratto(e) {
    if (!trattoInCorso) return
    setTrattoInCorso((prev) => [...prev, puntoRelativo(e)])
  }

  function fineTratto() {
    if (!trattoInCorso) return
    if (trattoInCorso.length > 1) {
      onDisegnaFine([...disegno, { colore: coloreDisegno, punti: trattoInCorso }])
    }
    setTrattoInCorso(null)
  }

  function gestisciPointerDown(e) {
    if (modalitaDisegno) iniziaTratto(e)
  }
  function gestisciPointerMove(e) {
    if (modalitaDisegno) continuaTratto(e)
    else durante(e)
  }
  function gestisciPointerUp(e) {
    if (modalitaDisegno) fineTratto(e)
    else fine(e)
  }

  return (
    <div className="grid-battaglia-wrap">
      <div
        ref={containerRef}
        className={`grid-battaglia-container ${modalitaDisegno ? 'grid-battaglia-container-disegno' : ''}`}
        style={{
          width: larghezza,
          height: altezza,
          gridTemplateColumns: `repeat(${griglia.colonne}, ${CELLA_PX}px)`,
          gridTemplateRows: `repeat(${griglia.righe}, ${CELLA_PX}px)`,
          background: colorePannelli || undefined,
        }}
        onPointerDown={gestisciPointerDown}
        onPointerMove={gestisciPointerMove}
        onPointerUp={gestisciPointerUp}
      >
        {Array.from({ length: griglia.righe * griglia.colonne }).map((_, i) => (
          <div key={i} className="grid-cella" />
        ))}

        <svg className="grid-disegno-layer" width={larghezza} height={altezza}>
          {disegno.map((tratto, i) => (
            <polyline
              key={i}
              points={tratto.punti.map((p) => `${p.x},${p.y}`).join(' ')}
              stroke={tratto.colore}
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {trattoInCorso && (
            <polyline
              points={trattoInCorso.map((p) => `${p.x},${p.y}`).join(' ')}
              stroke={coloreDisegno}
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>

        {pedine.map((p) => {
          const inTrascinamento = trascinando?.id === p.id
          const left = inTrascinamento ? trascinando.left : p.colonna * CELLA_PX
          const top = inTrascinamento ? trascinando.top : p.riga * CELLA_PX
          const colore = p.tipo === 'giocatore' ? colorePerNickname(p.etichetta) : (COLORI_TIPO_PEDINA[p.tipo] || COLORI_TIPO_PEDINA.altro)
          const testoBreve = p.tipo === 'giocatore' ? p.etichetta.slice(0, 3).toUpperCase() : p.etichetta
          const statiPedina = (stati || []).filter((s) =>
            p.tipo === 'giocatore' ? (s.target_type === 'player' && s.target_key === p.etichetta) : (s.target_type === 'token' && s.target_key === p.id)
          )
          const titoloPedina = statiPedina.length ? `${p.etichetta} — ${statiPedina.map((s) => s.etichetta).join(', ')}` : p.etichetta
          return (
            <div
              key={p.id}
              className={`grid-pedina ${inTrascinamento ? 'grid-pedina-trascinando' : ''} ${isGM && !modalitaDisegno ? 'grid-pedina-trascinabile' : ''}`}
              style={{ left, top, background: colore }}
              onPointerDown={(e) => iniziaTrascinamento(e, p)}
              title={titoloPedina}
            >
              <span className="grid-pedina-etichetta">{testoBreve}</span>
              {statiPedina.length > 0 && (
                <span className="grid-pedina-stato-badge">{statiPedina.length}</span>
              )}
              {isGM && !modalitaDisegno && (
                <button
                  className="grid-pedina-elimina"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onElimina(p.id)}
                  title="Elimina pedina"
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>
      <p className="gm-hint">
        {ICONE_TIPO_PEDINA.giocatore} giocatore · {ICONE_TIPO_PEDINA.nemico} nemico · {ICONE_TIPO_PEDINA.altro} altro
        {!isGM && ' — solo il GM può modificare la griglia.'}
      </p>
    </div>
  )
}

function formattaDettaglioTiro(t) {
  if (t.breakdown && Array.isArray(t.breakdown)) {
    return t.breakdown
      .map((g) => `${g.segno < 0 ? '-' : ''}[${g.values.join(',')}]`)
      .join(' ')
  }
  return (t.results || []).join(' + ')
}

export default function App() {
  const path = useMemo(getPath, [])
  const match = path.match(/^\/r\/([A-Za-z0-9-]+)$/)

  if (match) {
    const roomCode = match[1].toUpperCase()
    return <Room roomCode={roomCode} />
  }

  return <Landing />
}

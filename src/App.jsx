import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { lanciaEspressione, formattaNotazione } from './diceNotation'
import { Dice3DTray } from './Dice3D'

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

function getPath() {
  return window.location.pathname
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

  function creaStanza() {
    const code = generaCodiceStanza()
    window.location.href = `/r/${code}`
  }

  function entraStanza(e) {
    e.preventDefault()
    if (joinCode.trim()) {
      window.location.href = `/r/${joinCode.trim().toUpperCase()}`
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
  const [espressione, setEspressione] = useState('')
  const [errore, setErrore] = useState(null)
  const [tiri, setTiri] = useState([])
  const [rolling, setRolling] = useState(false)
  const [ultimoBreakdown, setUltimoBreakdown] = useState(null)
  const [copiato, setCopiato] = useState(false)
  const listEndRef = useRef(null)

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

    const channel = supabase
      .channel(`room:${roomCode}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rolls', filter: `room_code=eq.${roomCode}` },
        (payload) => {
          setTiri((prev) => [...prev, payload.new])
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [nickname, roomCode])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [tiri])

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

    let esito
    try {
      esito = lanciaEspressione(espressione)
    } catch (err) {
      setErrore(err.message)
      return
    }

    setRolling(true)
    setUltimoBreakdown(esito.breakdown)

    setTimeout(async () => {
      setRolling(false)
      const notazione = formattaNotazione(esito.breakdown, esito.modificatoreFisso)
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

  if (!nickname) {
    return <NicknameGate roomCode={roomCode} onJoin={setNickname} />
  }

  return (
    <div className="room">
      <header className="room-header">
        <div>
          <h2>Tavolo <span className="room-code-inline">{roomCode}</span></h2>
          <p className="room-sub">Giochi come <strong>{nickname}</strong></p>
        </div>
        <button className="btn-ghost" onClick={copiaLink}>
          {copiato ? 'Link copiato ✓' : 'Invita giocatori'}
        </button>
      </header>

      <div className="dice-panel">
        <Dice3DTray breakdown={ultimoBreakdown} rolling={rolling} color={colorePerNickname(nickname)} />

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

          <button className="btn-primary btn-roll" onClick={lancia} disabled={rolling || !espressione.trim()}>
            {rolling ? 'Lancio…' : espressione.trim() ? `Lancia ${espressione}` : 'Lancia'}
          </button>
        </div>
      </div>

      <div className="storico">
        <h3>Cronologia tiri</h3>
        {tiri.length === 0 && <p className="storico-empty">Nessun tiro ancora. Rompete il ghiaccio!</p>}
        <ul className="storico-list">
          {tiri.map((t) => (
            <li
              key={t.id ?? `${t.created_at}-${t.nickname}`}
              className="storico-item"
              style={{ borderLeftColor: colorePerNickname(t.nickname) }}
            >
              <span className="storico-nome" style={{ color: colorePerNickname(t.nickname) }}>{t.nickname}</span>
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

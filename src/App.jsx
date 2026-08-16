import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabaseClient'

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

// --- Faccia di dado con pallini reali (SVG) ---
const PIP_LAYOUTS = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
}

function DiceFace({ value, size = 56 }) {
  const pips = PIP_LAYOUTS[value] || []
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="dice-face">
      <rect x="4" y="4" width="92" height="92" rx="16" className="dice-face-bg" />
      {pips.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" className="dice-pip" />
      ))}
    </svg>
  )
}

function RollingDie({ finalValue, rolling }) {
  const [display, setDisplay] = useState(finalValue)

  useEffect(() => {
    if (!rolling) {
      setDisplay(finalValue)
      return
    }
    let ticks = 0
    const id = setInterval(() => {
      setDisplay(1 + Math.floor(Math.random() * 6))
      ticks += 1
      if (ticks > 8) clearInterval(id)
    }, 60)
    return () => clearInterval(id)
  }, [rolling, finalValue])

  return (
    <div className={`die-wrapper ${rolling ? 'die-rolling' : ''}`}>
      <DiceFace value={display} />
    </div>
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
          <DiceFace value={6} size={88} />
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
          <DiceFace value={3} size={72} />
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
  const [numDadi, setNumDadi] = useState(1)
  const [tiri, setTiri] = useState([])
  const [rolling, setRolling] = useState(false)
  const [ultimoTiro, setUltimoTiro] = useState(null)
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

  async function lancia() {
    if (rolling) return
    const risultati = Array.from({ length: numDadi }, () => 1 + Math.floor(Math.random() * 6))
    const totale = risultati.reduce((a, b) => a + b, 0)

    setRolling(true)
    setUltimoTiro(risultati[0])

    setTimeout(async () => {
      setRolling(false)
      await supabase.from('rolls').insert({
        room_code: roomCode,
        nickname,
        dice_count: numDadi,
        results: risultati,
        total: totale,
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
        <RollingDie finalValue={ultimoTiro ?? 6} rolling={rolling} />

        <div className="dice-controls">
          <label htmlFor="numDadi">Numero di d6</label>
          <div className="stepper">
            <button
              type="button"
              onClick={() => setNumDadi((n) => Math.max(1, n - 1))}
              className="stepper-btn"
              aria-label="Diminuisci"
            >
              −
            </button>
            <input
              id="numDadi"
              type="number"
              min="1"
              max="20"
              value={numDadi}
              onChange={(e) => setNumDadi(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
            />
            <button
              type="button"
              onClick={() => setNumDadi((n) => Math.min(20, n + 1))}
              className="stepper-btn"
              aria-label="Aumenta"
            >
              +
            </button>
          </div>
          <button className="btn-primary btn-roll" onClick={lancia} disabled={rolling}>
            {rolling ? 'Lancio…' : `Lancia ${numDadi}d6`}
          </button>
        </div>
      </div>

      <div className="storico">
        <h3>Cronologia tiri</h3>
        {tiri.length === 0 && <p className="storico-empty">Nessun tiro ancora. Rompete il ghiaccio!</p>}
        <ul className="storico-list">
          {tiri.map((t) => (
            <li key={t.id ?? `${t.created_at}-${t.nickname}`} className="storico-item">
              <span className="storico-nome">{t.nickname}</span>
              <span className="storico-dadi">
                {t.dice_count}d6: {t.results.join(' + ')}
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

export default function App() {
  const path = useMemo(getPath, [])
  const match = path.match(/^\/r\/([A-Za-z0-9-]+)$/)

  if (match) {
    const roomCode = match[1].toUpperCase()
    return <Room roomCode={roomCode} />
  }

  return <Landing />
}

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { lanciaEspressione, formattaNotazione } from './diceNotation'

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

// --- Dadi rapidi da inserire nell'espressione con un tap ---
const TIPI_DADO = [4, 6, 8, 12, 20, 100]

// --- Faccia di dado con pallini reali (solo per d6, gli altri mostrano il numero) ---
const PIP_LAYOUTS = {
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 25], [75, 25], [25, 50], [75, 50], [25, 75], [75, 75]],
}

function DiceFace({ value, sides, size = 56 }) {
  if (sides === 6) {
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

  const latiPoligono = sides === 4 ? 3 : sides === 8 ? 8 : sides === 12 ? 10 : sides === 20 ? 6 : 8
  const points = poligonoPoints(latiPoligono)
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="dice-face">
      <polygon points={points} className="dice-face-bg" />
      <text x="50" y="58" textAnchor="middle" className="dice-face-number">{value}</text>
    </svg>
  )
}

function poligonoPoints(lati) {
  const pts = []
  for (let i = 0; i < lati; i++) {
    const angolo = (Math.PI * 2 * i) / lati - Math.PI / 2
    const x = 50 + 44 * Math.cos(angolo)
    const y = 50 + 44 * Math.sin(angolo)
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return pts.join(' ')
}

// Mostra un dado per ciascun gruppo lanciato (il primo dado del gruppo più numeroso, semplice euristica)
function RollingDie({ breakdown, rolling }) {
  const primoGruppo = breakdown && breakdown.length > 0 ? breakdown[0] : { sides: 6, values: [6] }
  const [display, setDisplay] = useState(primoGruppo.values[0])

  useEffect(() => {
    if (!rolling) {
      setDisplay(primoGruppo.values[0])
      return
    }
    let ticks = 0
    const id = setInterval(() => {
      setDisplay(1 + Math.floor(Math.random() * primoGruppo.sides))
      ticks += 1
      if (ticks > 8) clearInterval(id)
    }, 60)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolling])

  return (
    <div className={`die-wrapper ${rolling ? 'die-rolling' : ''}`}>
      <DiceFace value={display} sides={primoGruppo.sides} size={72} />
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
          <DiceFace value={6} sides={6} size={88} />
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
          <DiceFace value={3} sides={6} size={72} />
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
  const [espressione, setEspressione] = useState('1d6')
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
        <RollingDie breakdown={ultimoBreakdown} rolling={rolling} />

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

          <button className="btn-primary btn-roll" onClick={lancia} disabled={rolling}>
            {rolling ? 'Lancio…' : `Lancia ${espressione || '…'}`}
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

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

  function creaStanza() {
    const code = generaCodiceStanza()
    sessionStorage.setItem(`gm:${code}`, '1')
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
    setEspressione('')

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

        {videoAperto && <VideoChiamata roomCode={roomCode} nickname={nickname} />}

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
          </div>
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
              style={{
                borderLeftColor: colorePerNickname(t.nickname),
                ...(colorePannelli ? { backgroundColor: colorePannelli } : {}),
              }}
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

  if (tipo === 'youtube') {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/)
    const id = match ? match[1] : null
    if (!id) return null
    return (
      <div className="media-player">
        <p className="media-player-label">🎵 Musica impostata dal GM</p>
        <iframe
          ref={iframeRef}
          className="youtube-frame"
          width="100%"
          src={`https://www.youtube.com/embed/${id}?enablejsapi=1`}
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
          src={`https://open.spotify.com/embed/${categoria}/${id}`}
          width="100%"
          height="80"
          frameBorder="0"
          allow="encrypted-media"
          title="Musica della stanza"
        />
        <p className="volume-hint">Il volume si regola direttamente nel player Spotify qui sopra.</p>
      </div>
    )
  }

  if (tipo === 'mp3') {
    return (
      <div className="media-player">
        <p className="media-player-label">🎵 Musica impostata dal GM</p>
        <audio ref={audioRef} controls src={url} style={{ width: '100%' }} />
        <ControlloVolume volume={volume} onChange={setVolume} />
      </div>
    )
  }

  return null
}

// --- Videochiamata condivisa (Jitsi Meet, gratuito, nessuna configurazione lato server) ---
function VideoChiamata({ roomCode, nickname }) {
  const nomeStanzaJitsi = `TavoloDadi-${roomCode}-companion-gdr`
  const src =
    `https://meet.jit.si/${encodeURIComponent(nomeStanzaJitsi)}` +
    `#config.prejoinPageEnabled=false` +
    `&config.startWithVideoMuted=false` +
    `&config.disableDeepLinking=true` +
    `&userInfo.displayName=${encodeURIComponent(nickname)}`

  return (
    <div className="video-panel">
      <iframe
        src={src}
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        className="video-iframe"
        title="Videochiamata del tavolo"
      />
      <p className="gm-hint">
        Videochiamata gratuita tramite Jitsi Meet: tutti i giocatori che aprono "🎥 Video/Audio" nella stessa stanza finiscono automaticamente nella stessa chiamata.
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

// --- Utility per il pannello Game Master: sfondo stanza e media condivisi ---

export const PALETTE_SFONDI = [
  { nome: 'Feltro verde', colore: '#1B2E22' },
  { nome: 'Notte blu', colore: '#16233A' },
  { nome: 'Vino', colore: '#3A1620' },
  { nome: 'Inchiostro', colore: '#15161C' },
  { nome: 'Ambra', colore: '#3A2A16' },
]

// Scurisce un colore esadecimale di una percentuale, per costruire il gradiente di sfondo
export function scurisciHex(hex, quantita = 0.55) {
  const pulito = hex.replace('#', '')
  const r = parseInt(pulito.substring(0, 2), 16)
  const g = parseInt(pulito.substring(2, 4), 16)
  const b = parseInt(pulito.substring(4, 6), 16)
  const f = (c) => Math.round(c * (1 - quantita))
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`
}

// Riconosce il tipo di link musicale incollato dal GM
export function classificaMedia(url) {
  const pulito = url.trim()
  if (!pulito) return null

  if (/\.mp3(\?.*)?$/i.test(pulito)) return { tipo: 'mp3', url: pulito }

  const matchYoutube = pulito.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{6,})/
  )
  if (matchYoutube) return { tipo: 'youtube', id: matchYoutube[1] }

  const matchSpotify = pulito.match(
    /open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/
  )
  if (matchSpotify) return { tipo: 'spotify', categoria: matchSpotify[1], id: matchSpotify[2] }

  return null
}

// --- Geometria per gli "orologi" a spicchi (countdown alla Blades in the Dark) ---
function polareCartesiano(cx, cy, r, angoloDeg) {
  const rad = ((angoloDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

// Restituisce il path SVG di un singolo spicchio (indice i su un totale di N)
export function pathSpicchio(cx, cy, r, indice, totale) {
  const angoloPerSpicchio = 360 / totale
  const inizio = indice * angoloPerSpicchio
  const fine = inizio + angoloPerSpicchio
  const p1 = polareCartesiano(cx, cy, r, fine)
  const p2 = polareCartesiano(cx, cy, r, inizio)
  const largeArc = angoloPerSpicchio > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`
}

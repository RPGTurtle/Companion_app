// Parser per espressioni dadi tipo "2d6+1d20+2d4+3" o "4d6-1d4"
// Le parentesi sono ignorate ai fini del calcolo (l'addizione è associativa),
// ma vengono accettate per comodità di scrittura dell'utente.

export function parseNotazione(input) {
  const pulita = input.replace(/[()\s]/g, '')
  if (!pulita) throw new Error('Espressione vuota')

  // Divide in termini mantenendo il segno, es. "2d6+1d20-3" -> ["+2d6", "+1d20", "-3"]
  const conSegno = pulita[0] === '+' || pulita[0] === '-' ? pulita : `+${pulita}`
  const termini = conSegno.match(/[+-][^+-]+/g)
  if (!termini) throw new Error('Espressione non valida')

  const gruppi = []
  let modificatoreFisso = 0

  for (const termine of termini) {
    const segno = termine[0] === '-' ? -1 : 1
    const corpo = termine.slice(1)

    const matchDado = corpo.match(/^(\d*)d(\d+)$/i)
    if (matchDado) {
      const count = matchDado[1] ? parseInt(matchDado[1], 10) : 1
      const sides = parseInt(matchDado[2], 10)
      if (count < 1 || count > 50) throw new Error(`Numero di dadi non valido: ${count}`)
      if (sides < 2 || sides > 1000) throw new Error(`Tipo di dado non valido: d${sides}`)
      gruppi.push({ segno, count, sides })
      continue
    }

    const matchNumero = corpo.match(/^\d+$/)
    if (matchNumero) {
      modificatoreFisso += segno * parseInt(corpo, 10)
      continue
    }

    throw new Error(`Termine non riconosciuto: "${termine}"`)
  }

  if (gruppi.length === 0) throw new Error('Serve almeno un dado (es. 2d6)')

  return { gruppi, modificatoreFisso }
}

export function lanciaEspressione(input) {
  const { gruppi, modificatoreFisso } = parseNotazione(input)

  const breakdown = gruppi.map(({ segno, count, sides }) => {
    const values = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides))
    const subtotal = segno * values.reduce((a, b) => a + b, 0)
    return { segno, count, sides, values, subtotal }
  })

  const totale = breakdown.reduce((acc, g) => acc + g.subtotal, 0) + modificatoreFisso

  return { breakdown, modificatoreFisso, totale }
}

export function formattaNotazione(breakdown, modificatoreFisso) {
  const parti = breakdown.map((g, i) => {
    const segnoStr = g.segno < 0 ? '-' : i === 0 ? '' : '+'
    return `${segnoStr}${g.count}d${g.sides}`
  })
  if (modificatoreFisso !== 0) {
    parti.push(modificatoreFisso > 0 ? `+${modificatoreFisso}` : `${modificatoreFisso}`)
  }
  return parti.join('') || '0'
}

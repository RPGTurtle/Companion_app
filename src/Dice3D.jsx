import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

// --- Geometrie dei poliedri per ciascun tipo di dado ---
function geometriaPerLati(sides) {
  switch (sides) {
    case 4:
      return new THREE.TetrahedronGeometry(1.15)
    case 6:
      return new THREE.BoxGeometry(1.35, 1.35, 1.35)
    case 8:
      return new THREE.OctahedronGeometry(1.15)
    case 10:
      return bipiramideDecagonale()
    case 12:
      return new THREE.DodecahedronGeometry(1.05)
    case 20:
      return new THREE.IcosahedronGeometry(1.05)
    case 100:
      return new THREE.IcosahedronGeometry(1.05, 1)
    default:
      return new THREE.BoxGeometry(1.3, 1.3, 1.3)
  }
}

// Bipiramide pentagonale: 2 apici + 5 vertici equatoriali = 10 facce triangolari, la forma classica del d10
function bipiramideDecagonale() {
  const geo = new THREE.BufferGeometry()
  const raggio = 1.05
  const altezza = 1.3
  const vertici = []
  vertici.push(0, altezza, 0)
  vertici.push(0, -altezza, 0)
  for (let i = 0; i < 5; i++) {
    const angolo = (Math.PI * 2 * i) / 5
    const y = i % 2 === 0 ? 0.15 : -0.15
    vertici.push(raggio * Math.cos(angolo), y, raggio * Math.sin(angolo))
  }
  const positions = new Float32Array(vertici)

  const indici = []
  for (let i = 0; i < 5; i++) {
    const a = 2 + i
    const b = 2 + ((i + 1) % 5)
    indici.push(0, a, b) // facce superiori
    indici.push(1, b, a) // facce inferiori
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setIndex(indici)
  geo.computeVertexNormals()
  return geo
}

// --- Vassoio 3D condiviso: una sola scena Three.js per tutti i dadi lanciati insieme ---
export function Dice3DTray({ breakdown, rolling, color, size = 84 }) {
  const containerRef = useRef(null)
  const stateRef = useRef({})

  const gruppi = breakdown && breakdown.length > 0 ? breakdown : [{ sides: 6, values: [6], segno: 1 }]
  const dadiFlat = gruppi.flatMap((g) =>
    g.values.map((v) => ({ sides: g.sides, valore: v, segno: g.segno }))
  )

  // Setup scena una sola volta
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const luceAmbiente = new THREE.AmbientLight(0xffffff, 0.65)
    scene.add(luceAmbiente)
    const luceDirezionale = new THREE.DirectionalLight(0xffffff, 1.1)
    luceDirezionale.position.set(3, 5, 4)
    scene.add(luceDirezionale)
    const luceRiempimento = new THREE.DirectionalLight(0xE8DCC4, 0.35)
    luceRiempimento.position.set(-4, -2, 2)
    scene.add(luceRiempimento)

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
    camera.position.set(0, 1.1, 5)
    camera.lookAt(0, 0, 0)

    stateRef.current = { scene, renderer, camera, container, meshes: [], raf: null }

    return () => {
      cancelAnimationFrame(stateRef.current.raf)
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [])

  // Ridimensiona la scena in base al numero di dadi da mostrare
  useEffect(() => {
    const st = stateRef.current
    if (!st.renderer) return
    const slot = size
    const larghezzaPx = Math.min(Math.max(dadiFlat.length, 1) * slot, 560)
    const altezzaPx = size * 1.05

    st.renderer.setSize(larghezzaPx, altezzaPx)
    const unitPerPx = 1 / 42
    const halfW = (larghezzaPx * unitPerPx) / 2
    const halfH = (altezzaPx * unitPerPx) / 2
    st.camera.left = -halfW
    st.camera.right = halfW
    st.camera.top = halfH
    st.camera.bottom = -halfH
    st.camera.updateProjectionMatrix()
    st.slotWorld = slot * unitPerPx
  }, [dadiFlat.length, size])

  // Ricostruisce le mesh quando cambia il set di dadi o il colore
  useEffect(() => {
    const st = stateRef.current
    if (!st.scene) return

    st.meshes.forEach(({ mesh, edges }) => {
      st.scene.remove(mesh)
      st.scene.remove(edges)
      mesh.geometry.dispose()
      mesh.material.dispose()
    })
    st.meshes = []

    const n = dadiFlat.length
    dadiFlat.forEach((dado, i) => {
      const geo = geometriaPerLati(dado.sides)
      const materiale = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color || '#E8DCC4'),
        flatShading: true,
        roughness: 0.4,
        metalness: 0.08,
      })
      const mesh = new THREE.Mesh(geo, materiale)

      const edgesGeo = new THREE.EdgesGeometry(geo, 20)
      const edgesMat = new THREE.LineBasicMaterial({ color: 0x0f1d15, transparent: true, opacity: 0.5 })
      const edges = new THREE.LineSegments(edgesGeo, edgesMat)
      mesh.add(edges)

      const x = (i - (n - 1) / 2) * (st.slotWorld || 2)
      mesh.position.set(x, 0, 0)
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)

      st.scene.add(mesh)
      st.meshes.push({
        mesh, edges,
        velX: 0, velY: 0, velZ: 0,
        segno: dado.segno,
      })
    })

    if (!st.raf) avviaLoop(st)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(dadiFlat.map((d) => `${d.sides}-${d.valore}`)), color])

  // Innesca la rotazione veloce quando parte un lancio
  useEffect(() => {
    const st = stateRef.current
    if (!rolling || !st.meshes) return
    st.meshes.forEach((m) => {
      m.velX = 8 + Math.random() * 10
      m.velY = 8 + Math.random() * 10
      m.velZ = 4 + Math.random() * 6
    })
    st.rollUntil = performance.now() + 650
  }, [rolling])

  function avviaLoop(st) {
    let ultimo = performance.now()
    function tick(ora) {
      const dt = Math.min((ora - ultimo) / 1000, 0.05)
      ultimo = ora
      const inCorsa = st.rollUntil && ora < st.rollUntil

      st.meshes.forEach((m) => {
        if (inCorsa) {
          m.mesh.rotation.x += m.velX * dt
          m.mesh.rotation.y += m.velY * dt
          m.mesh.rotation.z += m.velZ * dt
        } else {
          m.velX *= 0.9
          m.velY *= 0.9
          m.velZ *= 0.9
          m.mesh.rotation.x += m.velX * dt
          m.mesh.rotation.y += m.velY * dt
          m.mesh.rotation.z += m.velZ * dt
        }
      })

      if (st.renderer && st.scene && st.camera) {
        st.renderer.render(st.scene, st.camera)
      }
      st.raf = requestAnimationFrame(tick)
    }
    st.raf = requestAnimationFrame(tick)
  }

  // Determina, per ciascun dado dell'elenco appiattito, se è il primo di un gruppo negativo (per il segno "−")
  const confiniGruppo = []
  let idx = 0
  gruppi.forEach((g) => {
    g.values.forEach((_, vi) => {
      confiniGruppo.push(vi === 0 && g.segno < 0)
      idx += 1
    })
  })

  return (
    <div className="dice3d-wrap">
      <div ref={containerRef} className="dice3d-canvas-host" />
      <div className="dice3d-overlay">
        {dadiFlat.map((dado, i) => (
          <div key={i} className="dice3d-slot" style={{ width: size }}>
            {confiniGruppo[i] && <span className="dice-tray-sign dice3d-sign">−</span>}
            <div className={`dice3d-badge ${rolling ? 'dice3d-badge-hidden' : ''}`}>
              {dado.valore}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Dado singolo statico (per le schermate landing/nickname, senza interattività) ---
export function Dice3DSingle({ sides = 6, color, size = 88 }) {
  return <Dice3DTray breakdown={[{ sides, values: [Math.ceil(sides / 2) || 1], segno: 1 }]} rolling={false} color={color} size={size} />
}

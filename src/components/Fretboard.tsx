import { useEffect, useRef } from 'react'
import { FRETS, stringNames } from '@/lib/theory'

export interface BoardItem {
  s: number; f: number
  cls: string            // role class: r | t3 | t5 | t7 | tone | out, plus modifiers (faint, sel, ext)
  label: string
  order?: number         // small step number beside the dot
  r?: number             // radius
  title?: string
  badge?: boolean        // small marker: this note is also in the next chord of a progression
  opacity?: number       // fade a dot (used for later chords in a progression)
}

const G = { PAD: 12, OPENW: 38, FW: 54, TOP: 14, GAP: 30, MARG: 16 }

export function boardGeom(nStrings: number, frets: number) {
  const nutX = G.PAD + G.OPENW, boardH = G.MARG * 2 + G.GAP * (nStrings - 1)
  return {
    nutX, boardH, frets, n: nStrings,
    W: nutX + G.FW * frets + G.PAD, H: G.TOP + boardH + 30,
    x: (f: number) => (f === 0 ? G.PAD + G.OPENW / 2 : nutX + (f - 0.5) * G.FW),
    y: (s: number) => G.TOP + G.MARG + (nStrings - 1 - s) * G.GAP,
  }
}

const SINGLE = [3, 5, 7, 9, 15, 17, 19, 21]
const DOUBLE = [12, 24]
const LABELED = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24]

export function Fretboard({ tuning, items, band, frets = FRETS, focus, onPick, scrollTo, label }: {
  tuning: number[]
  items: BoardItem[]
  band?: { lo: number; hi: number } | null
  frets?: number
  focus?: string | null
  onPick?: (key: string) => void
  scrollTo?: { lo: number; hi: number } | null
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const g = boardGeom(tuning.length, frets)
  const names = stringNames(tuning)
  const T = G.TOP, bh = g.boardH

  // Keep the interesting part of the neck centered when it changes.
  useEffect(() => {
    const el = ref.current
    if (!el || !scrollTo) return
    const cx = (g.x(scrollTo.lo) + g.x(scrollTo.hi)) / 2
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: Math.max(0, cx - el.clientWidth / 2), behavior: reduce ? 'auto' : 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo?.lo, scrollTo?.hi, frets, tuning.length])

  return (
    <div ref={ref} className="overflow-x-auto">
      <svg width={g.W} height={g.H} viewBox={`0 0 ${g.W} ${g.H}`} role="img" aria-label={label} className="block">
        <rect x={g.nutX} y={T} width={G.FW * g.frets} height={bh} fill="var(--board)" />
        {band && (() => {
          const x1 = band.lo === 0 ? G.PAD : g.nutX + Math.max(0, band.lo - 1) * G.FW, x2 = g.nutX + band.hi * G.FW
          return <rect x={x1} y={T - 6} width={x2 - x1} height={bh + 12} rx={6} fill="var(--accent)" opacity={0.16} />
        })()}
        {SINGLE.filter(f => f <= g.frets).map(f => <circle key={'i' + f} cx={g.x(f)} cy={T + bh / 2} r={6} fill="var(--inlay)" />)}
        {DOUBLE.filter(f => f <= g.frets).map(f => (
          <g key={'d' + f}>
            <circle cx={g.x(f)} cy={T + bh * 0.3} r={6} fill="var(--inlay)" />
            <circle cx={g.x(f)} cy={T + bh * 0.7} r={6} fill="var(--inlay)" />
          </g>
        ))}
        {Array.from({ length: g.frets }, (_, i) => i + 1).map(f => (
          <line key={'f' + f} x1={g.nutX + f * G.FW} x2={g.nutX + f * G.FW} y1={T} y2={T + bh} stroke="var(--fret)" strokeWidth={2} />
        ))}
        <rect x={g.nutX - 5} y={T} width={6} height={bh} fill="var(--nut)" />
        {tuning.map((_, s) => (
          <g key={'s' + s}>
            <line x1={G.PAD + 8} x2={g.W - G.PAD} y1={g.y(s)} y2={g.y(s)} stroke="var(--string)"
              strokeWidth={g.n > 1 ? 1 + 1.6 * (g.n - 1 - s) / (g.n - 1) : 1.5} />
            <text className="sname" x={G.PAD - 2} y={g.y(s)}>{names[s]}</text>
          </g>
        ))}
        {Array.from({ length: g.frets + 1 }, (_, f) => f).filter(f => f === 0 || LABELED.includes(f)).map(f => (
          <text key={'n' + f} className="fnum" x={g.x(f)} y={T + bh + 20}>{f}</text>
        ))}
        {items.map(it => {
          const k = `${it.s}-${it.f}`, x = g.x(it.f), y = g.y(it.s)
          return (
            <g key={k + it.cls} className={`dot ${it.cls}${focus === k ? ' focus' : ''}${onPick ? ' pick' : ''}`} style={it.opacity != null && it.opacity < 1 ? { opacity: it.opacity } : undefined} onClick={onPick ? () => onPick(k) : undefined}>
              <circle cx={x} cy={y} r={it.r ?? 12.5} />
              <text x={x} y={y}>{it.label}</text>
              {it.title && <title>{it.title}</title>}
              {it.order ? <text className="ord" x={x + 15} y={y - 10}>{it.order}</text> : null}
              {it.badge && <circle className="badge" cx={x + 9} cy={y + 9} r={4} />}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
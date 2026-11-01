import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { FLAT, INT, SHARP, keyRole, mod, stringNames, usesFlats, type Key } from '@/lib/theory'
import type { Beat, Note, Song, Track } from '@/lib/song'

export const TAB_MAX = 32

interface BarLayout { b: number; notes: Note[]; beats: Beat[]; len: number; w: number }

const LS = 20, TOPP = 34, LBL = 26

/** Tab for a bar range: rhythm-proportional spacing, rows that wrap to the container, notes colored by key role. */
export function TabStaff({ song, track, from, to, keyInfo, labels = 'frets', focus, onPick }: {
  song: Song; track: Track; from: number; to: number; keyInfo: Key
  /** What each note shows: its fret number (normal tab), note name, or interval from the key. */
  labels?: 'frets' | 'notes' | 'int'
  focus: string | null; onPick: (k: string) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(w => (Math.abs(el.clientWidth - w) > 4 ? el.clientWidth : w)))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const n = track.tuning.length, staffH = LS * (n - 1), rowH = TOPP + staffH + 50
  const names = stringNames(track.tuning)
  const pn = (pc: number) => (usesFlats(keyInfo.root, keyInfo.minor) ? FLAT : SHARP)[mod(pc, 12)]
  const last = Math.min(to, from + TAB_MAX - 1)

  const rows = useMemo(() => {
    if (!width) return []
    const bars: BarLayout[] = []
    for (let b = from; b <= last; b++) {
      const notes = track.notes.filter(x => x.bar === b), beats = track.beats.filter(x => x.bar === b)
      const len = song.bars[b].len || 3840
      const ts = [...new Set([...notes.map(x => x.t), ...beats.map(x => x.t)])].sort((a, c) => a - c)
      let gap = len
      for (let i = 1; i < ts.length; i++) gap = Math.min(gap, ts[i] - ts[i - 1])
      if (ts.length) gap = Math.min(gap, len - ts[ts.length - 1])
      bars.push({ b, notes, beats, len, w: Math.max(110, ts.length * 24 + 28, Math.min(900, len / Math.max(gap, 1) * 24 + 28)) })
    }
    const avail = Math.max(300, width) - LBL, out: BarLayout[][] = []
    let cur: BarLayout[] = [], cw = 0
    bars.forEach(bar => {
      if (cur.length && cw + bar.w > avail) { out.push(cur); cur = []; cw = 0 }
      cur.push(bar); cw += bar.w
    })
    if (cur.length) out.push(cur)
    // Stretch full rows to the container; leave a short final row at its natural width.
    out.forEach((row, ri) => {
      const tot = row.reduce((a, b) => a + b.w, 0)
      if (tot < avail && (ri < out.length - 1 || tot > avail * 0.6)) row.forEach(b => { b.w *= avail / tot })
    })
    return out
  }, [width, song, track, from, last])

  const y = (s: number) => TOPP + (n - 1 - s) * LS

  return (
    <div ref={wrapRef} className="flex min-w-0 flex-col gap-1.5 overflow-x-auto">
      {rows.map((row, ri) => {
        const rw = LBL + row.reduce((a, b) => a + b.w, 0)
        let x = LBL
        const barEls = row.map(bar => {
          const bx = x, sec = song.bars[bar.b].section
          x += bar.w
          const X = (t: number) => bx + 14 + (t / bar.len) * (bar.w - 28)
          return (
            <g key={bar.b}>
              <line className="tb" x1={bx} x2={bx} y1={TOPP} y2={TOPP + staffH} />
              <text className="tbn" x={bx + 4} y={TOPP - 18}>{bar.b + 1}</text>
              {sec && <text className="tsec" x={bx + 4 + String(bar.b + 1).length * 7 + 6} y={TOPP - 18}>{sec}</text>}
              {bar.notes.map(nt => {
                const nx = X(nt.t), ny = y(nt.s), pc = mod(nt.p, 12), lab = labels === 'notes' ? pn(pc) : labels === 'int' ? INT[mod(pc - keyInfo.root, 12)] : String(nt.f), pw = lab.length > 1 ? 21 : 15
                const k = `${nt.s}-${nt.f}`
                return (
                  <g key={`${nt.t}:${nt.s}`}>
                    <g className={`tn pick ${keyRole(pc, keyInfo)}${nt.tie ? ' tie' : ''}${focus === k ? ' focus' : ''}`} onClick={() => onPick(k)}>
                      <rect x={nx - pw / 2} y={ny - 8} width={pw} height={16} rx={8} />
                      <text x={nx} y={ny + 0.5}>{lab}</text>
                      <title>{`${pn(pc)} (${INT[mod(pc - keyInfo.root, 12)]}) · fret ${nt.f}${nt.tie ? ' · tied' : ''}`}</title>
                    </g>
                    {nt.tech && <text className="ttech" x={nx + pw / 2 + 4} y={ny - 9}>{nt.tech}</text>}
                  </g>
                )
              })}
              <RhythmMarks bar={bar} X={X} top={TOPP + staffH + 8} meta={song.bars[bar.b]} />
            </g>
          )
        })
        return (
          <svg key={ri} width={rw} height={rowH} viewBox={`0 0 ${rw} ${rowH}`} role="img" className="block"
            aria-label={`Tab, bars ${row[0].b + 1} to ${row[row.length - 1].b + 1}`}>
            {track.tuning.map((_, s) => (
              <g key={s}>
                <line className="tl" x1={LBL} x2={rw - 1} y1={y(s)} y2={y(s)} />
                <text className="tsn" x={LBL / 2} y={y(s)}>{names[s]}</text>
              </g>
            ))}
            {barEls}
            <line className="tb" x1={rw - 1} x2={rw - 1} y1={TOPP} y2={TOPP + staffH} />
          </svg>
        )
      })}
    </div>
  )
}

/** Stems, beams, flags, dots, tuplet numbers and rests drawn under one bar. */
function RhythmMarks({ bar, X, top, meta }: {
  bar: BarLayout; X: (t: number) => number; top: number; meta: { tsN: number; tsD: number }
}) {
  const SL = 24, bot = top + SL
  const beams = (d: number) => (d >= 8 ? Math.round(Math.log2(d / 4)) : 0)
  const grp = meta.tsD === 8 && meta.tsN % 3 === 0 ? 1440 : 960 // dotted-quarter groups in compound time
  const bs = bar.beats.slice().sort((a, c) => a.t - c.t)
  const els: ReactElement[] = []
  let key = 0
  const k = () => key++

  bs.filter(b => b.rest).forEach(b => {
    const x = X(b.t), yy = top + 10
    if (b.dur <= 2) els.push(<rect key={k()} className="rhf" x={x - 5} y={b.dur === 1 ? yy : yy + 3} width={10} height={3.5} />)
    else if (b.dur === 4) els.push(<polyline key={k()} className="rh" points={`${x - 2},${yy - 4} ${x + 3},${yy + 1} ${x - 2},${yy + 5} ${x + 3},${yy + 11} ${x - 1},${yy + 9}`} />)
    else {
      const n = beams(b.dur)
      for (let i = 0; i < n; i++) {
        const y2 = yy + i * 5
        els.push(<circle key={k()} className="rhf" cx={x - 3 - i} cy={y2} r={1.9} />)
        els.push(<line key={k()} className="rh" x1={x - 1.5 - i} y1={y2 + 1} x2={x + 3 - i} y2={y2 - 2} />)
      }
      els.push(<line key={k()} className="rh" x1={x + 3} y1={yy - 2} x2={x - 1 - n} y2={yy + 6 + n * 5} />)
    }
  })

  const notesB = bs.filter(b => !b.rest && b.dur >= 2)
  notesB.forEach(b => {
    const x = X(b.t)
    els.push(<line key={k()} className="rh" x1={x} y1={b.dur === 2 ? top + 11 : top} x2={x} y2={bot} />)
    for (let i = 0; i < b.dots; i++) els.push(<circle key={k()} className="rhf" cx={x + 5 + i * 4} cy={bot - 8} r={1.6} />)
  })

  const groups: Beat[][] = []
  let cur: Beat[] = []
  bs.forEach(b => {
    const ok = !b.rest && b.dur >= 8
    if (ok && cur.length && Math.floor(cur[0].t / grp) === Math.floor(b.t / grp)) { cur.push(b); return }
    if (cur.length) groups.push(cur)
    cur = ok ? [b] : []
  })
  if (cur.length) groups.push(cur)

  groups.forEach(g => {
    if (g.length === 1) {
      const x = X(g[0].t)
      for (let i = 0; i < beams(g[0].dur); i++) els.push(<path key={k()} className="rh" d={`M${x} ${bot - i * 5} q6 -2 7 -9`} />)
    } else {
      const xs = g.map(b => X(b.t)), bm = g.map(b => beams(b.dur))
      els.push(<rect key={k()} className="rhf" x={xs[0]} y={bot - 3} width={xs[xs.length - 1] - xs[0]} height={3} />)
      for (let L = 2; L <= Math.max(...bm); L++) {
        const yy = bot - 3 - (L - 1) * 5
        for (let i = 0; i < g.length; i++) {
          if (bm[i] < L) continue
          if (i + 1 < g.length && bm[i + 1] >= L) els.push(<rect key={k()} className="rhf" x={xs[i]} y={yy} width={xs[i + 1] - xs[i]} height={3} />)
          else if (!(i > 0 && bm[i - 1] >= L)) {
            const dx = i + 1 < g.length ? 7 : -7
            els.push(<rect key={k()} className="rhf" x={Math.min(xs[i], xs[i] + dx)} y={yy} width={7} height={3} />)
          }
        }
      }
    }
    const tup = g[0].tup
    if (tup && g.every(b => b.tup === tup)) {
      els.push(<text key={k()} className="rht" x={(X(g[0].t) + X(g[g.length - 1].t)) / 2} y={bot + 12}>{tup}</text>)
    }
  })
  notesB.filter(b => b.tup && b.dur < 8).forEach(b => els.push(<text key={k()} className="rht" x={X(b.t)} y={bot + 12}>{b.tup}</text>))

  return <g>{els}</g>
}
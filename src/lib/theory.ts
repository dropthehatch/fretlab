// Music theory: scales, chords, scale positions, sweep and triad shapes, key detection.
// All pitches are MIDI numbers. Strings are indexed 0 = lowest (low E) upward.

export const TUNING = [40, 45, 50, 55, 59, 64]
export const SNAME = ['E', 'A', 'D', 'G', 'B', 'e']
export const FRETS = 21

export const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
export const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']
export const KEYNAMES = ['C', 'C♯ / D♭', 'D', 'E♭ / D♯', 'E', 'F', 'F♯ / G♭', 'G', 'A♭ / G♯', 'A', 'B♭ / A♯', 'B']
export const INT = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7']
export const ROLE = ['r', 't3', 't5', 't7']
export const ROLENAME = ['Root', '3rd', '5th', '7th']
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

export const mod = (n: number, m: number) => ((n % m) + m) % m

export type ScaleKey =
  | 'ionian' | 'aeolian' | 'harmonic' | 'dorian' | 'phrygian'
  | 'lydian' | 'mixolydian' | 'pentMinor' | 'pentMajor' | 'blues'

export interface ScaleDef { name: string; iv: number[]; rel: number; minor: boolean }

export const SCALES: Record<ScaleKey, ScaleDef> = {
  ionian: { name: 'Major (Ionian)', iv: [0, 2, 4, 5, 7, 9, 11], rel: 0, minor: false },
  aeolian: { name: 'Natural minor (Aeolian)', iv: [0, 2, 3, 5, 7, 8, 10], rel: 3, minor: true },
  harmonic: { name: 'Harmonic minor', iv: [0, 2, 3, 5, 7, 8, 11], rel: 3, minor: true },
  dorian: { name: 'Dorian', iv: [0, 2, 3, 5, 7, 9, 10], rel: 10, minor: true },
  phrygian: { name: 'Phrygian', iv: [0, 1, 3, 5, 7, 8, 10], rel: 8, minor: true },
  lydian: { name: 'Lydian', iv: [0, 2, 4, 6, 7, 9, 11], rel: 7, minor: false },
  mixolydian: { name: 'Mixolydian', iv: [0, 2, 4, 5, 7, 9, 10], rel: 5, minor: false },
  pentMinor: { name: 'Minor pentatonic', iv: [0, 3, 5, 7, 10], rel: 3, minor: true },
  pentMajor: { name: 'Major pentatonic', iv: [0, 2, 4, 7, 9], rel: 0, minor: false },
  blues: { name: 'Blues', iv: [0, 3, 5, 6, 7, 10], rel: 3, minor: true },
}

/** Keys whose relative major is F, B♭, E♭, A♭ or D♭ are spelled with flats. */
export const usesFlats = (root: number, minor: boolean) => [5, 10, 3, 8, 1].includes(mod(root + (minor ? 3 : 0), 12))
export const scaleUsesFlats = (root: number, scale: ScaleKey) => usesFlats(root + SCALES[scale].rel, false)
export const namer = (flats: boolean) => (pc: number) => (flats ? FLAT : SHARP)[mod(pc, 12)]

export interface FNote { s: number; f: number; p: number }
export interface Chord { rootPc: number; iv: number[]; name: string; roman: string }
export interface Position { d: number; notes: FNote[]; lo: number; hi: number }
export interface Shape {
  kind: 'sweep' | 'triad' | 'grip'
  notes: (FNote & { o?: number })[]
  ext: (FNote & { o?: number })[]
  lo: number; hi: number; bass: number
  /** Full chords: which CAGED shape this grip comes from, e.g. "E shape". */
  name?: string
}
export interface SeqNote extends FNote { st?: string }

export function chordSuffix(iv: number[]) {
  const map: Record<string, string> = {
    '4,7': '', '3,7': 'm', '3,6': 'dim', '4,8': 'aug', '4,7,11': 'maj7', '3,7,10': 'm7', '4,7,10': '7',
    '3,6,10': 'm7♭5', '3,6,9': 'dim7', '3,7,11': 'm(maj7)', '4,8,11': 'maj7♯5',
  }
  return map[iv.slice(1).join(',')] ?? '?'
}

function romanFor(i: number, iv: number[]) {
  let r = ROMAN[i]
  if (iv[1] === 3) r = r.toLowerCase()
  if (iv.length === 3) return r + (iv[2] === 6 ? '°' : iv[2] === 8 ? '+' : '')
  const map: Record<string, string> = { '4,7,11': 'maj7', '3,7,10': '7', '4,7,10': '7', '3,6,10': 'ø7', '3,6,9': '°7', '3,7,11': '(maj7)', '4,8,11': '+maj7' }
  return r + (map[iv.slice(1).join(',')] || '7')
}

/** Diatonic chords of the scale (triads or 7ths). Pentatonic/blues scales only offer the tonic chord. */
export function buildChords(root: number, scale: ScaleKey, seventh: boolean): Chord[] {
  const sc = SCALES[scale], iv = sc.iv, nm = namer(scaleUsesFlats(root, scale))
  if (iv.length === 7) {
    return iv.map((_, i) => {
      const idx = seventh ? [0, 2, 4, 6] : [0, 2, 4]
      const civ = idx.map(j => { const k = i + j; return iv[k % 7] + 12 * Math.floor(k / 7) - iv[i] })
      const rp = mod(root + iv[i], 12)
      return { rootPc: rp, iv: civ, name: nm(rp) + chordSuffix(civ), roman: romanFor(i, civ) }
    })
  }
  let civ = sc.minor ? [0, 3, 7] : [0, 4, 7]
  if (seventh && sc.minor) civ = [0, 3, 7, 10]
  return [{ rootPc: mod(root, 12), iv: civ, name: nm(root) + chordSuffix(civ), roman: sc.minor ? 'i' + (civ.length > 3 ? '7' : '') : 'I' }]
}

/** One box shape per scale degree: three notes per string for 7-note scales, two for pentatonics. */
export function buildPositions(root: number, scale: ScaleKey): Position[] {
  const iv = SCALES[scale].iv, N = iv.length, per = N === 7 ? 3 : 2, out: Position[] = []
  for (let d = 0; d < N; d++) {
    const pc = mod(root + iv[d], 12)
    let p = 40 + mod(pc - 4, 12), deg = d
    const pitches: number[] = []
    for (let k = 0; k < 6 * per; k++) {
      pitches.push(p)
      const nx = deg + 1
      p += (nx < N ? iv[nx] : iv[0] + 12) - iv[deg]
      deg = nx % N
    }
    let notes: FNote[] = []
    for (let s = 0; s < 6; s++) for (let k = 0; k < per; k++) {
      const pp = pitches[s * per + k]
      notes.push({ s, f: pp - TUNING[s], p: pp })
    }
    if (Math.min(...notes.map(n => n.f)) < 0) notes = notes.map(n => ({ ...n, f: n.f + 12, p: n.p + 12 }))
    notes = notes.filter(n => n.f <= FRETS)
    const fs = notes.map(n => n.f)
    out.push({ d, notes, lo: Math.min(...fs), hi: Math.max(...fs) })
  }
  return out.sort((a, b) => a.lo - b.lo)
}

export const roleIn = (chord: Chord, pc: number) => chord.iv.indexOf(mod(pc - chord.rootPc, 12))
export const chordPcs = (chord: Chord) => chord.iv.map(x => mod(chord.rootPc + x, 12))

/** Position of a pitch in the chord's stacked arpeggio (root=0, 3rd=1, 5th=2, root an octave up=3 …). */
function ordOf(chord: Chord, p: number) {
  const rel = p - chord.rootPc, oct = Math.floor(rel / 12)
  return oct * chord.iv.length + chord.iv.indexOf(rel - 12 * oct)
}

/** Every playable sweep: one chord tone per string, ascending through the arpeggio, within a 5-fret span. */
export function sweeps(chord: Chord, nStrings: number): Shape[] {
  const strings = Array.from({ length: nStrings }, (_, i) => 6 - nStrings + i)
  const pcs = chordPcs(chord), out: Shape[] = []
  const dfs = (i: number, acc: (FNote & { o: number })[], skips: number) => {
    if (i === strings.length) {
      const top = acc[acc.length - 1], ext: (FNote & { o: number })[] = []
      for (let f = top.f + 1; f <= Math.min(FRETS, top.f + 5); f++) {
        const p = TUNING[5] + f
        if (pcs.includes(mod(p, 12)) && ordOf(chord, p) === top.o + 1) { ext.push({ s: 5, f, p, o: top.o + 1 }); break }
      }
      const fs = acc.map(a => a.f)
      out.push({ kind: 'sweep', notes: acc, ext, lo: Math.min(...fs), hi: Math.max(...fs), bass: roleIn(chord, acc[0].p) })
      return
    }
    const s = strings[i]
    for (let f = 0; f <= FRETS; f++) {
      const p = TUNING[s] + f
      if (!pcs.includes(mod(p, 12))) continue
      const o = ordOf(chord, p), note = { s, f, p, o }
      if (!acc.length) { dfs(i + 1, [note], 0); continue }
      const st = o - acc[acc.length - 1].o
      if (st < 1 || st > 2) continue
      const ns = skips + (st === 2 ? 1 : 0)
      if (ns > 1) continue
      const fs = acc.map(a => a.f).concat(f)
      if (Math.max(...fs) - Math.min(...fs) > 4) continue
      dfs(i + 1, acc.concat(note), ns)
    }
  }
  dfs(0, [], 0)
  return out
}

/** Close-voiced triads on three adjacent strings starting at `set` (0 = E A D). */
/*
 * Full chord grips from the CAGED system: the five open-chord shapes (C, A, G, E, D) moved up the neck.
 * Each template is the major shape as fret offsets from its root (low E → high e; null = not played).
 * For minor and diminished chords the 3rd and 5th are lowered to match, and a string is dropped
 * if that would need a fret below zero, which is how the minor versions are usually played.
 */
const CAGED: { name: string; rootString: number; offs: (number | null)[] }[] = [
  { name: 'E shape', rootString: 0, offs: [0, 2, 2, 1, 0, 0] },
  { name: 'D shape', rootString: 2, offs: [null, null, 0, 2, 3, 2] },
  { name: 'C shape', rootString: 1, offs: [null, 0, -1, -3, -2, -3] },
  { name: 'A shape', rootString: 1, offs: [null, 0, 2, 2, 2, 0] },
  { name: 'G shape', rootString: 0, offs: [0, -1, -3, -3, -3, 0] },
]

export function grips(chord: Chord): Shape[] {
  const third = mod(chord.iv[1], 12), fifth = mod(chord.iv[2], 12), out: Shape[] = [], seen = new Set<string>()
  for (const t of CAGED) {
    const first = mod(chord.rootPc - TUNING[t.rootString], 12)
    for (const r of [first, first + 12]) {
      const notes: FNote[] = []
      let offNeck = false
      t.offs.forEach((off, s) => {
        if (off == null) return
        let f = r + off
        const majorIv = mod(TUNING[s] + f - chord.rootPc, 12)
        if (majorIv === 4) f += third - 4      // move the 3rd for minor / diminished
        else if (majorIv === 7) f += fifth - 7 // move the 5th for diminished / augmented
        if (f > FRETS) { offNeck = true; return }
        if (f < 0) return // the lowered note would sit behind the nut: leave that string out
        notes.push({ s, f, p: TUNING[s] + f })
      })
      if (offNeck || notes.length < 3 || !notes.some(n => n.s === t.rootString)) continue
      const fretted = notes.filter(n => n.f > 0).map(n => n.f)
      if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > 4) continue
      const key = notes.map(n => `${n.s}:${n.f}`).join(',')
      if (seen.has(key)) continue
      seen.add(key)
      const fs = notes.map(n => n.f)
      out.push({ kind: 'grip', name: t.name, notes, ext: [], lo: Math.min(...fs), hi: Math.max(...fs), bass: roleIn(chord, notes[0].p) })
    }
  }
  return out.sort((a, b) => a.lo - b.lo)
}

export function triads(chord: Chord, set: number): Shape[] {
  const ss = [set, set + 1, set + 2], pcs = chordPcs(chord).slice(0, 3), out: Shape[] = []
  const opts = ss.map(s => {
    const r: FNote[] = []
    for (let f = 0; f <= FRETS; f++) { const p = TUNING[s] + f; if (pcs.includes(mod(p, 12))) r.push({ s, f, p }) }
    return r
  })
  for (const x of opts[0]) for (const y of opts[1]) for (const z of opts[2]) {
    if (!(x.p < y.p && y.p < z.p && z.p - x.p < 12)) continue
    if (new Set([x, y, z].map(n => mod(n.p, 12))).size < 3) continue
    const fs = [x.f, y.f, z.f]
    if (Math.max(...fs) - Math.min(...fs) > 4) continue
    out.push({ kind: 'triad', notes: [x, y, z], ext: [], lo: Math.min(...fs), hi: Math.max(...fs), bass: roleIn(chord, x.p) })
  }
  return out
}

/** Picking order for a sweep: down through the strings, hammer/pull on top, back up. */
export function sweepSeq(sh: Shape): SeqNote[] {
  const up = sh.notes.map(n => ({ ...n, st: '↓' }))
  const top = sh.notes[sh.notes.length - 1]
  const ext = sh.ext.map(n => ({ ...n, st: 'h' }))
  const back = sh.ext.length ? [{ ...top, st: 'p' }] : []
  const down = sh.notes.slice(0, -1).reverse().map(n => ({ ...n, st: '↑' }))
  return [...up, ...ext, ...back, ...down]
}

/** String names low to high. Black-key tunings (E♭ standard, drop C♯…) are spelled with flats. */
export function stringNames(tuning: number[]) {
  const names = tuning.some(p => [1, 3, 6, 8, 10].includes(mod(p, 12))) ? FLAT : SHARP
  return tuning.map((p, i) => {
    let x = names[mod(p, 12)]
    if (i === tuning.length - 1 && i > 0 && mod(p, 12) === mod(tuning[0], 12)) x = x.toLowerCase()
    return x
  })
}

/* ---------- key detection (Krumhansl–Schmuckler) ---------- */
const KMAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const KMIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

export interface Key { root: number; minor: boolean; score: number }

function corr(a: number[], b: number[]) {
  const ma = a.reduce((x, y) => x + y) / 12, mb = b.reduce((x, y) => x + y) / 12
  let n = 0, da = 0, db = 0
  for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2 }
  return da && db ? n / Math.sqrt(da * db) : 0
}

/** Rank all 24 major/minor keys against a 12-bin pitch-class histogram. */
export function rankKeys(hist: number[]): Key[] {
  const r: Key[] = []
  for (let k = 0; k < 12; k++) {
    const hv = Array.from({ length: 12 }, (_, i) => hist[mod(i + k, 12)])
    r.push({ root: k, minor: false, score: corr(hv, KMAJ) }, { root: k, minor: true, score: corr(hv, KMIN) })
  }
  return r.sort((a, b) => b.score - a.score)
}

export const keyName = (k: { root: number; minor: boolean }) => (usesFlats(k.root, k.minor) ? FLAT : SHARP)[k.root] + (k.minor ? ' minor' : ' major')
export const keyScale = (k: { minor: boolean }): ScaleKey => (k.minor ? 'aeolian' : 'ionian')

export type KeyRole = 'r' | 't3' | 't5' | 'tone' | 'out'
/** Role of a pitch class relative to a key: tonic triad tones, other scale tones, or outside the key. */
export function keyRole(pc: number, key: { root: number; minor: boolean }): KeyRole {
  const i = mod(pc - key.root, 12), iv = SCALES[keyScale(key)].iv
  if (i === 0) return 'r'
  if (i === (key.minor ? 3 : 4)) return 't3'
  if (i === 7) return 't5'
  return iv.includes(i) ? 'tone' : 'out'
}
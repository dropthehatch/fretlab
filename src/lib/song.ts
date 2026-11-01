// Song model, the built-in example riff, and Guitar Pro import (via alphaTab, loaded on demand).
import { TUNING, mod, rankKeys, type Key } from './theory'

export interface Note { bar: number; t: number; s: number; f: number; p: number; w: number; tie?: boolean; tech?: string }
export interface Beat { bar: number; t: number; dur: number; dots: number; tup: number; rest: boolean }
export interface Track { name: string; tuning: number[]; perc: boolean; notes: Note[]; beats: Beat[] }
export interface BarMeta { num: number; start: number; len: number; tsN: number; tsD: number; section: string }
export interface Song { title: string; artist: string; example: boolean; tempo: number; bars: BarMeta[]; tracks: Track[] }
export interface BarGroup { name: string; from: number; to: number }

/** Ticks per quarter note, matching alphaTab's MIDI resolution. */
export const QUARTER = 960

/** Guitar and bass tracks with notes. Drums and vocal/no-tab tracks are hidden. */
export const isPlayable = (t: Track) => !t.perc && t.tuning.length > 0 && t.notes.length > 0

/* ---------- example riff ---------- */
const TICKS: Record<string, number> = { 1: 3840, 2: 1920, 4: 960, 8: 480, 16: 240, 32: 120 }

export function makeSample(): Song {
  const tuning = TUNING.slice(), nb = 8
  const bars: BarMeta[] = Array.from({ length: nb }, (_, i) => ({
    num: i + 1, start: i * 3840, len: 3840, tsN: 4, tsD: 4, section: i === 0 ? 'Verse' : i === 4 ? 'Solo' : '',
  }))
  // Tokens: ":8" sets the duration, "fret@string" (string 1 = high e), "+" stacks a chord, "r" is a rest.
  const track = (name: string, barStrs: string[]): Track => {
    const notes: Note[] = [], beats: Beat[] = []
    barStrs.forEach((str, bar) => {
      let d = 960, t = 0
      str.trim().split(/\s+/).forEach(tok => {
        if (tok[0] === ':') { d = TICKS[tok.slice(1)]; return }
        beats.push({ bar, t, dur: 3840 / d, dots: 0, tup: 0, rest: tok === 'r' })
        if (tok !== 'r') tok.split('+').forEach(x => {
          const [f, n] = x.split('@').map(Number), s = tuning.length - n
          notes.push({ bar, t, s, f, p: tuning[s] + f, w: d })
        })
        t += d
      })
    })
    return { name, tuning, perc: false, notes, beats }
  }
  const rep = (c: string, n: number) => Array(n).fill(c).join(' ')
  const rhythm = ['2@5+4@4+4@3', '3@6+5@5+5@4', '7@5+9@4+9@3', '2@6+4@5+4@4'].map(c => ':8 ' + rep(c, 8))
  return {
    title: 'Practice riff in B minor', artist: '', example: true, tempo: 100, bars,
    tracks: [
      track('Lead', [
        ':8 7@3 9@3 7@2 10@2 9@3 7@3 9@4 7@3',
        ':8 10@2 7@2 8@2 7@2 9@3 7@3 9@3 r',
        ':8 7@1 10@1 9@1 7@1 10@2 7@2 9@3 7@3',
        ':8 9@3 11@3 9@3 7@3 :4 9@4 r',
        ':16 14@5 12@4 11@3 12@2 10@1 14@1 10@1 12@2 11@3 12@4 14@5',
        ':16 10@5 9@4 7@3 8@2 7@1 10@1 7@1 8@2 7@3 9@4 10@5',
        ':16 7@5 5@4 4@3 5@2 3@1 7@1 3@1 5@2 4@3 5@4 7@5',
        ':16 9@5 8@4 6@3 7@2 6@1 9@1 6@1 7@2 6@3 8@4 9@5',
      ]),
      track('Rhythm', rhythm.concat(rhythm)),
    ],
  }
}

/* ---------- Guitar Pro import ---------- */
/* eslint-disable @typescript-eslint/no-explicit-any */
function parseScore(score: any, fileName: string): Song {
  const bars: BarMeta[] = score.masterBars.map((mb: any, i: number) => {
    let len = typeof mb.calculateDuration === 'function' ? mb.calculateDuration() : 0
    if (!(len > 0)) len = 3840 * (mb.timeSignatureNumerator || 4) / (mb.timeSignatureDenominator || 4)
    return {
      num: i + 1, start: mb.start || 0, len,
      tsN: mb.timeSignatureNumerator || 4, tsD: mb.timeSignatureDenominator || 4,
      section: mb.section ? (mb.section.text || mb.section.marker || '') : '',
    }
  })
  const tracks: Track[] = score.tracks.map((tr: any) => {
    const st = tr.staves[0]
    const tuning: number[] = (st.tuning || []).slice().reverse() // alphaTab lists strings high → low
    const perc = !!st.isPercussion, notes: Note[] = [], beats: Beat[] = []
    if (!perc && tuning.length) {
      st.bars.forEach((bar: any, bi: number) => bar.voices.forEach((v: any) => v.beats.forEach((b: any) => {
        if (b.graceType > 0) return
        if (v === bar.voices[0]) beats.push({
          bar: bi, t: b.playbackStart || 0, dur: b.duration, dots: b.dots || 0,
          tup: b.tupletNumerator > 1 ? b.tupletNumerator : 0, rest: !!b.isRest,
        })
        if (b.isRest) return
        const w = b.playbackDuration || QUARTER
        b.notes.forEach((n: any) => {
          if (n.isDead) return
          const s = n.string - 1 // alphaTab string 1 = lowest
          if (s < 0 || s >= tuning.length || typeof n.realValue !== 'number') return
          let tech = ''
          if (n.isHammerPullOrigin) tech += n.hammerPullDestination && n.hammerPullDestination.fret < n.fret ? 'p' : 'h'
          if (n.hasBend) tech += 'b'
          if (n.slideOutType > 0) tech += '/'
          if (n.vibrato > 0) tech += '~'
          notes.push({ bar: bi, t: b.playbackStart || 0, s, f: n.fret, p: n.realValue, w, tie: !!n.isTieDestination, tech })
        })
      })))
    }
    return { name: tr.name || 'Track', tuning, perc, notes, beats }
  })
  return {
    title: score.title || fileName.replace(/\.[^.]+$/, ''), artist: score.artist || '',
    example: false, tempo: score.tempo || 120, bars, tracks,
  }
}

export async function loadGuitarPro(file: File): Promise<Song> {
  const alphaTab: any = await import('@coderline/alphatab')
  const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(await file.arrayBuffer()), new alphaTab.Settings())
  const song = parseScore(score, file.name)
  if (!song.tracks.some(isPlayable)) throw new Error('No guitar or bass tracks with notes were found in that file.')
  return song
}

/* ---------- sections and analysis ---------- */
export function sectionsOf(song: Song): BarGroup[] {
  const out: BarGroup[] = []
  song.bars.forEach((b, i) => { if (b.section) out.push({ name: b.section, from: i, to: 0 }) })
  out.forEach((s, i) => { s.to = (i + 1 < out.length ? out[i + 1].from : song.bars.length) - 1 })
  return out
}

/** Rows for the bar grid: one per section, or blocks of 16 bars when the tab has no section markers. */
export function barGroups(song: Song): BarGroup[] {
  const secs = sectionsOf(song)
  if (!secs.length) {
    const out: BarGroup[] = []
    for (let i = 0; i < song.bars.length; i += 16) out.push({ name: '', from: i, to: Math.min(song.bars.length, i + 16) - 1 })
    return out
  }
  return secs[0].from > 0 ? [{ name: 'Start', from: 0, to: secs[0].from - 1 }, ...secs] : secs
}

export interface Analysis { notes: Note[]; hist: number[]; total: number; rank: Key[] }

/** Notes in the bar range (ties excluded), a duration-weighted pitch-class histogram, and the top 3 keys. */
export function analyzeRange(track: Track, from: number, to: number): Analysis {
  const notes = track.notes.filter(n => n.bar >= from && n.bar <= to && !n.tie)
  const hist = Array(12).fill(0)
  notes.forEach(n => { hist[mod(n.p, 12)] += n.w })
  const total = notes.reduce((a, n) => a + n.w, 0)
  return { notes, hist, total, rank: notes.length ? rankKeys(hist).slice(0, 3) : [] }
}

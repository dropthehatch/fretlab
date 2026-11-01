import { useMemo } from 'react'
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react'
import {
  FRETS, INT, KEYNAMES, ROLE, ROLENAME, SCALES, SNAME, TUNING,
  buildChords, buildPositions, chordPcs, mod, namer, roleIn, scaleUsesFlats, sweepSeq, sweeps, triads,
  type Chord, type FNote, type ScaleKey, type Shape,
} from '@/lib/theory'
import { Fretboard, type BoardItem } from '@/components/Fretboard'
import { SeqStaff } from '@/components/SeqStaff'
import { Choice, Field, LegendDot, NoteChip, Panel } from '@/components/ui'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

export type ShapeView = 'arp' | 'triad' | 'sweep'
export type ExView = 'scale' | ShapeView | 'prog'
export interface ExplorerState {
  root: number; scale: ScaleKey; seventh: boolean; view: ExView
  /** The single chord (scale degree) shown in Scale, Arpeggio, Triads and Sweeps. */
  chordDeg: number
  /** Progression view: chords as scale degrees, in the order they were picked. */
  chords: number[]
  /** Progression view: which chord is in focus (full color). */
  active: number
  /** Progression view: draw each chord as chord tones, a triad, or a sweep. */
  progShape: ShapeView
  pos: number; sweepN: number; triSet: number
  shapeIdx: number | null // null = pick a sensible default shape
  /** Fret to stay near when stepping through a progression, so shapes don't jump around the neck. */
  anchor: number | null
  labels: 'notes' | 'int'
}

export const initialExplorer: ExplorerState = {
  root: 11, scale: 'aeolian', seventh: false, view: 'sweep', chordDeg: 0,
  chords: defaultProgression('aeolian'), active: 0, progShape: 'sweep',
  pos: -1, sweepN: 5, triSet: 2, shapeIdx: null, anchor: null, labels: 'notes',
}

/** A common starting progression: i–VI–III–VII in minor keys, I–V–vi–IV in major ones. */
export function defaultProgression(scale: ScaleKey) {
  const sc = SCALES[scale]
  return sc.iv.length !== 7 ? [0] : sc.minor ? [0, 5, 2, 6] : [0, 4, 5, 3]
}

const VIEWS: { value: ExView; label: string }[] = [
  { value: 'scale', label: 'Scale' }, { value: 'arp', label: 'Arpeggio' }, { value: 'triad', label: 'Triads' },
  { value: 'sweep', label: 'Sweeps' }, { value: 'prog', label: 'Progression' },
]

const ROLE_COLORS = ['var(--c-r)', 'var(--c-3)', 'var(--c-5)', 'var(--c-7)']
/** Opacity for the current chord, the next one, and the ones after it. */
const PROG_OPACITY = [1, 0.6, 0.42, 0.3, 0.22]

export function Explorer({ st, set }: { st: ExplorerState; set: (patch: Partial<ExplorerState>) => void }) {
  // Changing anything other than the shape stepper resets to the default shape.
  const change = (patch: Partial<ExplorerState>) => set({ shapeIdx: null, anchor: null, ...patch })

  const d = useMemo(() => {
    const sc = SCALES[st.scale]
    const nm = namer(scaleUsesFlats(st.root, st.scale))
    const chords = buildChords(st.root, st.scale, st.seventh)
    const prog = st.chords.filter(c => c < chords.length)
    if (!prog.length) prog.push(0)
    const active = Math.min(st.active, prog.length - 1)
    const inProg = st.view === 'prog'
    /** What gets drawn for each chord: chord tones, triads or sweeps (Scale view counts as chord tones here). */
    const sv: ShapeView | 'scale' = inProg ? st.progShape : (st.view as ShapeView | 'scale')
    const chord = inProg ? chords[prog[active]] : chords[Math.min(st.chordDeg, chords.length - 1)]
    const next = inProg && prog.length > 1 ? chords[prog[(active + 1) % prog.length]] : null
    const nextPcs = next ? chordPcs(next) : []
    const pcs = chordPcs(chord)
    const role = (p: number) => roleIn(chord, p)
    const intOf = (p: number) => INT[mod(p - chord.rootPc, 12)]
    const positions = buildPositions(st.root, st.scale)
    const posObj = st.pos >= 0 && st.pos < positions.length ? positions[st.pos] : null
    // All sweep/triad shapes for a chord, limited to the chosen scale position.
    const shapesFor = (c: Chord) => {
      let list = sv === 'sweep' ? sweeps(c, st.sweepN) : sv === 'triad' ? triads(c, st.triSet) : []
      if (posObj) list = list.filter(sh => sh.notes.every(n => n.f >= posObj.lo - 1 && n.f <= posObj.hi + 1))
      return list.sort((a, b) => a.lo - b.lo || a.bass - b.bass)
    }
    // The shape closest to a fret, preferring root-position shapes on a tie.
    const nearest = (list: Shape[], fret: number) => {
      const dist = (sh: Shape) => Math.abs((sh.lo + sh.hi) / 2 - fret) + (sh.bass === 0 ? 0 : 0.5)
      return list.reduce((b, sh, i) => (dist(sh) < dist(list[b]) ? i : b), 0)
    }
    const shapes = shapesFor(chord)
    let idx = st.shapeIdx ?? -1
    if (idx < 0 && st.anchor != null && shapes.length) idx = nearest(shapes, st.anchor) // stepping through a progression
    if (idx < 0) idx = Math.max(0, shapes.findIndex(s => s.bass === 0 && s.lo >= 5))
    if (idx >= shapes.length) idx = 0
    const shape = shapes[idx] ?? null

    // Progression overview: every chord in the progression, in the same area of the neck as the current shape.
    const center = shape ? (shape.lo + shape.hi) / 2 : posObj ? (posObj.lo + posObj.hi) / 2 : null
    const overview = prog.map((deg, k) => {
      const c = chords[deg], step = mod(k - active, prog.length)
      let sh: Shape | null = null
      if (k === active) sh = shape
      else if (sv === 'sweep' || sv === 'triad') {
        const list = shapesFor(c)
        sh = list.length ? list[center == null ? Math.max(0, list.findIndex(s => s.bass === 0 && s.lo >= 5)) : nearest(list, center)] : null
      }
      return { chord: c, step, shape: sh, opacity: PROG_OPACITY[Math.min(step, PROG_OPACITY.length - 1)] }
    })
    return { sc, nm, chords, prog, active, inProg, sv, chord, next, nextPcs, pcs, role, intOf, positions, posObj, shapes, idx, shape, overview }
  }, [st])

  const { sc, nm, chords, prog, active, inProg, sv, chord, next, nextPcs, pcs, role, intOf, positions, posObj, shapes, idx, shape, overview } = d
  const progressionMode = inProg && prog.length > 1

  /** Move to another chord in the progression, staying near the current shape on the neck. */
  const goTo = (i: number) => {
    const here = shape ? (shape.lo + shape.hi) / 2 : posObj ? (posObj.lo + posObj.hi) / 2 : null
    set({ active: mod(i, prog.length), shapeIdx: null, anchor: here })
  }
  const isShapeView = sv === 'sweep' || sv === 'triad'

  const items: BoardItem[] = useMemo(() => {
    const all = (want: number[]) => {
      const r: FNote[] = []
      for (let s = 0; s < 6; s++) for (let f = 0; f <= FRETS; f++) { const p = TUNING[s] + f; if (want.includes(mod(p, 12))) r.push({ s, f, p }) }
      return r
    }
    type It = FNote & { faint?: boolean; sel?: boolean; ext?: boolean; order?: number }

    if (progressionMode) {
      // Only the progression's chords: current chord in full color, later chords fading out.
      // Where two chords land on the same fret, the one closest in the progression wins.
      const byKey = new Map<string, BoardItem & { step: number }>()
      overview.forEach(o => {
        const cPcs = chordPcs(o.chord)
        const notes: It[] = o.shape
          ? [...o.shape.notes.map((n, i) => ({ ...n, sel: o.step === 0, order: o.step === 0 && sv === 'sweep' ? i + 1 : 0 })),
             ...o.shape.ext.map(n => ({ ...n, sel: o.step === 0, ext: true, order: o.step === 0 ? o.shape!.notes.length + 1 : 0 }))]
          : sv === 'arp' ? (posObj ? posObj.notes.filter(n => cPcs.includes(mod(n.p, 12))) : all(cPcs)) : []
        notes.forEach(n => {
          const k = `${n.s}-${n.f}`, prev = byKey.get(k)
          if (prev && prev.step <= o.step) return
          const pc = mod(n.p, 12), r = roleIn(o.chord, pc)
          byKey.set(k, {
            s: n.s, f: n.f, order: n.order, step: o.step, opacity: o.opacity,
            badge: o.step === 0 && nextPcs.includes(pc),
            label: st.labels === 'notes' ? nm(pc) : INT[mod(pc - o.chord.rootPc, 12)],
            title: `${o.chord.name}: ${nm(pc)} (${INT[mod(pc - o.chord.rootPc, 12)]})`,
            cls: [r >= 0 ? ROLE[r] : 'tone', n.sel && 'sel', n.ext && 'ext'].filter(Boolean).join(' '),
          })
        })
      })
      // Draw the faintest first so the current chord sits on top.
      return [...byKey.values()].sort((a, b) => b.step - a.step)
    }

    let list: It[] = []
    if (sv === 'scale') list = posObj ? posObj.notes : all(sc.iv.map(x => mod(st.root + x, 12)))
    else if (sv === 'arp') list = posObj ? posObj.notes.filter(n => pcs.includes(mod(n.p, 12))) : all(pcs)
    else {
      const sel = new Map<string, It>()
      if (shape) {
        shape.notes.forEach((n, i) => sel.set(`${n.s}-${n.f}`, { ...n, sel: true, order: sv === 'sweep' ? i + 1 : 0 }))
        shape.ext.forEach(n => sel.set(`${n.s}-${n.f}`, { ...n, sel: true, ext: true, order: shape.notes.length + 1 }))
      }
      const lo = posObj ? posObj.lo - 1 : 0, hi = posObj ? posObj.hi + 1 : FRETS
      all(pcs).forEach(n => { if (!sel.has(`${n.s}-${n.f}`) && n.f >= lo && n.f <= hi) list.push({ ...n, faint: true }) })
      list = list.concat([...sel.values()])
    }
    return list.map(n => {
      const pc = mod(n.p, 12), r = role(pc)
      return {
        s: n.s, f: n.f, order: n.order,
        badge: !n.faint && nextPcs.includes(pc),
        label: st.labels === 'notes' ? nm(pc) : intOf(pc),
        cls: [r >= 0 ? ROLE[r] : 'tone', n.faint && 'faint', n.sel && 'sel', n.ext && 'ext'].filter(Boolean).join(' '),
      }
    })
  }, [sv, st.labels, st.root, posObj, sc, pcs, nextPcs, shape, role, nm, intOf, progressionMode, overview])

  const focusRange = progressionMode && isShapeView && overview.some(o => o.shape)
    ? { lo: Math.min(...overview.flatMap(o => (o.shape ? [o.shape.lo] : []))), hi: Math.max(...overview.flatMap(o => (o.shape ? [o.shape.hi] : []))) }
    : isShapeView && shape ? shape : posObj
  const roleClass = (p: number) => { const r = role(p); return r >= 0 ? ROLE[r] : 'tone' }
  const noteTitle = (n: FNote) => `${nm(n.p)} (${intOf(n.p)}) · ${SNAME[n.s]} string, fret ${n.f}`

  return (
    <div className="flex flex-col gap-[18px]">
      <section aria-label="Key and view" className="grid grid-cols-2 items-end gap-x-[18px] gap-y-4 md:grid-cols-[auto_minmax(0,1fr)_auto]">
        <Field label="Key">
          <Select value={String(st.root)} onValueChange={v => change({ root: +v })}>
            <SelectTrigger className="w-full min-w-28 bg-card" aria-label="Key"><SelectValue /></SelectTrigger>
            <SelectContent>{KEYNAMES.map((k, i) => <SelectItem key={k} value={String(i)}>{k}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Scale">
          <Select value={st.scale} onValueChange={v => change({ scale: v as ScaleKey, chordDeg: 0, chords: defaultProgression(v as ScaleKey), active: 0, pos: -1 })}>
            <SelectTrigger className="w-full bg-card" aria-label="Scale"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(SCALES) as ScaleKey[]).map(k => <SelectItem key={k} value={k}>{SCALES[k].name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Dot labels" className="col-span-2 md:col-span-1">
          <Choice label="Dot labels" value={st.labels} onChange={v => set({ labels: v })}
            options={[{ value: 'notes', label: 'Notes' }, { value: 'int', label: 'Intervals' }]} />
        </Field>

        <div className="col-span-full grid grid-cols-1 items-end gap-x-6 gap-y-4 lg:grid-cols-[auto_minmax(0,1fr)]">
          <Field label="Show">
            <div className="hidden sm:block">
              <Choice label="Show" value={st.view} onChange={v => change({ view: v })}
                itemClassName="px-3 font-display text-[15px] font-bold tracking-[.03em] uppercase"
                options={VIEWS} />
            </div>
            <Select value={st.view} onValueChange={v => change({ view: v as ExView })}>
              <SelectTrigger className="w-full bg-card font-display text-base font-bold tracking-[.03em] uppercase sm:hidden" aria-label="Show"><SelectValue /></SelectTrigger>
              <SelectContent>{VIEWS.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>

          <Field label="Scale position (frets)">
            <Choice look="chips" size="sm" label="Scale position" itemClassName="px-2.5" value={st.pos < 0 ? -1 : st.pos} onChange={i => change({ pos: i })}
              options={[
                { value: -1, label: 'Whole neck' },
                ...positions.map((p, i) => ({
                  value: i, label: `${p.lo}–${p.hi}`, hint: i + 1,
                  title: `Position ${i + 1}: starts on ${nm(st.root + sc.iv[p.d])} on the low E`,
                })),
              ]} />
          </Field>
        </div>

        <Field label={inProg ? 'Chords · pick them in the order they are played' : 'Chord from this key'} className="col-span-full">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {inProg ? (
              <ToggleGroup type="multiple" variant="outline" spacing={2} aria-label="Chords" className="flex-wrap"
                value={prog.map(String)}
                onValueChange={v => {
                  if (!v.length) return // keep at least one chord
                  const nextProg = v.map(Number)
                  // Adding chords keeps the current chord in focus, so the first pick stays in full color.
                  const current = prog[active], keep = nextProg.indexOf(current)
                  change({ chords: nextProg, active: keep >= 0 ? keep : Math.min(active, nextProg.length - 1) })
                }}>
                {chords.map((c, i) => {
                  const at = prog.indexOf(i)
                  return (
                    <ToggleGroupItem key={c.roman + c.name} value={String(i)} aria-label={`${c.roman} ${c.name}`}
                      className={cn('group/choice rounded-full bg-card tabular-nums data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
                        at >= 0 && at !== active && prog.length > 1 && 'data-[state=on]:border-primary/50 data-[state=on]:bg-primary/15 data-[state=on]:text-foreground')}>
                      <small className="font-mono text-[11px] text-muted-foreground group-data-[state=on]/choice:text-current group-data-[state=on]/choice:opacity-80">{c.roman}</small>
                      {c.name}
                      {prog.length > 1 && at >= 0 && (
                        <span className="ml-0.5 grid size-4 place-items-center rounded-full bg-background/80 font-mono text-[10px] text-foreground">{at + 1}</span>
                      )}
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>
            ) : (
              <Choice look="chips" label="Chord" value={Math.min(st.chordDeg, chords.length - 1)} onChange={i => change({ chordDeg: i })}
                options={chords.map((c, i) => ({ value: i, label: c.name, hint: c.roman }))} />
            )}
            <div className="flex items-center gap-2">
              <Checkbox id="sev" checked={st.seventh} disabled={sc.iv.length !== 7 && !sc.minor}
                onCheckedChange={v => change({ seventh: v === true })} />
              <Label htmlFor="sev" className="font-normal text-muted-foreground">7th chords</Label>
            </div>
          </div>
        </Field>

        {inProg && (
          <div className="col-span-full flex flex-wrap items-end gap-x-6 gap-y-4">
            {prog.length > 1 ? (
              <Field label="Progression · step through it; the chord in focus is in full color">
                <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Previous chord" onClick={() => goTo(active - 1)}><ChevronLeftIcon /></Button>
              <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0">
                {prog.map((deg, i) => (
                  <li key={deg} className="flex items-center gap-1">
                    {i > 0 && <ArrowRightIcon className="size-3.5 text-muted-foreground" aria-hidden />}
                    <Button size="sm" variant={i === active ? 'default' : 'outline'} aria-current={i === active ? 'step' : undefined}
                      className={cn('rounded-full', i !== active && 'bg-card')} onClick={() => goTo(i)}>
                      {chords[deg].name} <small className="font-mono text-[10px] opacity-70">{chords[deg].roman}</small>
                    </Button>
                  </li>
                ))}
              </ol>
              <Button variant="outline" size="icon" aria-label="Next chord" onClick={() => goTo(active + 1)}><ChevronRightIcon /></Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => change({ chords: [prog[active]], active: 0 })}>
                <XIcon /> Clear
              </Button>
            </div>
              </Field>
            ) : (
              <p className="m-0 text-[13px] text-muted-foreground">
                {chords.length > 1 ? 'Pick two or more chords to see the progression on the neck.' : 'This scale has only one chord. Pick a 7-note scale to build a progression.'}
              </p>
            )}
            <Field label="Shapes">
              <Choice label="Progression shapes" value={st.progShape} onChange={v => change({ progShape: v })}
                options={[{ value: 'arp', label: 'Chord tones' }, { value: 'triad', label: 'Triads' }, { value: 'sweep', label: 'Sweeps' }]} />
            </Field>
          </div>
        )}

      </section>

      <Card aria-label="Fretboard" className="gap-0 overflow-hidden py-0">
        <Fretboard tuning={TUNING} items={items} band={posObj} scrollTo={focusRange} label="Guitar fretboard" />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-t px-4 py-3">
          <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px] text-muted-foreground">
            {chord.iv.map((x, i) => <LegendDot key={i} color={ROLE_COLORS[i]}>{INT[x]} {nm(chord.rootPc + x)}</LegendDot>)}
            {sv === 'scale' && <LegendDot outline>Other scale notes</LegendDot>}
            {next && (
              <span className="inline-flex items-center gap-1.5">
                <i className="inline-block size-2 rounded-full bg-primary ring-2 ring-card" />
                Also in the next chord, {next.name}
              </span>
            )}
            {progressionMode && (
              <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 border-l pl-3.5">
                {[...overview].sort((a, b) => a.step - b.step).map(o => (
                  <span key={o.chord.name} className="inline-flex items-center gap-1.5">
                    <i className="inline-block size-3 rounded-full bg-foreground" style={{ opacity: o.opacity }} />
                    {o.chord.name}{o.step === 0 ? ' (now)' : o.step === 1 ? ' (next)' : ''}
                  </span>
                ))}
              </span>
            )}
          </div>
          {isShapeView && (
            <div className="flex flex-wrap items-center gap-2">
              {sv === 'sweep'
                ? <Choice label="Strings" value={st.sweepN} onChange={v => change({ sweepN: v })} options={[3, 4, 5, 6].map(n => ({ value: n, label: `${n} strings` }))} />
                : <Choice label="String set" value={st.triSet} onChange={v => change({ triSet: v })} options={[0, 1, 2, 3].map(a => ({ value: a, label: SNAME.slice(a, a + 3).join(' ') }))} />}
              <Button variant="outline" size="icon" aria-label="Previous shape" disabled={!shapes.length}
                onClick={() => set({ shapeIdx: mod(idx - 1, shapes.length) })}><ChevronLeftIcon /></Button>
              <span className="min-w-[9ch] text-center font-mono text-[13px] text-muted-foreground tabular-nums">{shapes.length ? `${idx + 1} of ${shapes.length}` : '0 shapes'}</span>
              <Button variant="outline" size="icon" aria-label="Next shape" disabled={!shapes.length}
                onClick={() => set({ shapeIdx: mod(idx + 1, shapes.length) })}><ChevronRightIcon /></Button>
            </div>
          )}
        </div>
      </Card>

      <section className="grid grid-cols-1 gap-[18px] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {isShapeView && !shape && (
          <Panel title="No shapes here">
            <p className="m-0 text-muted-foreground">Nothing fits this position with {sv === 'sweep' ? `${st.sweepN} strings` : 'these strings'}. Pick "Whole neck" or another string set.</p>
          </Panel>
        )}
        {sv === 'sweep' && shape && (() => {
          const seq = sweepSeq(shape)
          const rolls: string[] = []
          for (let i = 1; i < shape.notes.length; i++) if (shape.notes[i].f === shape.notes[i - 1].f) rolls.push(`${SNAME[shape.notes[i - 1].s]} & ${SNAME[shape.notes[i].s]} at fret ${shape.notes[i].f}`)
          return (
            <Panel title={`${chord.name} sweep · ${st.sweepN} strings`}
              description={<>{ROLENAME[shape.bass]} in the bass, frets {shape.lo}–{shape.hi}{shape.ext.length ? `, plus fret ${shape.ext[0].f} on the high e` : ''}. Notes in order: {seq.slice(0, shape.notes.length + shape.ext.length).map(n => nm(n.p)).join(' → ')}</>}>
              <SeqStaff seq={seq} picks roleClass={roleClass} title={noteTitle} />
              <ul className="m-0 flex list-disc flex-col gap-1.5 pl-[18px]">
                <li><b>↓ going up:</b> one continuous downstroke. Let the pick fall through the strings, one note per string.</li>
                {shape.ext.length > 0 && <li><b>h / p on top:</b> hammer or slide to the dashed note, then pull back off.</li>}
                <li><b>↑ coming down:</b> one continuous upstroke back to the start.</li>
                <li><b>Kill each note as you leave it.</b> Lift the fretting finger right after the note sounds so the notes don't ring together like a strummed chord.</li>
                {rolls.length > 0 && <li><b>Roll:</b> {rolls.join('; ')}. Use one fingertip and rock it across both strings.</li>}
              </ul>
            </Panel>
          )
        })()}
        {sv === 'triad' && shape && (
          <Panel title={`${chord.name} triad · ${SNAME.slice(st.triSet, st.triSet + 3).join(' ')} strings`}
            description={`${['Root position', '1st inversion', '2nd inversion', '3rd inversion'][shape.bass]}, frets ${shape.lo}–${shape.hi}. Low to high: ${shape.notes.map(n => `${nm(n.p)} (${intOf(n.p)})`).join(', ')}.`}>
            <SeqStaff seq={[...shape.notes, ...shape.notes.slice(0, -1).reverse()]} picks={false} roleClass={roleClass} title={noteTitle} />
            <p className="m-0 max-w-[65ch] text-muted-foreground">
              Triads on three strings are the building blocks of 3-string sweeps. Learn all three inversions on one string set and you can connect them up the neck.
              {chord.iv.length > 3 && ' The 7th is left out because a triad only has three notes.'}
            </p>
          </Panel>
        )}
        {sv === 'arp' && (
          <Panel title={`${chord.name} arpeggio`}>
            <p className="m-0 max-w-[65ch]">
              {posObj
                ? `These are the ${chord.name} chord tones inside scale position ${st.pos + 1} (frets ${posObj.lo}–${posObj.hi}). Play them low to high, one at a time.`
                : `Every ${chord.name} chord tone on the neck. Pick a scale position to see the arpeggio inside one shape.`}
            </p>
            <p className="m-0 text-muted-foreground">Sweeps are arpeggios played one note per string. Switch to Sweeps to see the shapes that fit.</p>
          </Panel>
        )}
        {sv === 'scale' && (
          <Panel title={`${nm(st.root)} ${sc.name.toLowerCase()}`}>
            <p className="m-0 max-w-[65ch]">
              {posObj
                ? `Position ${st.pos + 1} covers frets ${posObj.lo}–${posObj.hi}${sc.iv.length === 7 ? ', three notes per string' : ', two notes per string'}.`
                : 'The whole scale across the neck. Pick a position to focus on one shape.'}
              {' '}Colored dots are {chord.name} chord tones. White dots are the other scale notes.
            </p>
            <p className="m-0 text-muted-foreground">When {chord.name} is the chord underneath, landing on a colored dot sounds resolved. The other scale notes work as passing notes between them.</p>
          </Panel>
        )}

        <Panel title="Notes you can use">
          <Field label={`${chord.name} chord tones (${chord.roman})`}>
            <div className="flex flex-wrap gap-1.5">
              {chord.iv.map((x, i) => <NoteChip key={i} role={ROLE[i]} name={nm(chord.rootPc + x)} sub={INT[x]} />)}
            </div>
          </Field>
          <Field label={`${nm(st.root)} ${sc.name.toLowerCase()} · degrees from ${nm(st.root)}`}>
            <div className="flex flex-wrap gap-1.5">
              {sc.iv.map(x => { const pc = st.root + x, r = role(pc); return <NoteChip key={x} role={r >= 0 ? ROLE[r] : undefined} name={nm(pc)} sub={INT[x].replace('R', '1')} /> })}
            </div>
          </Field>
          <p className="m-0 text-muted-foreground">
            Sweeps and arpeggios use only the chord tones.
            {(() => { const others = sc.iv.map(x => mod(st.root + x, 12)).filter(pc => role(pc) < 0); return others.length ? ` The rest (${others.map(nm).join(', ')}) are passing notes for runs and licks.` : '' })()}
          </p>
        </Panel>
      </section>

      {progressionMode && (
        <Panel title="Moving through the progression"
          description="Notes the chords share can stay under your fingers. The rest move to the nearest note of the next chord.">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {prog.map((deg, i) => {
              const a = chords[deg], b = chords[prog[(i + 1) % prog.length]]
              const ap = chordPcs(a), bp = chordPcs(b)
              const keep = ap.filter(pc => bp.includes(pc))
              const moves = ap.filter(pc => !bp.includes(pc)).map(pc => {
                const fresh = bp.filter(q => !keep.includes(q))
                const to = (fresh.length ? fresh : bp)
                  .reduce((best, q) => (Math.abs(((q - pc + 18) % 12) - 6) < Math.abs(((best - pc + 18) % 12) - 6) ? q : best))
                const semis = ((to - pc + 18) % 12) - 6
                return { from: pc, to, semis }
              })
              const last = i === prog.length - 1
              return (
                <button key={deg} type="button" onClick={() => goTo(i)}
                  className={cn('flex cursor-pointer flex-col gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-accent',
                    i === active && 'border-primary bg-primary/5')}>
                  <span className="flex flex-wrap items-baseline gap-1.5 font-semibold">
                    {a.name} <ArrowRightIcon className="size-3.5 self-center text-muted-foreground" aria-hidden /> {b.name}
                    {last && <small className="font-normal text-muted-foreground">(back to the start)</small>}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-[13px]">
                    <span className="text-muted-foreground">Keep</span>
                    {keep.length ? keep.map(pc => <NoteChip key={pc} name={nm(pc)} sub={INT[mod(pc - b.rootPc, 12)]} />) : <span className="text-muted-foreground">nothing in common</span>}
                  </span>
                  {moves.length > 0 && (
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                      <span className="text-muted-foreground">Move</span>
                      {moves.map(m => (
                        <span key={m.from} className="font-medium">
                          {nm(m.from)} → {nm(m.to)} <small className="font-mono text-muted-foreground">{m.semis > 0 ? `+${m.semis}` : m.semis} fret{Math.abs(m.semis) === 1 ? '' : 's'}</small>
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </Panel>
      )}
    </div>
  )
}
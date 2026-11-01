import { useCallback, useMemo, useState } from 'react'
import { AlertCircleIcon, LoaderCircleIcon } from 'lucide-react'
import { FLAT, FRETS, INT, SHARP, buildPositions, keyName, keyRole, keyScale, mod, stringNames, usesFlats } from '@/lib/theory'
import { analyzeRange, isPlayable, loadGuitarPro, makeSample, type Song } from '@/lib/song'
import { cn } from '@/lib/utils'
import { Fretboard, type BoardItem } from '@/components/Fretboard'
import { TabStaff } from '@/components/TabStaff'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { BarGrid } from '@/components/BarGrid'
import { Choice, Field, FieldLabel, LegendDot, Panel } from '@/components/ui'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface State { song: Song; track: number; from: number; to: number; keyIdx: number; focus: string | null; labels: 'frets' | 'notes' | 'int'; colors: boolean }

const fresh = (song: Song): State => ({
  song, track: Math.max(0, song.tracks.findIndex(isPlayable)), from: 0, to: song.bars.length - 1, keyIdx: 0, focus: null, labels: 'frets', colors: true,
})

export function Analysis({ onOpen }: { onOpen: (root: number, minor: boolean, pos: number) => void }) {
  const [st, setSt] = useState<State>(() => fresh(makeSample()))
  const [status, setStatus] = useState<{ busy?: string; error?: string }>({})
  const set = (p: Partial<State>) => setSt(s => ({ ...s, ...p }))
  const select = useCallback((from: number, to: number) => setSt(s => ({ ...s, from, to, keyIdx: 0 })), [])

  const { song } = st
  const track = song.tracks[st.track]
  const an = useMemo(() => analyzeRange(track, st.from, st.to), [track, st.from, st.to])
  const key = an.rank[Math.min(st.keyIdx, an.rank.length - 1)] ?? null
  const pn = (pc: number) => ((key && usesFlats(key.root, key.minor)) ? FLAT : SHARP)[mod(pc, 12)]
  const rangeTxt = st.from === st.to ? `bar ${st.from + 1}` : `bars ${st.from + 1}–${st.to + 1}`
  const maxFret = useMemo(() => Math.max(FRETS, ...track.notes.map(n => n.f)), [track])
  const whole = st.from === 0 && st.to === song.bars.length - 1

  // Playable tracks for the dropdown. Repeated names ("GT", "GT", "GT") get numbered so they can be told apart.
  const trackOptions = useMemo(() => {
    const list = song.tracks.map((t, i) => ({ t, i })).filter(({ t }) => isPlayable(t))
    const seen: Record<string, number> = {}
    return list.map(({ t, i }) => {
      const dup = list.filter(x => x.t.name === t.name).length > 1
      seen[t.name] = (seen[t.name] ?? 0) + 1
      return { i, name: dup ? `${t.name} ${seen[t.name]}` : t.name, detail: `${t.tuning.length} str · ${stringNames(t.tuning).join(' ')} · ${t.notes.length} notes` }
    })
  }, [song])

  async function onFile(file: File) {
    setStatus({ busy: `Reading ${file.name}…` })
    try { setSt(fresh(await loadGuitarPro(file))); setStatus({}) }
    catch (e) { setStatus({ error: (e as Error).message || 'That file could not be read.' }) }
  }

  // Aggregate the played notes per string/fret; bigger dots for notes that ring longer overall.
  const items: BoardItem[] = useMemo(() => {
    const agg = new Map<string, { s: number; f: number; p: number; w: number; c: number }>()
    an.notes.forEach(n => {
      const k = `${n.s}-${n.f}`, a = agg.get(k) ?? { s: n.s, f: n.f, p: n.p, w: 0, c: 0 }
      a.w += n.w; a.c++; agg.set(k, a)
    })
    const wmax = Math.max(1, ...[...agg.values()].map(a => a.w))
    return [...agg.values()].map(a => {
      const pc = mod(a.p, 12)
      return {
        s: a.s, f: a.f, r: 9 + 4.5 * Math.sqrt(a.w / wmax),
        cls: key ? keyRole(pc, key) : 'tone',
        // Frets mode shows note names on the neck (the fret is already its position) and fret numbers in the tab.
        label: st.labels === 'int' && key ? INT[mod(pc - key.root, 12)] : pn(pc),
        title: `${pn(pc)} · string ${track.tuning.length - a.s}, fret ${a.f} · played ${a.c}×`,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [an, key, st.labels, track])

  const spread = items.length ? { lo: Math.min(...items.map(i => i.f)), hi: Math.max(...items.map(i => i.f)) } : null
  const [scrollTarget, setScrollTarget] = useState<{ lo: number; hi: number } | null>(null)
  const pick = (k: string) => {
    const focus = st.focus === k ? null : k
    set({ focus })
    if (focus) { const f = +k.split('-')[1]; setScrollTarget({ lo: f, hi: f }) }
  }

  // Which scale position (for the chosen key) holds most of the section.
  const posInfo = useMemo(() => {
    if (!key || !an.total) return null
    const positions = buildPositions(key.root, keyScale(key))
    const cover = positions.map(p => an.notes.reduce((a, n) => a + (n.f >= Math.max(0, p.lo - 1) && n.f <= p.hi + 1 ? n.w : 0), 0) / an.total)
    const best = cover.indexOf(Math.max(...cover))
    return { positions, best, pct: Math.round(cover[best] * 100) }
  }, [key, an])

  const outPcs = key ? [...new Set(an.notes.map(n => mod(n.p, 12)))].filter(pc => keyRole(pc, key) === 'out') : []

  return (
    <div className="flex flex-col gap-[18px]">
      <Card className="gap-4 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 flex-col gap-1">
            {song.example
              ? <div className="flex items-center gap-2"><Badge variant="secondary">Example</Badge><span className="text-[13px] text-muted-foreground">Upload your own tab to replace it</span></div>
              : <FieldLabel>Loaded song</FieldLabel>}
            <h2 className="m-0 font-display text-[30px] leading-[1.05] font-bold tracking-[.02em] [overflow-wrap:anywhere] uppercase">{song.title}</h2>
            {song.artist && <span className="text-muted-foreground">{song.artist}</span>}
            <span className="text-[13px] text-muted-foreground">{song.bars.length} bars · {song.tempo} bpm</span>
          </div>
          <div className="flex w-full max-w-[360px] flex-col gap-1.5">
            <FieldLabel htmlFor="gp">Upload a Guitar Pro file</FieldLabel>
            <Input id="gp" type="file" accept=".gp,.gp3,.gp4,.gp5,.gpx" className="cursor-pointer bg-card"
              onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
            <span className="text-[13px] text-muted-foreground">Download the tab from Songsterr or Guitar Pro (.gp, .gp3–.gp5, .gpx). The file is read in your browser and never uploaded.</span>
          </div>
        </div>
        {status.busy && <p className="m-0 flex items-center gap-2 text-muted-foreground"><LoaderCircleIcon className="size-4 animate-spin" />{status.busy}</p>}
        {status.error && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>That tab couldn't be read</AlertTitle>
            <AlertDescription>{status.error} Try exporting it again as .gp5 or .gp.</AlertDescription>
          </Alert>
        )}

        <Separator />

        <Field label="Track" htmlFor="track">
          <Select value={String(st.track)} onValueChange={v => set({ track: +v, keyIdx: 0, focus: null })}>
            <SelectTrigger id="track" className="w-full max-w-md bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              {trackOptions.map(o => (
                <SelectItem key={o.i} value={String(o.i)}>
                  {o.name} <span className="font-mono text-[11px] text-muted-foreground">{o.detail}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Section">
          <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2.5">
            {(['from', 'to'] as const).map(which => (
              <div key={which} className="flex flex-col gap-1.5">
                <FieldLabel htmlFor={`bar-${which}`}>{which === 'from' ? 'From bar' : 'To bar'}</FieldLabel>
                <Input id={`bar-${which}`} type="number" min={1} max={song.bars.length} value={(which === 'from' ? st.from : st.to) + 1}
                  className="w-[88px] bg-card tabular-nums"
                  onChange={e => {
                    const n = song.bars.length, v = Math.min(n, Math.max(1, +e.target.value || 1)) - 1
                    let f = which === 'from' ? v : st.from, t = which === 'to' ? v : st.to
                    if (t < f) [f, t] = [t, f]
                    select(f, t)
                  }} />
              </div>
            ))}
            <Button variant={whole ? 'default' : 'outline'} aria-pressed={whole} onClick={() => select(0, song.bars.length - 1)}>Whole song</Button>
          </div>
        </Field>

        <BarGrid song={song} track={track} from={st.from} to={st.to} onSelect={select} />
      </Card>

      <Card aria-label="Notes played on the fretboard" className="gap-0 overflow-hidden py-0">
        <Fretboard tuning={track.tuning} items={items} frets={maxFret} focus={st.focus} onPick={pick}
          scrollTo={scrollTarget ?? spread} label="Notes played in the selected bars" />
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-t px-4 py-3">
          {key && (
            <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[13px] text-muted-foreground">
              <LegendDot color="var(--c-r)">{pn(key.root)} (key root)</LegendDot>
              <LegendDot color="var(--c-3)">3rd</LegendDot>
              <LegendDot color="var(--c-5)">5th</LegendDot>
              <LegendDot outline>Other notes in {keyName(key)}</LegendDot>
              <LegendDot dashed>Outside the key</LegendDot>
              <span>Bigger dot = played more</span>
            </div>
          )}
          <Choice label="Labels" value={st.labels} onChange={v => set({ labels: v })}
            options={[{ value: 'frets', label: 'Frets' }, { value: 'notes', label: 'Notes' }, { value: 'int', label: 'Intervals' }]} />
        </div>
      </Card>

      {!key ? (
        <Panel title="Likely key"><p className="m-0 text-muted-foreground">{track.name} has no notes in {rangeTxt}. Pick another section or track.</p></Panel>
      ) : (
        <>
          <Panel title={`Tab · ${rangeTxt}`}
            description="Tap a note to find it on the fretboard."
            action={
              <div className="flex items-center gap-2 pt-1">
                <Switch id="key-colors" checked={st.colors} onCheckedChange={v => set({ colors: v })} />
                <Label htmlFor="key-colors" className="cursor-pointer text-[13px] font-medium whitespace-nowrap">Key colors</Label>
              </div>
            }>
            <TabStaff song={song} track={track} from={st.from} to={st.to} keyInfo={key} labels={st.labels} colors={st.colors} focus={st.focus} onPick={pick} />
          </Panel>

          <section className="grid grid-cols-1 gap-[18px] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <Panel title={`Likely key: ${keyName(key)}`} description={`${track.name}, ${rangeTxt}, ${an.notes.length} notes. Tap another key to recolor the fretboard.`}>
              {an.rank.map((r, i) => (
                <div key={i} className="flex flex-wrap items-center gap-3">
                  <Button variant={i === st.keyIdx ? 'default' : 'outline'} size="sm" aria-pressed={i === st.keyIdx}
                    className="min-w-[11ch] rounded-full" onClick={() => set({ keyIdx: i })}>{keyName(r)}</Button>
                  <Progress value={Math.max(4, (r.score / (an.rank[0].score || 1)) * 100)} className="h-1.5 min-w-[60px] flex-[1_1_80px]" aria-label={`${keyName(r)} match`} />
                  <span className="min-w-[5ch] text-center font-mono text-[13px] text-muted-foreground tabular-nums">{r.score.toFixed(2)}</span>
                </div>
              ))}
              <p className="m-0 text-[13px] text-muted-foreground">
                {keyName(key)} and {keyName({ root: mod(key.root + (key.minor ? 3 : -3), 12), minor: !key.minor })} share the same notes. The one that feels like home (where phrases end) is the key.
              </p>
              {posInfo && (
                <div className="flex flex-col gap-2.5 rounded-lg bg-primary/10 px-4 py-3">
                  <p className="m-0"><b>{posInfo.pct}%</b> of these notes sit in scale position {posInfo.best + 1}, frets {posInfo.positions[posInfo.best].lo}–{posInfo.positions[posInfo.best].hi}.</p>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => onOpen(key.root, key.minor, posInfo.best)}>Practice position {posInfo.best + 1} in Explorer</Button>
                    <Button variant="outline" className="bg-card" onClick={() => onOpen(key.root, key.minor, -1)}>Open {keyName(key)}</Button>
                  </div>
                </div>
              )}
            </Panel>

            <Panel title="Notes played" description={`Weighted by how long each note lasts, starting from ${pn(key.root)}.`}>
              <div className="grid grid-cols-12 items-end gap-0.5 md:gap-1">
                {Array.from({ length: 12 }, (_, i) => mod(key.root + i, 12)).map(pc => {
                  const role = keyRole(pc, key), h = an.hist[pc], hmax = Math.max(...an.hist)
                  return (
                    <div key={pc} className="flex min-w-0 flex-col items-center gap-[3px]" title={`${pn(pc)}: ${Math.round((h / an.total) * 100)}%`}>
                      <div className="flex h-[90px] w-full items-end">
                        <span className={cn('block w-full rounded-t',
                          role === 'r' && 'bg-root', role === 't3' && 'bg-third', role === 't5' && 'bg-fifth',
                          role === 'tone' && 'border border-b-0 border-muted-foreground bg-tone',
                          role === 'out' && 'border-[1.5px] border-b-0 border-dashed border-muted-foreground')}
                          style={{ height: h ? `${Math.max(4, (h / hmax) * 100)}%` : 0, minHeight: 2 }} />
                      </div>
                      <b className="text-[11px] md:text-xs">{pn(pc)}</b>
                      <small className="font-mono text-[10px] text-muted-foreground">{INT[mod(pc - key.root, 12)]}</small>
                    </div>
                  )
                })}
              </div>
              <p className="m-0 text-[13px]">
                {outPcs.length
                  ? <>Outside the key: <b>{outPcs.map(pn).join(', ')}</b>. These are usually passing notes, bends, or a borrowed chord.</>
                  : <>Every note here fits {keyName(key)}.</>}
              </p>
            </Panel>
          </section>


        </>
      )}
    </div>
  )
}
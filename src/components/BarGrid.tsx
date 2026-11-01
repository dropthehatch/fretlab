import { useEffect, useMemo, useState } from 'react'
import { barGroups, type Song, type Track } from '@/lib/song'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const LEVEL = ['bg-muted', 'bg-primary/30', 'bg-primary/55', 'bg-primary/80', 'bg-primary']

/**
 * Contribution-style grid of bars, darker where more notes are played.
 * Drag across squares to select a range, or click one bar then another.
 */
export function BarGrid({ song, track, from, to, onSelect }: {
  song: Song; track: Track; from: number; to: number
  onSelect: (from: number, to: number) => void
}) {
  const [anchor, setAnchor] = useState<number | null>(null)
  const [drag, setDrag] = useState<{ start: number; end: number; moved: boolean } | null>(null)

  const counts = useMemo(() => {
    const c = Array(song.bars.length).fill(0)
    track.notes.forEach(n => { if (!n.tie) c[n.bar]++ })
    return c
  }, [song, track])
  const max = Math.max(1, ...counts)
  const level = (c: number) => (c ? Math.min(4, Math.ceil((c / max) * 4)) : 0)
  const groups = useMemo(() => barGroups(song), [song])

  useEffect(() => { setAnchor(null) }, [song, track])

  useEffect(() => {
    if (!drag) return
    const move = (e: PointerEvent) => {
      const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-bar]')
      if (el && el.dataset.bar && +el.dataset.bar !== drag.end) setDrag({ ...drag, end: +el.dataset.bar, moved: true })
    }
    const up = () => {
      const d = drag
      setDrag(null)
      if (d.moved) { setAnchor(null); onSelect(Math.min(d.start, d.end), Math.max(d.start, d.end)) }
      else if (anchor === null) { setAnchor(d.start); onSelect(d.start, d.start) }
      else { setAnchor(null); onSelect(Math.min(anchor, d.start), Math.max(anchor, d.start)) }
    }
    const cancel = () => setDrag(null)
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', cancel)
    return () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', cancel)
    }
  }, [drag, anchor, onSelect])

  const lo = drag ? Math.min(drag.start, drag.end) : from
  const hi = drag ? Math.max(drag.start, drag.end) : to
  const ranged = !(lo === 0 && hi === song.bars.length - 1)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-[.08em] text-muted-foreground uppercase">
          Notes per bar · drag across bars, click two bars, or click a section name
        </span>
        <div className="flex items-center gap-[3px] text-xs text-muted-foreground" aria-hidden="true">
          <span className="mr-1">Fewer</span>
          {LEVEL.map(c => <i key={c} className={cn('size-4 rounded-[3px]', c)} />)}
          <span className="ml-1">More</span>
        </div>
      </div>
      <div className="flex touch-none flex-col gap-2 select-none">
        {groups.map(gr => {
          const name = gr.name || `Bars ${gr.from + 1}–${gr.to + 1}`
          return (
            <div key={gr.from} className="grid grid-cols-1 items-start gap-x-3 gap-y-1 md:grid-cols-[150px_minmax(0,1fr)]">
              <button type="button" onClick={() => { setAnchor(null); onSelect(gr.from, gr.to) }} title={`Select ${name}`}
                className="flex min-w-0 cursor-pointer items-baseline gap-1.5 rounded-sm text-left text-[13px] leading-4 font-semibold hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
                {name}
                {gr.name && <small className="font-mono text-[11px] font-normal text-muted-foreground tabular-nums">{gr.from + 1}–{gr.to + 1}</small>}
              </button>
              <div className="flex flex-wrap gap-[3px]">
                {Array.from({ length: gr.to - gr.from + 1 }, (_, j) => gr.from + j).map(i => (
                  <Tooltip key={i} open={drag ? false : undefined}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        data-bar={i}
                        aria-label={`Bar ${i + 1}, ${counts[i]} notes`}
                        onPointerDown={e => { if (e.button > 0) return; e.preventDefault(); setDrag({ start: i, end: i, moved: false }) }}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAnchor(null); onSelect(i, i) } }}
                        className={cn(
                          'size-4 cursor-pointer rounded-[3px] hover:outline-2 hover:outline-offset-1 hover:outline-muted-foreground focus-visible:outline-2 focus-visible:outline-ring',
                          LEVEL[level(counts[i])],
                          ranged && (i < lo || i > hi) && 'opacity-30',
                          anchor === i && !drag && 'outline-2 outline-offset-1 outline-foreground',
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Bar {i + 1} · {counts[i]} {counts[i] === 1 ? 'note' : 'notes'}{song.bars[i].section ? ` · ${song.bars[i].section}` : ''}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

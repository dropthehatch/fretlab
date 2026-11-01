import { useEffect, useState } from 'react'
import { Explorer, defaultProgression, initialExplorer, type ExplorerState } from '@/views/Explorer'
import { Analysis } from '@/views/Analysis'
import { keyScale } from '@/lib/theory'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ModeToggle, ThemeProvider } from '@/components/theme'

type View = 'explorer' | 'analysis'
const viewFromHash = (): View => (location.hash === '#analysis' ? 'analysis' : 'explorer')

const TAGLINE: Record<View, string> = {
  explorer: 'Pick a key and a chord from it. See which notes belong in each scale position, arpeggio, triad and sweep shape.',
  analysis: 'Load a tab, pick a track and a section. See exactly what was played on the neck and what key it points to.',
}

export default function App() {
  const [view, setView] = useState<View>(viewFromHash)
  const [ex, setEx] = useState<ExplorerState>(initialExplorer)

  // The hash (#explorer / #analysis) keeps each view linkable and the back button working.
  useEffect(() => {
    const onHash = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (v: View) => { if (location.hash !== `#${v}`) location.hash = v; setView(v) }

  const openInExplorer = (root: number, minor: boolean, pos: number) => {
    setEx(s => ({ ...s, root, scale: keyScale({ minor }), chordDeg: 0, chords: defaultProgression(keyScale({ minor })), active: 0, anchor: null, pos, view: pos >= 0 ? 'scale' : s.view, shapeIdx: null }))
    go('explorer')
    window.scrollTo({ top: 0 })
  }

  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={250}>
        <Tabs value={view} onValueChange={v => go(v as View)}
          className="mx-auto max-w-[1200px] gap-[18px] pt-5 pr-[max(16px,env(safe-area-inset-right))] pb-14 pl-[max(16px,env(safe-area-inset-left))]">
          <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="m-0 font-display text-4xl leading-none font-extrabold tracking-[.01em] uppercase md:text-[44px]">Fretboard Lab</h1>
              <p className="m-0 max-w-[60ch] text-muted-foreground">{TAGLINE[view]}</p>
            </div>
            <div className="flex items-center gap-2">
              <TabsList className="h-10">
                <TabsTrigger value="explorer" className="px-4 font-display text-base font-bold tracking-[.03em] uppercase">Explorer</TabsTrigger>
                <TabsTrigger value="analysis" className="px-4 font-display text-base font-bold tracking-[.03em] uppercase">Song analysis</TabsTrigger>
              </TabsList>
              <ModeToggle />
            </div>
          </header>
          {/* forceMount keeps both views alive, so a loaded song survives switching tabs. */}
          <TabsContent value="explorer" forceMount className="data-[state=inactive]:hidden">
            <Explorer st={ex} set={p => setEx(s => ({ ...s, ...p }))} />
          </TabsContent>
          <TabsContent value="analysis" forceMount className="data-[state=inactive]:hidden">
            <Analysis onOpen={openInExplorer} />
          </TabsContent>
        </Tabs>
      </TooltipProvider>
    </ThemeProvider>
  )
}
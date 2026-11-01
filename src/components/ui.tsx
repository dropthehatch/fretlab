// Fretboard Lab's app-level building blocks, composed from shadcn/ui primitives in ./ui/.
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

/** Small uppercase label above a group of controls. */
export function FieldLabel({ children, className, htmlFor }: { children: ReactNode; className?: string; htmlFor?: string }) {
  const cls = cn('text-[11px] font-semibold uppercase tracking-[.08em] text-muted-foreground', className)
  return htmlFor ? <label htmlFor={htmlFor} className={cls}>{children}</label> : <span className={cls}>{children}</span>
}

export function Field({ label, children, className, htmlFor }: { label: ReactNode; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
    </div>
  )
}

/** shadcn Card with the app's display-face title. */
export function Panel({ title, description, action, children, className }: {
  title?: ReactNode; description?: ReactNode; action?: ReactNode; children?: ReactNode; className?: string
}) {
  return (
    <Card className={cn('min-w-0 gap-4 py-5', className)}>
      {(title || description) && (
        <CardHeader className="px-5">
          {title && <CardTitle className="font-display text-2xl leading-tight font-bold tracking-[.02em] text-balance uppercase">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
          {action}
        </CardHeader>
      )}
      <CardContent className="flex min-w-0 flex-col gap-3 px-5">{children}</CardContent>
    </Card>
  )
}

/**
 * Single-choice ToggleGroup that never deselects.
 * `look="chips"` = separated pills (primary when on); `look="segmented"` = joined segments (inverted when on).
 */
export function Choice<T extends string | number>({ value, onChange, options, label, look = 'segmented', size = 'default', className, itemClassName }: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; hint?: ReactNode; title?: string }[]
  label: string
  look?: 'chips' | 'segmented'
  size?: 'default' | 'sm' | 'lg'
  className?: string
  itemClassName?: string
}) {
  const chips = look === 'chips'
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size={size}
      spacing={chips ? 2 : 0}
      aria-label={label}
      value={String(value)}
      onValueChange={v => { if (!v) return; const o = options.find(x => String(x.value) === v); if (o) onChange(o.value) }}
      className={cn(chips ? 'flex-wrap' : 'bg-card', className)}
    >
      {options.map(o => (
        <ToggleGroupItem
          key={String(o.value)}
          value={String(o.value)}
          title={o.title}
          className={cn(
            'group/choice bg-card tabular-nums',
            chips
              ? 'rounded-full data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'
              : 'data-[state=on]:bg-foreground data-[state=on]:text-background',
            itemClassName,
          )}
        >
          {o.hint != null && (
            <small className="font-mono text-[11px] text-muted-foreground group-data-[state=on]/choice:text-current group-data-[state=on]/choice:opacity-80">{o.hint}</small>
          )}
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

/** A colored note chip (root/3rd/5th/7th or plain) with a small interval caption. */
export function NoteChip({ role, name, sub }: { role?: string; name: string; sub: string }) {
  const color: Record<string, string> = {
    r: 'bg-root text-white border-transparent', t3: 'bg-third text-[#1d1606] border-transparent',
    t5: 'bg-fifth text-white border-transparent', t7: 'bg-seventh text-white border-transparent',
  }
  return (
    <span className={cn('inline-flex min-w-[42px] flex-col items-center rounded-md border bg-background px-1.5 py-1 text-[15px] leading-tight font-semibold', role && color[role])}>
      {name}
      <small className="font-mono text-[11px] font-normal opacity-85">{sub}</small>
    </span>
  )
}

export function LegendDot({ color, outline, dashed, children }: { color?: string; outline?: boolean; dashed?: boolean; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i
        className={cn('inline-block size-3 rounded-full', outline && 'border border-muted-foreground bg-tone', dashed && 'border-[1.5px] border-dashed border-muted-foreground')}
        style={color ? { background: color } : undefined}
      />
      {children}
    </span>
  )
}

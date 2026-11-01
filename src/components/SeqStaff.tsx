import { SNAME, type SeqNote } from '@/lib/theory'

/** A short tab of one shape: evenly spaced, numbered steps, with a line tracing the path and pick directions below. */
export function SeqStaff({ seq, picks, roleClass, title }: {
  seq: SeqNote[]
  picks: boolean
  roleClass: (p: number) => string
  title: (n: SeqNote) => string
}) {
  const LS = 20, TOP = 20, staffH = LS * 5, LBL = 24, CW = 36, x0 = LBL + 14
  const W = x0 + seq.length * CW + 6, H = TOP + staffH + (picks ? 30 : 14)
  const y = (s: number) => TOP + (5 - s) * LS, x = (i: number) => x0 + i * CW + CW / 2
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tab with picking directions" className="block">
        {SNAME.map((n, s) => (
          <g key={s}>
            <line className="tl" x1={LBL} x2={W - 2} y1={y(s)} y2={y(s)} />
            <text className="tsn" x={LBL / 2} y={y(s)}>{n}</text>
          </g>
        ))}
        <line className="tb" x1={LBL} x2={LBL} y1={TOP} y2={TOP + staffH} />
        <line className="tb" x1={W - 2} x2={W - 2} y1={TOP} y2={TOP + staffH} />
        <polyline className="tpath" points={seq.map((e, i) => `${x(i)},${y(e.s)}`).join(' ')} />
        {seq.map((e, i) => {
          const lab = String(e.f), pw = lab.length > 1 ? 21 : 15
          return (
            <g key={i}>
              <text className="tstep" x={x(i)} y={TOP - 9}>{i + 1}</text>
              <g className={`tn ${roleClass(e.p)}${e.st === 'h' ? ' ext' : ''}`}>
                <rect x={x(i) - pw / 2} y={y(e.s) - 8} width={pw} height={16} rx={8} />
                <text x={x(i)} y={y(e.s) + 0.5}>{lab}</text>
                <title>{title(e)}</title>
              </g>
              {picks && e.st && (
                <text className={`tpick${/[↓↑]/.test(e.st) ? '' : ' tech'}`} x={x(i)} y={TOP + staffH + 22}>{e.st}</text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

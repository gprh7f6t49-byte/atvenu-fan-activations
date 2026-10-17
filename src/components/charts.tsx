// Small server-rendered SVG charts for the admin dashboard. Single series, so one
// hue (slot 1 of the reference categorical palette) and the title names the series.

const SERIES = "#2a78d6";

export function StatTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

/** Horizontal funnel: each step as a bar scaled to the first step, labelled directly. */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(steps[0]?.value ?? 0, 1);
  return (
    <ul className="space-y-3">
      {steps.map((s, i) => {
        const pct = (s.value / max) * 100;
        const ofPrev = i > 0 && steps[i - 1].value ? ` · ${((s.value / steps[i - 1].value) * 100).toFixed(0)}% of previous` : "";
        return (
          <li key={s.label} title={`${s.label}: ${s.value.toLocaleString("en-GB")}${ofPrev}`}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-zinc-700">{s.label}</span>
              <span className="tabular-nums text-zinc-900">
                {s.value.toLocaleString("en-GB")}
                <span className="text-xs text-zinc-500">{ofPrev}</span>
              </span>
            </div>
            <div className="h-3 rounded bg-zinc-100">
              <div className="h-3 rounded" style={{ width: `${Math.max(pct, s.value ? 1 : 0)}%`, background: SERIES }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Daily column chart with native hover tooltips and a table fallback for screen readers. */
export function DailyBars({ data, label }: { data: { day: string; value: number }[]; label: string }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-zinc-500">No data yet</p>;
  const W = 640, H = 180, PAD_L = 32, PAD_B = 22;
  const max = Math.max(...data.map((d) => d.value), 1);
  const band = (W - PAD_L) / data.length;
  const barW = Math.max(Math.min(band - 2, 28), 2);
  const y = (v: number) => (H - PAD_B) - (v / max) * (H - PAD_B - 8);
  const ticks = [0, Math.ceil(max / 2), max];
  const labelEvery = Math.ceil(data.length / 8);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W} y1={y(t)} y2={y(t)} stroke="#e4e4e7" strokeWidth={1} />
            <text x={PAD_L - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="#71717a">{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD_L + i * band + (band - barW) / 2;
          const top = y(d.value);
          const h = (H - PAD_B) - top;
          return (
            <g key={d.day}>
              {/* full-height hit target, bigger than the mark */}
              <rect x={PAD_L + i * band} y={0} width={band} height={H - PAD_B} fill="transparent">
                <title>{`${d.day}: ${d.value.toLocaleString("en-GB")} ${label.toLowerCase()}`}</title>
              </rect>
              {h > 0 && (
                <path pointerEvents="none" fill={SERIES}
                  d={`M${x},${H - PAD_B} V${top + Math.min(4, h)} q0,-${Math.min(4, h)} ${Math.min(4, barW / 2)},-${Math.min(4, h)} H${x + barW - Math.min(4, barW / 2)} q${Math.min(4, barW / 2)},0 ${Math.min(4, barW / 2)},${Math.min(4, h)} V${H - PAD_B} Z`} />
              )}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="#71717a">{d.day.slice(5)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <details className="mt-2 text-xs text-zinc-500">
        <summary className="cursor-pointer">Show as table</summary>
        <table className="mt-2 w-full">
          <tbody>
            {data.map((d) => (
              <tr key={d.day}><td className="py-0.5">{d.day}</td><td className="text-right tabular-nums">{d.value}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

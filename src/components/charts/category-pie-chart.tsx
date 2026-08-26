"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART, TooltipRow, TooltipShell } from "@/components/charts/chart-theme";
import { formatEUR } from "@/lib/money";

/**
 * Ausgabenverteilung als Donut: ein Teil-vom-Ganzen-Bild auf einen Blick.
 *
 * Zwei Grenzen sind bewusst hart gezogen, weil Kreisdiagramme genau daran
 * scheitern:
 *
 * 1. Höchstens fünf Segmente. Ab da sind Winkel nicht mehr vergleichbar; alles
 *    hinter den Top 4 wandert in ein Sammelsegment im Kontextgrau.
 * 2. Nur vier kategoriale Farbtöne. Größere Sets aus der Referenzpalette
 *    reißen die All-Pairs-Schwellen für Farbfehlsichtigkeit (siehe globals.css).
 *
 * Identität hängt deshalb nie an der Farbe allein: jedes Segment steht mit Name,
 * Betrag und Anteil in der Liste daneben — die ist zugleich Legende und
 * Tabellenansicht. Beschriftungen am Ring selbst gibt es nicht: bei fünf
 * Segmenten in einer halbbreiten Karte kollidieren sie.
 */

export type CategoryDatum = { label: string; cents: number; share: number };

type Slice = CategoryDatum & { color: string; merged?: string[] };

const MAX_SLICES = 5;
const formatShare = (share: number) => `${(share * 100).toFixed(1).replace(".", ",")} %`;

/** Top 4 behalten ihre Farbe, der Rest wird zu einem grauen Sammelsegment. */
function toSlices(data: CategoryDatum[]): Slice[] {
  const sorted = [...data].sort((a, b) => b.cents - a.cents);
  if (sorted.length <= MAX_SLICES) {
    return sorted.map((row, index) => ({ ...row, color: CHART.categorical[index] }));
  }

  const head = sorted.slice(0, CHART.categorical.length);
  const tail = sorted.slice(CHART.categorical.length);

  return [
    ...head.map((row, index) => ({ ...row, color: CHART.categorical[index] })),
    {
      label: `Kleinere Posten (${tail.length})`,
      cents: tail.reduce((sum, row) => sum + row.cents, 0),
      share: tail.reduce((sum, row) => sum + row.share, 0),
      color: CHART.context,
      merged: tail.map((row) => row.label),
    },
  ];
}

export function CategoryPieChart({ data }: { data: CategoryDatum[] }) {
  const slices = toSlices(data);
  const total = slices.reduce((sum, slice) => sum + slice.cents, 0);

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative h-[220px] w-full sm:w-[220px] sm:shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Pie
              data={slices}
              dataKey="cents"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="92%"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
              /* 2px Fläche zwischen den Segmenten statt einer Trennlinie. */
              stroke={CHART.surface}
              strokeWidth={2}
            >
              {slices.map((slice) => (
                <Cell key={slice.label} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const slice = payload[0].payload as Slice;
                return (
                  <TooltipShell title={slice.label}>
                    <TooltipRow color={slice.color} label="Ausgaben" value={formatEUR(slice.cents)} />
                    <TooltipRow label="Anteil" value={formatShare(slice.share)} />
                    {slice.merged ? <TooltipRow label="Enthält" value={slice.merged.join(", ")} /> : null}
                  </TooltipShell>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Die Summe gehört in die Mitte — sonst ist das Loch nur Loch. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-text-muted">Summe</span>
          <span className="tabular text-sm font-semibold text-text">{formatEUR(total)}</span>
        </div>
      </div>

      {/* Legende und Tabellenansicht in einem: Farbe, Name, Betrag, Anteil. */}
      <ul className="flex-1 text-sm">
        {slices.map((slice) => (
          <li
            key={slice.label}
            className="flex items-baseline gap-2 border-b border-border-base py-1.5 last:border-b-0"
          >
            <span
              aria-hidden
              className="size-2 shrink-0 translate-y-px rounded-full"
              style={{ backgroundColor: slice.color }}
            />
            <span className="truncate text-text" title={slice.merged?.join(", ")}>
              {slice.label}
            </span>
            <span className="tabular ml-auto shrink-0 font-medium text-text">
              {formatEUR(slice.cents)}
            </span>
            <span className="tabular w-14 shrink-0 text-right text-xs text-text-muted">
              {formatShare(slice.share)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";

/**
 * Gemeinsames Chart-Vokabular. Farben kommen als CSS-Custom-Properties aus
 * globals.css, damit Light/Dark ohne JS umschaltet und beide Charts garantiert
 * dieselben Rollen benutzen.
 */
export const CHART = {
  series: "var(--chart-series)",
  context: "var(--chart-context)",
  grid: "var(--chart-grid)",
  axisText: "var(--text-muted)",
  surface: "var(--surface)",
  /** Kategoriale Slots in fester Reihenfolge — nie zyklisch weiterdrehen. */
  categorical: [
    "var(--chart-cat-1)",
    "var(--chart-cat-2)",
    "var(--chart-cat-3)",
    "var(--chart-cat-4)",
  ],
} as const;

export const axisTick = { fill: CHART.axisText, fontSize: 12 } as const;

/** Tooltip im Look der übrigen Karten — Recharts' Default passt nicht zum Theme. */
export function TooltipShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border-base bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-text">{title}</p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

export function TooltipRow({
  color,
  label,
  value,
}: {
  color?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {color ? (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      <span className="text-text-muted">{label}</span>
      <span className="tabular ml-auto font-medium text-text">{value}</span>
    </div>
  );
}

/** Legende als normales Markup — kein Farbtext, die Beschriftung bleibt Textfarbe. */
export function ChartLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-0.5 w-4 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART,
  ChartLegend,
  TooltipRow,
  TooltipShell,
  axisTick,
} from "@/components/charts/chart-theme";
import { formatEURCompact, formatEURFromNumber } from "@/lib/money";
import type { SeriesPoint } from "@/lib/portfolio";

/**
 * Wertentwicklung als Emphasis-Chart: der Portfoliowert ist die Aussage (Akzentfarbe),
 * das investierte Kapital ist Kontext (De-Emphasis-Grau, zusätzlich gestrichelt als
 * zweite Codierung neben der Farbe). Nur eine Y-Achse — beide Reihen sind Euro.
 */

const monthTick = new Intl.DateTimeFormat("de-DE", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

const fullDate = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" });

/** Ungefähr `count` gleichmäßig verteilte Ticks — sonst überlappen 130 Handelstage. */
function pickTicks(data: SeriesPoint[], count = 6): string[] {
  if (data.length <= count) return data.map((point) => point.date);
  const step = (data.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => data[Math.round(i * step)].date);
}

export function PortfolioLineChart({ data }: { data: SeriesPoint[] }) {
  const last = data.at(-1);

  return (
    <div className="flex flex-col gap-3">
      <ChartLegend
        items={[
          { color: CHART.series, label: "Portfoliowert" },
          { color: CHART.context, label: "Investiert" },
        ]}
      />

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} strokeWidth={1} />
            <XAxis
              dataKey="date"
              ticks={pickTicks(data)}
              tickFormatter={(value: string) => monthTick.format(new Date(`${value}T00:00:00Z`))}
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: CHART.grid }}
              minTickGap={16}
            />
            <YAxis
              tickFormatter={formatEURCompact}
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={72}
              domain={["auto", "auto"]}
            />
            <Tooltip
              cursor={{ stroke: CHART.grid, strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as SeriesPoint;
                return (
                  <TooltipShell title={fullDate.format(new Date(`${point.date}T00:00:00Z`))}>
                    <TooltipRow
                      color={CHART.series}
                      label="Wert"
                      value={formatEURFromNumber(point.value)}
                    />
                    <TooltipRow
                      color={CHART.context}
                      label="Investiert"
                      value={formatEURFromNumber(point.invested)}
                    />
                    <TooltipRow
                      label="G/V"
                      value={formatEURFromNumber(point.value - point.invested)}
                    />
                  </TooltipShell>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="invested"
              name="Investiert"
              stroke={CHART.context}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="value"
              name="Portfoliowert"
              stroke={CHART.series}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: CHART.surface }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {last ? (
        <p className="text-xs text-text-muted">
          Stand {fullDate.format(new Date(`${last.date}T00:00:00Z`))}:{" "}
          <span className="tabular font-medium text-text">{formatEURFromNumber(last.value)}</span>{" "}
          bei {formatEURFromNumber(last.invested)} investiertem Kapital.
        </p>
      ) : null}
    </div>
  );
}

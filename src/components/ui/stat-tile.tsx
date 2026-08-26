import { clsx } from "clsx";
import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  sub,
  tone = "neutral",
  emphasis = false,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  tone?: "neutral" | "positive" | "negative";
  emphasis?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-border-base bg-surface px-5 py-4",
        emphasis && "bg-accent-soft",
      )}
    >
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p
        className={clsx(
          "tabular mt-1 font-semibold tracking-tight",
          emphasis ? "text-3xl" : "text-2xl",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-1 text-xs text-text-muted">{sub}</p> : null}
    </div>
  );
}

/** Vorzeichenabhängige Einfärbung für G/V-Werte. */
export const toneOf = (value: number | null): "neutral" | "positive" | "negative" =>
  value === null || value === 0 ? "neutral" : value > 0 ? "positive" : "negative";

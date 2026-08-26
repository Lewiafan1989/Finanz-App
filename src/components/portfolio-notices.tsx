import type { Portfolio } from "@/lib/portfolio";

/**
 * Hinweise zu Positionen, die nicht in den Summen stecken.
 *
 * Beide Ausfälle sind still, wenn man sie nicht meldet: ohne Kurs oder ohne
 * Wechselkurs fehlt der EUR-Wert, die Position steht aber weiter in der Tabelle.
 * Deshalb sagen Dashboard und Portfolio-Seite es mit demselben Wortlaut.
 */
export function PortfolioNotices({ portfolio }: { portfolio: Portfolio }) {
  const missing = [
    portfolio.unpriced.length > 0
      ? `Ohne Kurs und daher nicht in den Summen: ${portfolio.unpriced.join(", ")}.`
      : null,
    portfolio.unconverted.length > 0
      ? `Ohne Wechselkurs und daher nicht in den Summen: ${portfolio.unconverted.join(", ")}.`
      : null,
  ].filter((notice): notice is string => notice !== null);

  if (missing.length === 0 && !portfolio.hasStaleQuotes) return null;

  return (
    <div className="flex flex-col gap-2">
      {missing.map((notice) => (
        <p
          key={notice}
          className="rounded-lg border border-border-strong bg-negative-soft px-4 py-3 text-sm text-negative"
        >
          {notice}
        </p>
      ))}
      {portfolio.hasStaleQuotes ? (
        <p className="rounded-lg border border-border-strong bg-surface-muted px-4 py-3 text-sm text-text-muted">
          Yahoo Finance war zuletzt nicht erreichbar — angezeigt wird der zuletzt bekannte
          Kursstand.
        </p>
      ) : null}
    </div>
  );
}

import { deleteAsset } from "@/app/actions/assets";
import { formatCurrency, formatEURFromNumber, formatEURSigned, formatPercent } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { DeleteButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import type { Portfolio } from "@/lib/portfolio";

export function PortfolioTable({ portfolio }: { portfolio: Portfolio }) {
  if (portfolio.positions.length === 0) {
    return <EmptyState>Noch keine Positionen erfasst.</EmptyState>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b border-border-base text-left text-xs text-text-muted">
            <th className="py-2 pr-3 font-medium">Position</th>
            <th className="py-2 pr-3 text-right font-medium">Anzahl</th>
            <th className="py-2 pr-3 text-right font-medium">Ø Einstand</th>
            <th className="py-2 pr-3 text-right font-medium">Kurs</th>
            <th className="py-2 pr-3 text-right font-medium">Wert (EUR)</th>
            <th className="py-2 text-right font-medium">G/V</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-border-base">
          {portfolio.positions.map((position) => {
            const gain = position.gainAbsEur;
            const tone =
              gain === null || gain === 0 ? "text-text" : gain > 0 ? "text-positive" : "text-negative";

            return (
              <tr key={position.symbol} className="align-top">
                <td className="py-3 pr-3">
                  <p className="font-mono text-sm font-semibold">{position.symbol}</p>
                  <p className="max-w-[16rem] truncate text-xs text-text-muted">
                    {position.name ?? "—"}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {position.lots.map((lot) => (
                      <li key={lot.id} className="flex items-center gap-1.5 text-[11px] text-text-muted">
                        <span>
                          {lot.shares} ×{" "}
                          {formatCurrency(lot.buyPrice / 100, lot.buyCurrency ?? position.currency)}{" "}
                          am{" "}
                          {formatDate(lot.buyDate)}
                        </span>
                        <form action={deleteAsset}>
                          <input type="hidden" name="id" value={lot.id} />
                          <DeleteButton label={`Kauf vom ${formatDate(lot.buyDate)} löschen`} />
                        </form>
                      </li>
                    ))}
                  </ul>
                </td>

                <td className="tabular py-3 pr-3 text-right">{position.shares}</td>
                <td className="tabular py-3 pr-3 text-right">
                  {position.avgBuyPrice === null ? (
                    <span className="text-text-muted">gemischt</span>
                  ) : (
                    formatCurrency(position.avgBuyPrice, position.buyCurrency ?? position.currency)
                  )}
                </td>
                <td className="tabular py-3 pr-3 text-right">
                  {position.price === null ? (
                    <span className="text-text-muted">kein Kurs</span>
                  ) : (
                    <>
                      {formatCurrency(position.price, position.currency)}
                      {position.fetchedAt ? (
                        <span className="block text-[11px] font-normal text-text-muted">
                          {position.stale ? "veraltet · " : ""}
                          {formatDateTime(position.fetchedAt)}
                        </span>
                      ) : null}
                    </>
                  )}
                </td>
                <td className="tabular py-3 pr-3 text-right font-medium">
                  {position.marketValueEur === null
                    ? "—"
                    : formatEURFromNumber(position.marketValueEur)}
                </td>
                <td className={`tabular py-3 text-right font-medium ${tone}`}>
                  {gain === null ? (
                    "—"
                  ) : (
                    <>
                      {formatEURFromNumber(gain)}
                      {position.gainPct !== null ? (
                        <span className="block text-[11px] font-normal">
                          {formatPercent(position.gainPct)}
                        </span>
                      ) : null}
                      {/* Nur zeigen, wenn die Währung überhaupt etwas beigetragen hat. */}
                      {position.fxGainEur !== null && Math.abs(position.fxGainEur) >= 0.005 ? (
                        <span className="block text-[11px] font-normal text-text-muted">
                          davon Währung {formatEURSigned(position.fxGainEur)}
                        </span>
                      ) : null}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr className="border-t-2 border-border-strong font-semibold">
            <td className="py-3 pr-3">Gesamt</td>
            <td colSpan={3} />
            <td className="tabular py-3 pr-3 text-right">
              {formatEURFromNumber(portfolio.totalValueEur)}
            </td>
            <td
              className={`tabular py-3 text-right ${
                portfolio.totalGainEur > 0
                  ? "text-positive"
                  : portfolio.totalGainEur < 0
                    ? "text-negative"
                    : ""
              }`}
            >
              {formatEURFromNumber(portfolio.totalGainEur)}
              {portfolio.totalGainPct !== null ? (
                <span className="block text-[11px] font-normal">
                  {formatPercent(portfolio.totalGainPct)}
                </span>
              ) : null}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

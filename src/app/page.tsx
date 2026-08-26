import Link from "next/link";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { StatTile, toneOf } from "@/components/ui/stat-tile";
import { CategoryPieChart, type CategoryDatum } from "@/components/charts/category-pie-chart";
import { PortfolioLineChart } from "@/components/charts/portfolio-line-chart";
import { PortfolioNotices } from "@/components/portfolio-notices";
import { getExpensesByCategory, getNetWorth, getRecurringMonthlyCents } from "@/lib/finance";
import { getPortfolioSeries } from "@/lib/portfolio";
import { CATEGORY_LABELS } from "@/lib/categories";
import { currentMonth, formatMonthLabel } from "@/lib/dates";
import { formatEUR, formatEURFromNumber, formatPercent } from "@/lib/money";

// Das Dashboard bewertet live gegen den Kurspuffer — kein statisches Vorrendern.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const month = currentMonth();

  const [netWorth, monthExpenses, recurringCents, series] = await Promise.all([
    getNetWorth(),
    getExpensesByCategory(month),
    getRecurringMonthlyCents(),
    getPortfolioSeries(6),
  ]);

  // Am Monatsanfang ist die Monatsverteilung noch leer — dann lieber den
  // Gesamtzeitraum zeigen als eine leere Karte.
  const usesFallback = monthExpenses.length === 0;
  const expenses = usesFallback ? await getExpensesByCategory() : monthExpenses;
  const totalExpenses = expenses.reduce((sum, row) => sum + row.cents, 0);

  const chartData: CategoryDatum[] = expenses.map((row) => ({
    label: CATEGORY_LABELS[row.category],
    cents: row.cents,
    share: totalExpenses > 0 ? row.cents / totalExpenses : 0,
  }));

  const { portfolio } = netWorth;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Net Worth"
          value={formatEURFromNumber(netWorth.totalEur)}
          sub="Kassenstand + Portfolio"
          emphasis
        />
        <StatTile
          label="Kassenstand"
          value={formatEURFromNumber(netWorth.cashEur)}
          tone={toneOf(netWorth.cashEur)}
          sub="Alle Einnahmen minus Ausgaben"
        />
        <StatTile
          label="Portfoliowert"
          value={formatEURFromNumber(netWorth.portfolioEur)}
          sub={
            portfolio.totalGainPct === null ? (
              "Noch keine Positionen"
            ) : (
              <>
                G/V {formatEURFromNumber(portfolio.totalGainEur)} ·{" "}
                {formatPercent(portfolio.totalGainPct)}
              </>
            )
          }
        />
        <StatTile
          label="Fixkosten je Monat"
          value={formatEUR(recurringCents)}
          sub="Wiederkehrende Ausgaben, auf den Monat normiert"
        />
      </div>

      <PortfolioNotices portfolio={portfolio} />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader
            title="Ausgaben nach Kategorie"
            hint={
              usesFallback
                ? "Gesamter Zeitraum — im laufenden Monat ist noch nichts erfasst."
                : formatMonthLabel(month)
            }
          />
          <CardBody>
            {chartData.length === 0 ? (
              <EmptyState>
                Noch keine Ausgaben erfasst.{" "}
                <Link href="/transactions" className="text-accent underline underline-offset-2">
                  Erste Buchung anlegen
                </Link>
                .
              </EmptyState>
            ) : (
              <CategoryPieChart data={chartData} />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Portfolio-Wertentwicklung"
            hint="Letzte 6 Monate, rekonstruiert aus End-of-Day-Kursen."
          />
          <CardBody>
            {series.length === 0 ? (
              <EmptyState>
                Noch keine Positionen.{" "}
                <Link href="/portfolio" className="text-accent underline underline-offset-2">
                  Erste Position anlegen
                </Link>
                .
              </EmptyState>
            ) : (
              <PortfolioLineChart data={series} />
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

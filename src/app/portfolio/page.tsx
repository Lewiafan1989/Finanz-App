import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AssetForm } from "@/components/asset-form";
import { PortfolioTable } from "@/components/portfolio-table";
import { PortfolioNotices } from "@/components/portfolio-notices";
import { StatTile, toneOf } from "@/components/ui/stat-tile";
import { getPortfolio } from "@/lib/portfolio";
import { formatEURFromNumber, formatPercent } from "@/lib/money";
import { toIsoDate } from "@/lib/dates";

// Kurse sollen beim Aufruf frisch bewertet werden; der Puffer in PriceCache
// begrenzt dabei die tatsächlichen Yahoo-Requests.
export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const portfolio = await getPortfolio();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Portfoliowert" value={formatEURFromNumber(portfolio.totalValueEur)} />
        <StatTile label="Investiert" value={formatEURFromNumber(portfolio.totalCostEur)} />
        <StatTile
          label="Gewinn / Verlust"
          value={formatEURFromNumber(portfolio.totalGainEur)}
          tone={toneOf(portfolio.totalGainEur)}
          sub={portfolio.totalGainPct === null ? undefined : formatPercent(portfolio.totalGainPct)}
        />
      </div>

      <PortfolioNotices portfolio={portfolio} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader title="Position hinzufügen" hint="Ticker wird beim Speichern geprüft." />
          <CardBody>
            <AssetForm defaultDate={toIsoDate(new Date())} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Bestand"
            hint="Kurse End-of-Day via Yahoo Finance, umgerechnet in EUR."
          />
          <CardBody>
            <PortfolioTable portfolio={portfolio} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

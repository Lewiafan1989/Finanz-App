import "server-only";
import { db } from "@/lib/db";
import { getEurFactors, getHistory, getQuotes, type Candle } from "@/lib/quotes";
import { centsToNumber } from "@/lib/money";
import { toIsoDate } from "@/lib/dates";
import type { Asset } from "@/generated/prisma/client";

/**
 * Ein Asset-Datensatz ist ein einzelner Kauf ("Lot"). Für die Anzeige werden Lots
 * desselben Tickers zu einer Position verdichtet; fürs Löschen bleiben sie einzeln
 * erreichbar.
 */

export type Position = {
  symbol: string;
  name: string | null;
  /** Notierungswährung des Papiers (aus dem Quote). */
  currency: string;
  shares: number;
  /** Währung der Einstände; null = die Lots wurden in verschiedenen Währungen gekauft. */
  buyCurrency: string | null;
  /** Durchschnittlicher Einstand je Anteil in `buyCurrency`; null bei gemischten Währungen. */
  avgBuyPrice: number | null;
  price: number | null;
  fetchedAt: Date | null;
  stale: boolean;
  marketValue: number | null;
  marketValueEur: number | null;
  /** Einstand in EUR, bewertet mit dem Wechselkurs vom Kauftag. */
  costBasisEur: number | null;
  gainAbsEur: number | null;
  /** EUR-basiert und damit inklusive Währungseffekt. */
  gainPct: number | null;
  /** Anteil des G/V aus der Kursbewegung … */
  priceGainEur: number | null;
  /** … und der Anteil aus der Wechselkursbewegung seit dem Kauf. */
  fxGainEur: number | null;
  lots: Asset[];
};

export type Portfolio = {
  positions: Position[];
  totalValueEur: number;
  totalCostEur: number;
  totalGainEur: number;
  totalGainPct: number | null;
  /** Symbole ohne Kurs (unbekannter Ticker oder Yahoo nicht erreichbar). */
  unpriced: string[];
  /** Symbole mit Kurs, aber ohne FX-Umrechnung — fehlen ebenfalls in den Summen. */
  unconverted: string[];
  hasStaleQuotes: boolean;
};

const EMPTY_PORTFOLIO: Portfolio = {
  positions: [],
  totalValueEur: 0,
  totalCostEur: 0,
  totalGainEur: 0,
  totalGainPct: null,
  unpriced: [],
  unconverted: [],
  hasStaleQuotes: false,
};

export async function getPortfolio(): Promise<Portfolio> {
  const assets = await db.asset.findMany({ orderBy: [{ symbol: "asc" }, { buyDate: "asc" }] });
  if (assets.length === 0) return EMPTY_PORTFOLIO;

  const quotes = await getQuotes(assets.map((asset) => asset.symbol));

  // Die Währung des Papiers ist die von Yahoo gemeldete; der beim Anlegen
  // gespeicherte Wert dient nur als Rückfallebene. Die Kaufwährung kann davon
  // abweichen und braucht deshalb ihren eigenen Faktor.
  const currencies = assets.flatMap((asset) => [
    quotes.get(asset.symbol)?.currency ?? asset.currency,
    asset.buyCurrency ?? asset.currency,
  ]);
  const factors = await getEurFactors(currencies);

  const bySymbol = new Map<string, Asset[]>();
  for (const asset of assets) {
    const list = bySymbol.get(asset.symbol);
    if (list) list.push(asset);
    else bySymbol.set(asset.symbol, [asset]);
  }

  const positions: Position[] = [];
  const unpriced: string[] = [];
  const unconverted: string[] = [];
  let totalValueEur = 0;
  let totalCostEur = 0;
  let hasStaleQuotes = false;

  for (const [symbol, lots] of bySymbol) {
    const quote = quotes.get(symbol);
    const currency = (quote?.currency ?? lots[0].currency).toUpperCase();
    const factor = factors.get(currency) ?? null;

    const shares = lots.reduce((sum, lot) => sum + lot.shares, 0);

    // Kaufwährung je Lot; nur wenn alle Lots dieselbe haben, lässt sich ein
    // Ø Einstand in einer Währung überhaupt sinnvoll angeben.
    const buyCurrencies = new Set(
      lots.map((lot) => (lot.buyCurrency ?? lot.currency).toUpperCase()),
    );
    const buyCurrency = buyCurrencies.size === 1 ? [...buyCurrencies][0] : null;

    const buySum = lots.reduce((sum, lot) => sum + lot.shares * centsToNumber(lot.buyPrice), 0);
    const avgBuyPrice = buyCurrency !== null && shares > 0 ? buySum / shares : null;

    // Zwei Einstände in EUR: einmal mit dem Kurs vom Kauftag (der echte Einsatz)
    // und einmal mit dem heutigen — die Differenz IST der Währungseffekt.
    let costBasisEur: number | null = 0;
    let costAtTodayFx: number | null = 0;
    for (const lot of lots) {
      const lotCurrency = (lot.buyCurrency ?? lot.currency).toUpperCase();
      const todayRate = factors.get(lotCurrency) ?? null;
      const buyRate = lot.buyFxRate ?? todayRate;
      const amount = lot.shares * centsToNumber(lot.buyPrice);

      costBasisEur = costBasisEur === null || buyRate === null ? null : costBasisEur + amount * buyRate;
      costAtTodayFx =
        costAtTodayFx === null || todayRate === null ? null : costAtTodayFx + amount * todayRate;
    }

    const price = quote?.price ?? null;
    const marketValue = price === null ? null : shares * price;
    const marketValueEur = factor === null || marketValue === null ? null : marketValue * factor;

    const gainAbsEur =
      marketValueEur === null || costBasisEur === null ? null : marketValueEur - costBasisEur;
    const gainPct =
      gainAbsEur === null || costBasisEur === null || costBasisEur === 0
        ? null
        : gainAbsEur / costBasisEur;

    // Aufteilung: Kursanteil misst die Bewegung des Papiers zu heutigen
    // Wechselkursen, Währungsanteil den Rest. Beides zusammen ergibt den G/V.
    const priceGainEur =
      marketValueEur === null || costAtTodayFx === null ? null : marketValueEur - costAtTodayFx;
    const fxGainEur =
      costAtTodayFx === null || costBasisEur === null ? null : costAtTodayFx - costBasisEur;

    if (price === null) unpriced.push(symbol);
    // Kurs da, aber kein Wechselkurs: die Position steht in ihrer Währung in der
    // Tabelle und fehlt in den EUR-Summen — das muss die Seite sagen können.
    else if (factor === null) unconverted.push(symbol);
    if (quote?.stale) hasStaleQuotes = true;
    if (marketValueEur !== null) totalValueEur += marketValueEur;
    if (costBasisEur !== null) totalCostEur += costBasisEur;

    positions.push({
      symbol,
      name: quote?.shortName ?? null,
      currency,
      shares,
      buyCurrency,
      avgBuyPrice,
      price,
      fetchedAt: quote?.fetchedAt ?? null,
      stale: quote?.stale ?? true,
      marketValue,
      marketValueEur,
      costBasisEur,
      gainAbsEur,
      gainPct,
      priceGainEur,
      fxGainEur,
      lots,
    });
  }

  positions.sort((a, b) => (b.marketValueEur ?? 0) - (a.marketValueEur ?? 0));

  const totalGainEur = totalValueEur - totalCostEur;

  return {
    positions,
    totalValueEur,
    totalCostEur,
    totalGainEur,
    totalGainPct: totalCostEur > 0 ? totalGainEur / totalCostEur : null,
    unpriced,
    unconverted,
    hasStaleQuotes,
  };
}

export type SeriesPoint = {
  date: string;
  /** Portfoliowert in EUR an diesem Handelstag. */
  value: number;
  /** Bis dahin investiertes Kapital in EUR — die Referenzlinie für den G/V. */
  invested: number;
};

/**
 * Wertentwicklung aus echten EOD-Kursen rekonstruiert.
 *
 * Achse sind die Handelstage aus der Kurshistorie. Pro Tag zählen nur Lots, die zu
 * diesem Zeitpunkt schon gekauft waren — dadurch springt die Kurve bei Zukäufen
 * korrekt in Stufen, statt rückwirkend eine zu große Position zu unterstellen.
 *
 * Vereinfachung: der Marktwert wird mit dem HEUTIGEN Wechselkurs gerechnet, nicht
 * mit dem des jeweiligen Tages — historische FX-Reihen wären ein zweiter Satz
 * Yahoo-Abrufe pro Währung. Der Einsatz dagegen steht mit dem Kurs vom Kauftag
 * in der Reihe (`Asset.buyFxRate`), weil der ohnehin gespeichert ist.
 */
export async function getPortfolioSeries(months = 6): Promise<SeriesPoint[]> {
  const assets = await db.asset.findMany({ orderBy: { buyDate: "asc" } });
  if (assets.length === 0) return [];

  const today = new Date();
  const windowStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - months, today.getUTCDate()),
  );
  const earliestBuy = assets[0].buyDate;
  const from = earliestBuy > windowStart ? earliestBuy : windowStart;

  const symbols = [...new Set(assets.map((asset) => asset.symbol))];
  const quotes = await getQuotes(symbols);
  const factors = await getEurFactors(
    assets.flatMap((asset) => [
      quotes.get(asset.symbol)?.currency ?? asset.currency,
      asset.buyCurrency ?? asset.currency,
    ]),
  );

  const histories = new Map<string, Candle[]>();
  await Promise.all(
    symbols.map(async (symbol) => {
      histories.set(symbol, await getHistory(symbol, from));
    }),
  );

  const tradingDays = [
    ...new Set([...histories.values()].flatMap((candles) => candles.map((c) => c.date))),
  ].sort();
  if (tradingDays.length === 0) return [];

  // Pro Symbol ein Index Datum -> Schlusskurs, plus Forward-Fill: fehlt ein Tag
  // (Feiertag an einer Börse, aber nicht an der anderen), gilt der letzte Kurs weiter.
  const closesBySymbol = new Map<string, Map<string, number>>();
  for (const symbol of symbols) {
    const candles = histories.get(symbol) ?? [];
    const byDate = new Map(candles.map((c) => [c.date, c.close]));
    const filled = new Map<string, number>();
    let last: number | null = null;
    for (const day of tradingDays) {
      const close = byDate.get(day);
      if (close !== undefined) last = close;
      if (last !== null) filled.set(day, last);
    }
    closesBySymbol.set(symbol, filled);
  }

  const series: SeriesPoint[] = [];
  for (const day of tradingDays) {
    let value = 0;
    let invested = 0;
    let priced = false;

    for (const asset of assets) {
      if (toIsoDate(asset.buyDate) > day) continue;

      const currency = (quotes.get(asset.symbol)?.currency ?? asset.currency).toUpperCase();
      const factor = factors.get(currency);
      if (factor === undefined) continue;

      // Der Einsatz wird mit dem Kurs vom Kauftag bewertet, sofern bekannt —
      // sonst bewegt sich die Referenzlinie mit dem heutigen Wechselkurs mit.
      const buyCurrency = (asset.buyCurrency ?? asset.currency).toUpperCase();
      const buyRate = asset.buyFxRate ?? factors.get(buyCurrency);
      if (buyRate === undefined) continue;
      invested += asset.shares * centsToNumber(asset.buyPrice) * buyRate;

      const close = closesBySymbol.get(asset.symbol)?.get(day);
      if (close === undefined) continue;

      value += asset.shares * close * factor;
      priced = true;
    }

    // Tage vor dem ersten Kauf (bzw. ohne jeden Kurs) erzeugen keinen Punkt.
    if (priced) series.push({ date: day, value, invested });
  }

  return series;
}

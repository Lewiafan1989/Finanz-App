import "server-only";
import YahooFinance from "yahoo-finance2";
import { db } from "@/lib/db";

/**
 * Kursbeschaffung mit DB-Puffer.
 *
 * Ohne Puffer würde jeder Seitenaufruf Yahoo treffen: das kostet 1-3 s Ladezeit und
 * läuft nach ein paar Reloads ins Rate-Limit. Deshalb liegt der letzte bekannte Kurs
 * in `PriceCache`; erst wenn er älter als STALE_MS ist, wird nachgeladen. Schlägt der
 * Abruf fehl (kein Netz, Yahoo down), rendert die App weiter mit dem Cache-Stand und
 * markiert ihn als veraltet, statt zu crashen.
 */

const yf = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
  validation: { logErrors: false },
});

const STALE_MS = 15 * 60 * 1000;
/** EOD-Historie ändert sich untertags nicht — im Prozessspeicher reicht ein grober TTL. */
const HISTORY_TTL_MS = 12 * 60 * 60 * 1000;

export type Quote = {
  symbol: string;
  price: number;
  currency: string;
  previousClose: number | null;
  shortName: string | null;
  fetchedAt: Date;
  /** true = Yahoo war nicht erreichbar, der Wert stammt aus dem Puffer. */
  stale: boolean;
};

export type Candle = { date: string; close: number };

function normalize(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/**
 * Untereinheiten in die Hauptwährung überführen.
 *
 * Einige Börsen notieren nicht in der Währung selbst: London in Pence ("GBp"),
 * Tel Aviv in Agorot ("ILA"), Johannesburg in Cent ("ZAc"). Yahoo gibt diese
 * Codes unverändert zurück, ein FX-Paar dazu gibt es aber nur für die
 * Hauptwährung. Ohne Umrechnung an der Quelle passiert beides: `Intl` schreibt
 * ein Pfundzeichen an einen Pence-Betrag (Faktor 100 zu hoch), und die Position
 * findet keinen EUR-Faktor und fällt still aus allen Summen.
 *
 * Groß-/Kleinschreibung ist hier bedeutungstragend — "GBp" ist Pence, "GBP" ist
 * Pfund. Deshalb wird exakt verglichen, nicht normalisiert.
 */
const MINOR_UNITS: Record<string, { major: string; per: number }> = {
  GBp: { major: "GBP", per: 100 },
  GBX: { major: "GBP", per: 100 },
  ILA: { major: "ILS", per: 100 },
  ZAc: { major: "ZAR", per: 100 },
};

function toMajorUnit<T extends number | null>(
  price: T,
  currency: string,
): { price: T; currency: string } {
  const unit = MINOR_UNITS[currency.trim()];
  if (!unit) return { price, currency: currency.trim().toUpperCase() };
  return {
    price: (price === null ? null : price / unit.per) as T,
    currency: unit.major,
  };
}

/**
 * Kurse für mehrere Symbole. Veraltete werden in EINEM Batch-Request nachgeladen.
 * Symbole, die Yahoo nicht kennt und die auch nicht im Puffer liegen, fehlen im Ergebnis.
 */
export async function getQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const wanted = [...new Set(symbols.map(normalize))].filter(Boolean);
  if (wanted.length === 0) return new Map();

  const cached = await db.priceCache.findMany({ where: { symbol: { in: wanted } } });
  const result = new Map<string, Quote>();
  const now = Date.now();

  for (const row of cached) {
    // Auch der Puffer wird umgerechnet: Zeilen aus der Zeit vor dieser Regel
    // liegen sonst weiter in Pence in der DB.
    const major = toMajorUnit(row.price, row.currency);
    result.set(row.symbol, {
      symbol: row.symbol,
      price: major.price,
      currency: major.currency,
      previousClose: toMajorUnit(row.previousClose, row.currency).price,
      shortName: row.shortName,
      fetchedAt: row.fetchedAt,
      stale: now - row.fetchedAt.getTime() > STALE_MS,
    });
  }

  const outdated = wanted.filter((symbol) => {
    const hit = result.get(symbol);
    return !hit || hit.stale;
  });

  if (outdated.length > 0) {
    try {
      const fresh = await yf.quote(outdated);
      for (const row of fresh) {
        const price = row.regularMarketPrice;
        if (typeof price !== "number") continue;

        const major = toMajorUnit(price, row.currency ?? "USD");
        const quote: Quote = {
          symbol: normalize(row.symbol),
          price: major.price,
          currency: major.currency,
          previousClose: toMajorUnit(
            row.regularMarketPreviousClose ?? null,
            row.currency ?? "USD",
          ).price,
          shortName: row.shortName ?? row.longName ?? null,
          fetchedAt: new Date(),
          stale: false,
        };

        result.set(quote.symbol, quote);
        await db.priceCache.upsert({
          where: { symbol: quote.symbol },
          create: {
            symbol: quote.symbol,
            price: quote.price,
            currency: quote.currency,
            previousClose: quote.previousClose,
            shortName: quote.shortName,
          },
          update: {
            price: quote.price,
            currency: quote.currency,
            previousClose: quote.previousClose,
            shortName: quote.shortName,
          },
        });
      }
    } catch (error) {
      // Bewusst kein Rethrow: der gepufferte Stand ist besser als eine Fehlerseite.
      console.error("[quotes] Kursabruf fehlgeschlagen, nutze Puffer:", error);
    }
  }

  return result;
}

/** Einzelnes Symbol frisch prüfen — für die Ticker-Validierung im Asset-Formular. */
export async function lookupSymbol(symbol: string): Promise<Quote | null> {
  const normalized = normalize(symbol);
  try {
    const [row] = await yf.quote([normalized]);
    if (!row || typeof row.regularMarketPrice !== "number") return null;

    const major = toMajorUnit(row.regularMarketPrice, row.currency ?? "USD");
    const quote: Quote = {
      symbol: normalize(row.symbol),
      price: major.price,
      currency: major.currency,
      previousClose: toMajorUnit(row.regularMarketPreviousClose ?? null, row.currency ?? "USD")
        .price,
      shortName: row.shortName ?? row.longName ?? null,
      fetchedAt: new Date(),
      stale: false,
    };

    await db.priceCache.upsert({
      where: { symbol: quote.symbol },
      create: {
        symbol: quote.symbol,
        price: quote.price,
        currency: quote.currency,
        previousClose: quote.previousClose,
        shortName: quote.shortName,
      },
      update: {
        price: quote.price,
        currency: quote.currency,
        previousClose: quote.previousClose,
        shortName: quote.shortName,
      },
    });

    return quote;
  } catch (error) {
    console.error(`[quotes] Symbol "${normalized}" konnte nicht geprüft werden:`, error);
    return null;
  }
}

/**
 * Umrechnungsfaktoren in die Basiswährung EUR: Betrag * Faktor = Betrag in EUR.
 * Yahoo notiert "EURUSD=X" als USD je EUR, der Faktor ist also der Kehrwert.
 */
export async function getEurFactors(currencies: string[]): Promise<Map<string, number>> {
  const wanted = [...new Set(currencies.map((c) => c.trim().toUpperCase()))].filter(
    (c) => c && c !== "EUR",
  );

  const factors = new Map<string, number>([["EUR", 1]]);
  if (wanted.length === 0) return factors;

  const pairs = wanted.map((currency) => `EUR${currency}=X`);
  const quotes = await getQuotes(pairs);

  for (const currency of wanted) {
    const pair = quotes.get(`EUR${currency}=X`);
    if (pair && pair.price > 0) {
      factors.set(currency, 1 / pair.price);
    } else {
      // Kein Kurs verfügbar: 1:1 rechnen wäre stillschweigend falsch, also
      // meldet der Aufrufer über das fehlende Mapping "Umrechnung unbekannt".
      console.warn(`[quotes] Kein FX-Kurs für ${currency}, Umrechnung übersprungen.`);
    }
  }

  return factors;
}

/**
 * EUR je Einheit `currency` am Stichtag (End-of-Day).
 *
 * Für den Einstand eines Kaufs: ohne diesen Kurs müsste der Einsatz mit dem
 * heutigen Wechselkurs bewertet werden, und der Währungsanteil der Rendite
 * bliebe unsichtbar. Fällt der Kauftag auf ein Wochenende oder einen Feiertag,
 * gilt der letzte Kurs davor — deshalb der Vorlauf im Abrufzeitraum.
 */
export async function getEurRateOn(currency: string, date: Date): Promise<number | null> {
  const code = currency.trim().toUpperCase();
  if (!code) return null;
  if (code === "EUR") return 1;

  const from = new Date(date.getTime() - 14 * 24 * 60 * 60 * 1000);
  const candles = await getHistory(`EUR${code}=X`, from);
  const day = date.toISOString().slice(0, 10);

  const last = candles.filter((candle) => candle.date <= day && candle.close > 0).at(-1);
  return last ? 1 / last.close : null;
}

const historyCache = new Map<string, { at: number; candles: Candle[] }>();

/** Tägliche Schlusskurse ab `from` (EOD). Ergebnis liegt für 12 h im Prozessspeicher. */
export async function getHistory(symbol: string, from: Date): Promise<Candle[]> {
  const normalized = normalize(symbol);
  const key = `${normalized}|${from.toISOString().slice(0, 10)}`;
  const hit = historyCache.get(key);
  if (hit && Date.now() - hit.at < HISTORY_TTL_MS) return hit.candles;

  try {
    const chart = await yf.chart(normalized, { period1: from, interval: "1d" });
    const currency = chart.meta.currency ?? "USD";
    const candles: Candle[] = chart.quotes
      .filter((row): row is typeof row & { close: number } => typeof row.close === "number")
      .map((row) => ({
        date: new Date(row.date).toISOString().slice(0, 10),
        close: toMajorUnit(row.close, currency).price,
      }));

    historyCache.set(key, { at: Date.now(), candles });
    return candles;
  } catch (error) {
    console.error(`[quotes] Historie für "${normalized}" fehlgeschlagen:`, error);
    return hit?.candles ?? [];
  }
}

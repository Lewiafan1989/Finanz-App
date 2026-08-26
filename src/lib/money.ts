/**
 * Geld wird in der App durchgehend als ganzzahliger Cent-Betrag geführt.
 * Float-Arithmetik auf Euro-Beträgen driftet (0.1 + 0.2 !== 0.3) und das
 * summiert sich über eine Transaktionsliste sichtbar auf.
 */

/** Nutzereingabe ("1.234,56", "1234.56", "12") -> Cent. `null` = nicht parsebar. */
export function parseAmountToCents(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;

  // Deutsche und englische Schreibweise: letzter Separator ist das Dezimaltrennzeichen.
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  const decimalSep = lastComma > lastDot ? "," : lastDot > lastComma ? "." : null;

  let normalized = raw;
  if (decimalSep) {
    const thousandsSep = decimalSep === "," ? "." : ",";
    normalized = raw.split(thousandsSep).join("").replace(decimalSep, ".");
  } else {
    normalized = raw.split(",").join("").split(".").join("");
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  return Math.round(value * 100);
}

export const centsToNumber = (cents: number): number => cents / 100;
export const toCents = (value: number): number => Math.round(value * 100);

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatEUR = (cents: number): string => eur.format(cents / 100);

/** Für Kurse & Werte, die schon als Euro-Zahl (nicht Cent) vorliegen. */
export const formatEURFromNumber = (value: number): string => eur.format(value);

const eurSigned = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

/** Für Differenzen, bei denen die Richtung zum Wert gehört (z. B. Währungseffekt). */
export const formatEURSigned = (value: number): string => eurSigned.format(value);

export function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(ratio);
}

/** Vorzeichenbehafteter Cent-Betrag einer Transaktion. */
export const signedCents = (amount: number, type: "INCOME" | "EXPENSE"): number =>
  type === "INCOME" ? amount : -amount;

/** Achsenbeschriftung: "9,5 Tsd. €" statt "9.520,21 €". */
const eurCompact = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

export const formatEURCompact = (value: number): string => eurCompact.format(value);

/**
 * Datumsfelder werden als UTC-Mitternacht gespeichert. Würden wir lokale Zeitzonen
 * mischen, landet eine am 1. um 00:30 MESZ erfasste Buchung im Vormonat.
 */

export const parseIsoDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

export const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

/** "2026-08" -> [1.8.2026 00:00 UTC, 1.9.2026 00:00 UTC) */
export function monthRange(month: string): { start: Date; end: Date } {
  const [year, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, m - 1, 1));
  const end = new Date(Date.UTC(year, m, 1));
  return { start, end };
}

export const currentMonth = (): string => toIsoDate(new Date()).slice(0, 7);

export const isValidMonth = (value: string): boolean => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

export function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, m - 1, 1)),
  );
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(date);
}

/** Liste der letzten `count` Monate, neuester zuerst — für den Monatsfilter. */
export function recentMonths(count: number, from = new Date()): string[] {
  const months: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - i, 1));
    months.push(toIsoDate(d).slice(0, 7));
  }
  return months;
}

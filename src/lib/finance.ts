import "server-only";
import { db } from "@/lib/db";
import { monthRange } from "@/lib/dates";
import { centsToNumber } from "@/lib/money";
import { getPortfolio, type Portfolio } from "@/lib/portfolio";
import type { Category } from "@/generated/prisma/enums";
import type { Transaction } from "@/generated/prisma/client";

export type CashSummary = {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
};

async function sumBy(where: object): Promise<CashSummary> {
  const grouped = await db.transaction.groupBy({
    by: ["type"],
    where,
    _sum: { amount: true },
  });

  const incomeCents = grouped.find((row) => row.type === "INCOME")?._sum.amount ?? 0;
  const expenseCents = grouped.find((row) => row.type === "EXPENSE")?._sum.amount ?? 0;

  return { incomeCents, expenseCents, balanceCents: incomeCents - expenseCents };
}

/** Kassenstand über alle erfassten Buchungen. */
export const getCashBalance = (): Promise<CashSummary> => sumBy({});

export function getMonthSummary(month: string): Promise<CashSummary> {
  const { start, end } = monthRange(month);
  return sumBy({ date: { gte: start, lt: end } });
}

export function getTransactions(month?: string): Promise<Transaction[]> {
  const where = month ? { date: { gte: monthRange(month).start, lt: monthRange(month).end } } : {};
  return db.transaction.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
}

export type CategorySlice = { category: Category; cents: number };

/** Ausgabenverteilung, absteigend. Ohne `month` über den gesamten Zeitraum. */
export async function getExpensesByCategory(month?: string): Promise<CategorySlice[]> {
  const where = month
    ? { type: "EXPENSE" as const, date: { gte: monthRange(month).start, lt: monthRange(month).end } }
    : { type: "EXPENSE" as const };

  const grouped = await db.transaction.groupBy({
    by: ["category"],
    where,
    _sum: { amount: true },
  });

  return grouped
    .map((row) => ({ category: row.category, cents: row._sum.amount ?? 0 }))
    .filter((row) => row.cents > 0)
    .sort((a, b) => b.cents - a.cents);
}

/**
 * Monatliche Fixkosten aus den wiederkehrenden Ausgaben.
 *
 * Eine wiederkehrende Buchung wird jeden Monat erneut erfasst — würde man alle
 * Instanzen aufsummieren, käme bei sechs Monaten Historie das Sechsfache der Miete
 * heraus. Gezählt wird deshalb je Serie nur die jüngste Buchung; als Serienschlüssel
 * dient Kategorie + Notiz + Intervall. Jahresposten gehen mit einem Zwölftel ein.
 */
export async function getRecurringMonthlyCents(): Promise<number> {
  const recurring = await db.transaction.findMany({
    where: { type: "EXPENSE", recurrence: { in: ["MONTHLY", "YEARLY"] } },
    select: { amount: true, recurrence: true, category: true, note: true },
    orderBy: { date: "desc" },
  });

  const latestPerSeries = new Map<string, { amount: number; recurrence: "MONTHLY" | "YEARLY" }>();
  for (const row of recurring) {
    const key = `${row.category}|${row.note ?? ""}|${row.recurrence}`;
    if (latestPerSeries.has(key)) continue;
    latestPerSeries.set(key, {
      amount: row.amount,
      recurrence: row.recurrence as "MONTHLY" | "YEARLY",
    });
  }

  return Math.round(
    [...latestPerSeries.values()].reduce(
      (sum, row) => sum + (row.recurrence === "YEARLY" ? row.amount / 12 : row.amount),
      0,
    ),
  );
}

export type NetWorth = {
  cashEur: number;
  portfolioEur: number;
  totalEur: number;
  portfolio: Portfolio;
  cash: CashSummary;
};

/** Net Worth = Kassenstand aus dem Cashflow + aktueller Portfoliowert, beides in EUR. */
export async function getNetWorth(): Promise<NetWorth> {
  const [cash, portfolio] = await Promise.all([getCashBalance(), getPortfolio()]);
  const cashEur = centsToNumber(cash.balanceCents);

  return {
    cashEur,
    portfolioEur: portfolio.totalValueEur,
    totalEur: cashEur + portfolio.totalValueEur,
    portfolio,
    cash,
  };
}

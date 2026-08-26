import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { Category, Recurrence, TxType } from "../src/generated/prisma/enums";

/**
 * Demodaten: sechs Monate Haushalt plus drei Positionen in bewusst gemischten
 * Währungen (USD/EUR), damit die FX-Umrechnung sofort sichtbar getestet wird.
 */

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

// Fester Seed -> bei jedem Lauf dieselben Zahlen, damit Beträge im UI vergleichbar bleiben.
let rngState = 42;
function rand(): number {
  rngState = (rngState * 1103515245 + 12345) % 2147483648;
  return rngState / 2147483648;
}

const between = (min: number, max: number) => Math.round((min + rand() * (max - min)) * 100);

const utc = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day));

type Row = {
  amount: number;
  type: TxType;
  category: Category;
  date: Date;
  recurrence: Recurrence;
  note: string | null;
};

function buildTransactions(): Row[] {
  const rows: Row[] = [];
  const today = new Date();

  for (let back = 5; back >= 0; back -= 1) {
    const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1));
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();

    rows.push(
      { amount: 385000, type: "INCOME", category: "SALARY", date: utc(year, month, 1), recurrence: "MONTHLY", note: "Gehalt" },
      { amount: 125000, type: "EXPENSE", category: "RENT", date: utc(year, month, 3), recurrence: "MONTHLY", note: "Warmmiete" },
      { amount: 1799, type: "EXPENSE", category: "SUBSCRIPTION", date: utc(year, month, 5), recurrence: "MONTHLY", note: "Streaming" },
      { amount: 1199, type: "EXPENSE", category: "SUBSCRIPTION", date: utc(year, month, 5), recurrence: "MONTHLY", note: "Musik" },
      { amount: 2990, type: "EXPENSE", category: "HEALTH", date: utc(year, month, 8), recurrence: "MONTHLY", note: "Fitnessstudio" },
      { amount: 4900, type: "EXPENSE", category: "TRANSPORT", date: utc(year, month, 2), recurrence: "MONTHLY", note: "Deutschlandticket" },
      { amount: 50000, type: "EXPENSE", category: "SAVINGS", date: utc(year, month, 4), recurrence: "MONTHLY", note: "ETF-Sparplan" },
    );

    // Wocheneinkäufe
    for (const day of [4, 11, 18, 25]) {
      rows.push({
        amount: between(45, 130),
        type: "EXPENSE",
        category: "GROCERIES",
        date: utc(year, month, day),
        recurrence: "NONE",
        note: "Wocheneinkauf",
      });
    }

    rows.push({
      amount: between(25, 95),
      type: "EXPENSE",
      category: "LEISURE",
      date: utc(year, month, 14),
      recurrence: "NONE",
      note: rand() > 0.5 ? "Restaurant" : "Kino",
    });

    if (back % 2 === 0) {
      rows.push({
        amount: between(60, 180),
        type: "EXPENSE",
        category: "OTHER",
        date: utc(year, month, 21),
        recurrence: "NONE",
        note: "Anschaffung",
      });
    }

    // Jahresbeitrag Versicherung nur einmal im ältesten Monat
    if (back === 5) {
      rows.push({
        amount: 48000,
        type: "EXPENSE",
        category: "INSURANCE",
        date: utc(year, month, 15),
        recurrence: "YEARLY",
        note: "Haftpflicht + Hausrat",
      });
    }

    if (back === 3) {
      rows.push({
        amount: 65000,
        type: "INCOME",
        category: "OTHER",
        date: utc(year, month, 20),
        recurrence: "NONE",
        note: "Steuerrückerstattung",
      });
    }
  }

  return rows;
}

async function main() {
  await db.transaction.deleteMany();
  await db.asset.deleteMany();

  const rows = buildTransactions();
  await db.transaction.createMany({ data: rows });

  const now = new Date();
  const monthsAgo = (n: number) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, 15));

  await db.asset.createMany({
    data: [
      { symbol: "AAPL", shares: 12, buyPrice: 19500, currency: "USD", buyDate: monthsAgo(9) },
      { symbol: "MSFT", shares: 5, buyPrice: 41000, currency: "USD", buyDate: monthsAgo(4) },
      { symbol: "VWCE.DE", shares: 25, buyPrice: 11850, currency: "EUR", buyDate: monthsAgo(2) },
    ],
  });

  console.log(`Seed fertig: ${rows.length} Buchungen, 3 Positionen.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

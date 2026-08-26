import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { MonthFilter } from "@/components/month-filter";
import { TransactionForm } from "@/components/transaction-form";
import { TransactionList } from "@/components/transaction-list";
import { getCashBalance, getMonthSummary, getTransactions } from "@/lib/finance";
import { currentMonth, formatMonthLabel, isValidMonth, recentMonths, toIsoDate } from "@/lib/dates";
import { formatEUR } from "@/lib/money";

export default async function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  const params = await searchParams;
  const raw = typeof params.month === "string" ? params.month : undefined;
  // "all" und Müll in der URL fallen auf den aktuellen Monat bzw. den Gesamtzeitraum zurück.
  const month = raw && isValidMonth(raw) ? raw : raw === "all" ? undefined : currentMonth();

  const [transactions, summary] = await Promise.all([
    getTransactions(month),
    month ? getMonthSummary(month) : getCashBalance(),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
      <Card>
        <CardHeader title="Neue Buchung" hint="Einnahme oder Ausgabe manuell erfassen." />
        <CardBody>
          <TransactionForm defaultDate={toIsoDate(new Date())} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Transaktionen"
          hint={month ? formatMonthLabel(month) : "Gesamter Zeitraum"}
          action={<MonthFilter months={recentMonths(12)} value={month ?? "all"} />}
        />

        <div className="grid grid-cols-3 divide-x divide-border-base border-b border-border-base">
          <Summary label="Einnahmen" value={formatEUR(summary.incomeCents)} tone="text-positive" />
          <Summary label="Ausgaben" value={formatEUR(summary.expenseCents)} tone="text-negative" />
          <Summary
            label="Saldo"
            value={formatEUR(summary.balanceCents)}
            tone={summary.balanceCents < 0 ? "text-negative" : "text-text"}
          />
        </div>

        <CardBody className="py-1">
          <TransactionList transactions={transactions} />
        </CardBody>
      </Card>
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="px-5 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`tabular mt-0.5 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

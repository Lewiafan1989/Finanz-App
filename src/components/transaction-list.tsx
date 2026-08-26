import { deleteTransaction } from "@/app/actions/transactions";
import { CATEGORY_LABELS, RECURRENCE_LABELS } from "@/lib/categories";
import { formatDate } from "@/lib/dates";
import { formatEUR } from "@/lib/money";
import { DeleteButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import type { Transaction } from "@/generated/prisma/client";

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return <EmptyState>Für diesen Zeitraum sind keine Buchungen erfasst.</EmptyState>;
  }

  return (
    <ul className="divide-y divide-border-base">
      {transactions.map((tx) => {
        const income = tx.type === "INCOME";

        return (
          <li key={tx.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{CATEGORY_LABELS[tx.category]}</span>
                {tx.recurrence !== "NONE" ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
                    {RECURRENCE_LABELS[tx.recurrence]}
                  </span>
                ) : null}
              </div>
              <p className="truncate text-xs text-text-muted">
                {formatDate(tx.date)}
                {tx.note ? ` · ${tx.note}` : ""}
              </p>
            </div>

            <span
              className={`tabular shrink-0 text-sm font-semibold ${
                income ? "text-positive" : "text-text"
              }`}
            >
              {income ? "+" : "−"}
              {formatEUR(tx.amount)}
            </span>

            <form action={deleteTransaction}>
              <input type="hidden" name="id" value={tx.id} />
              <DeleteButton label={`Buchung vom ${formatDate(tx.date)} löschen`} />
            </form>
          </li>
        );
      })}
    </ul>
  );
}

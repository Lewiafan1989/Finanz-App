"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { formatMonthLabel } from "@/lib/dates";
import { Select } from "@/components/ui/field";

/**
 * Der Filter lebt in der URL (?month=2026-08), nicht im Component-State:
 * so bleibt die Auswahl beim Neuladen und beim Teilen des Links erhalten und die
 * Server Component kann direkt danach filtern.
 */
export function MonthFilter({ months, value }: { months: string[]; value: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function select(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("month");
    else params.set("month", next);

    const query = params.toString();
    startTransition(() => router.push(query ? `/transactions?${query}` : "/transactions"));
  }

  return (
    <label className="flex items-center gap-2 text-xs text-text-muted">
      Zeitraum
      <Select
        value={value}
        onChange={(event) => select(event.target.value)}
        disabled={isPending}
        className="w-auto py-1.5"
        aria-label="Monat filtern"
      >
        <option value="all">Alle Monate</option>
        {months.map((month) => (
          <option key={month} value={month}>
            {formatMonthLabel(month)}
          </option>
        ))}
      </Select>
    </label>
  );
}

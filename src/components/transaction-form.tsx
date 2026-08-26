"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { addTransaction } from "@/app/actions/transactions";
import { CATEGORY_LABELS, SUGGESTED_BY_TYPE, TYPE_LABELS } from "@/lib/categories";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";
import type { ActionState } from "@/lib/validation";
import type { TxType } from "@/generated/prisma/enums";

const INITIAL: ActionState = { ok: false };

export function TransactionForm({ defaultDate }: { defaultDate: string }) {
  const [state, formAction] = useActionState(addTransaction, INITIAL);
  const [type, setType] = useState<TxType>("EXPENSE");
  const formRef = useRef<HTMLFormElement>(null);

  // Nach erfolgreichem Speichern das Formular leeren, aber den Typ stehen lassen —
  // meist werden mehrere Buchungen derselben Art nacheinander erfasst. Der Effekt
  // fasst bewusst keinen React-State an, er räumt nur das DOM auf.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const errors = state.errors ?? {};

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="type" value={type} />

      <div
        role="radiogroup"
        aria-label="Art der Buchung"
        className="grid grid-cols-2 gap-1 rounded-lg bg-surface-muted p-1"
      >
        {(["EXPENSE", "INCOME"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={type === option}
            onClick={() => setType(option)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-sm font-medium transition",
              type === option
                ? option === "INCOME"
                  ? "bg-positive-soft text-positive"
                  : "bg-negative-soft text-negative"
                : "text-text-muted hover:text-text",
            )}
          >
            {TYPE_LABELS[option]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Betrag (€)" htmlFor="amount" error={errors.amount}>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            placeholder="49,90"
            autoComplete="off"
            aria-invalid={Boolean(errors.amount)}
            aria-describedby={errors.amount ? "amount-error" : undefined}
          />
        </Field>

        <Field label="Datum" htmlFor="date" error={errors.date}>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={defaultDate}
            aria-invalid={Boolean(errors.date)}
          />
        </Field>
      </div>

      <Field label="Kategorie" htmlFor="category" error={errors.category}>
        <Select id="category" name="category" defaultValue="" aria-invalid={Boolean(errors.category)}>
          <option value="" disabled>
            Bitte wählen …
          </option>
          {SUGGESTED_BY_TYPE[type].map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Notiz (optional)" htmlFor="note" error={errors.note}>
        <Textarea id="note" name="note" rows={2} maxLength={200} placeholder="z. B. Wocheneinkauf" />
      </Field>

      {/* Das Intervallfeld hängt per CSS an der Checkbox statt an React-State:
          so setzt form.reset() beides gemeinsam zurück. */}
      <div className="group flex flex-col gap-3 rounded-lg bg-surface-muted px-4 py-3">
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="isRecurring" className="size-4 accent-[var(--accent)]" />
          Wiederkehrend (Abo, Miete, Gehalt …)
        </label>

        <div className="hidden group-has-checked:block">
          <Field label="Intervall" htmlFor="recurrenceInterval" error={errors.recurrence}>
            <Select id="recurrenceInterval" name="recurrenceInterval" defaultValue="MONTHLY">
              <option value="MONTHLY">Monatlich</option>
              <option value="YEARLY">Jährlich</option>
            </Select>
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>Buchung hinzufügen</SubmitButton>
        {state.ok && state.message ? (
          <span role="status" className="text-xs text-positive">
            {state.message}
          </span>
        ) : null}
        {errors.form ? (
          <span role="alert" className="text-xs text-negative">
            {errors.form}
          </span>
        ) : null}
      </div>
    </form>
  );
}

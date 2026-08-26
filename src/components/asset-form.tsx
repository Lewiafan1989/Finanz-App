"use client";

import { useActionState, useEffect, useRef } from "react";
import { addAsset } from "@/app/actions/assets";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";
import type { ActionState } from "@/lib/validation";

const INITIAL: ActionState = { ok: false };

/**
 * Wer ein US-Papier über eine deutsche Börse kauft, zahlt in EUR — der Kaufpreis
 * steht dann nicht in der Notierungswährung. Ohne diese Angabe würde der Einstand
 * stillschweigend als USD verbucht.
 */
const BUY_CURRENCIES = ["EUR", "USD", "CHF", "GBP"] as const;

export function AssetForm({ defaultDate }: { defaultDate: string }) {
  const [state, formAction] = useActionState(addAsset, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const errors = state.errors ?? {};

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <Field
        label="Ticker-Symbol"
        htmlFor="symbol"
        error={errors.symbol}
        hint="Yahoo-Schreibweise, z. B. AAPL, SAP.DE, VWCE.DE"
      >
        <Input
          id="symbol"
          name="symbol"
          placeholder="AAPL"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={Boolean(errors.symbol)}
          className="font-mono uppercase"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Anzahl" htmlFor="shares" error={errors.shares}>
          <Input
            id="shares"
            name="shares"
            inputMode="decimal"
            placeholder="10"
            autoComplete="off"
            aria-invalid={Boolean(errors.shares)}
          />
        </Field>

        <Field
          label="Kaufpreis je Anteil"
          htmlFor="buyPrice"
          error={errors.buyPrice}
          hint="In der gewählten Kaufwährung."
        >
          <Input
            id="buyPrice"
            name="buyPrice"
            inputMode="decimal"
            placeholder="195,00"
            autoComplete="off"
            aria-invalid={Boolean(errors.buyPrice)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Kaufwährung"
          htmlFor="buyCurrency"
          error={errors.buyCurrency}
          hint="Abrechnungswährung deiner Order — nicht zwingend die des Papiers."
        >
          <Select id="buyCurrency" name="buyCurrency" defaultValue="">
            <option value="">Automatisch</option>
            {BUY_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Kaufdatum" htmlFor="buyDate" error={errors.buyDate}>
          <Input
            id="buyDate"
            name="buyDate"
            type="date"
            defaultValue={defaultDate}
            aria-invalid={Boolean(errors.buyDate)}
          />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Kurs wird geprüft …">Position hinzufügen</SubmitButton>
        {state.ok && state.message ? (
          <span role="status" className="text-xs text-positive">
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

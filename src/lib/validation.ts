import { z } from "zod";
import { parseAmountToCents } from "@/lib/money";
import { CATEGORIES } from "@/lib/categories";

/** Betragsfeld: nimmt "12,50" wie "12.50" entgegen und liefert Cent > 0. */
const amountCents = z
  .string()
  .trim()
  .min(1, "Bitte einen Betrag angeben.")
  .transform((value, ctx) => {
    const cents = parseAmountToCents(value);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Keine gültige Zahl." });
      return z.NEVER;
    }
    if (cents <= 0) {
      ctx.addIssue({ code: "custom", message: "Der Betrag muss größer als 0 sein." });
      return z.NEVER;
    }
    return cents;
  });

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte ein Datum wählen.")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Ungültiges Datum.");

export const transactionSchema = z.object({
  amount: amountCents,
  type: z.enum(["INCOME", "EXPENSE"], { error: "Bitte Einnahme oder Ausgabe wählen." }),
  category: z.enum(CATEGORIES, { error: "Bitte eine Kategorie wählen." }),
  date: isoDate,
  recurrence: z.enum(["NONE", "MONTHLY", "YEARLY"], { error: "Ungültiges Intervall." }).default("NONE"),
  note: z
    .string()
    .trim()
    .max(200, "Höchstens 200 Zeichen.")
    .optional()
    .transform((value) => (value ? value : null)),
});

export const assetSchema = z.object({
  // Yahoo-Ticker enthalten Punkte, Bindestriche und Zirkumflex: "VWCE.DE", "BRK-B", "^GDAXI".
  symbol: z
    .string()
    .trim()
    .min(1, "Bitte ein Ticker-Symbol angeben.")
    .max(20, "Symbol ist zu lang.")
    .regex(/^[A-Za-z0-9.\-^=]+$/, "Nur Buchstaben, Ziffern, . - ^ = erlaubt.")
    .transform((value) => value.toUpperCase()),
  shares: z
    .string()
    .trim()
    .min(1, "Bitte die Anzahl angeben.")
    .transform((value, ctx) => {
      const parsed = Number(value.replace(",", "."));
      if (!Number.isFinite(parsed)) {
        ctx.addIssue({ code: "custom", message: "Keine gültige Zahl." });
        return z.NEVER;
      }
      if (parsed <= 0) {
        ctx.addIssue({ code: "custom", message: "Die Anzahl muss größer als 0 sein." });
        return z.NEVER;
      }
      return parsed;
    }),
  buyPrice: amountCents,
  // Leer = automatisch, dann gilt die Notierungswährung aus dem Yahoo-Quote.
  buyCurrency: z
    .string()
    .transform((value) => value.trim().toUpperCase())
    .refine(
      (value) => value === "" || /^[A-Z]{3}$/.test(value),
      "Bitte eine Währung im ISO-Format wählen (z. B. EUR).",
    )
    .transform((value) => (value === "" ? null : value)),
  buyDate: isoDate,
});

export const idSchema = z.string().trim().min(1);

export type TransactionInput = z.infer<typeof transactionSchema>;
export type AssetInput = z.infer<typeof assetSchema>;

/** Rückgabeform aller Server Actions — Fehler werden zurückgegeben, nicht geworfen. */
export type ActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

/** Zod-Fehler auf { feldname: "erste meldung" } eindampfen, wie das Formular sie braucht. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

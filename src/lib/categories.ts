import type { Category, Recurrence, TxType } from "@/generated/prisma/enums";

export const CATEGORIES = [
  "SALARY",
  "RENT",
  "GROCERIES",
  "SUBSCRIPTION",
  "TRANSPORT",
  "LEISURE",
  "HEALTH",
  "INSURANCE",
  "SAVINGS",
  "OTHER",
] as const satisfies readonly Category[];

export const CATEGORY_LABELS: Record<Category, string> = {
  SALARY: "Gehalt",
  RENT: "Miete",
  GROCERIES: "Essen",
  SUBSCRIPTION: "Abo",
  TRANSPORT: "Transport",
  LEISURE: "Freizeit",
  HEALTH: "Gesundheit",
  INSURANCE: "Versicherung",
  SAVINGS: "Sparen",
  OTHER: "Sonstiges",
};

export const TYPE_LABELS: Record<TxType, string> = {
  INCOME: "Einnahme",
  EXPENSE: "Ausgabe",
};

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  NONE: "Einmalig",
  MONTHLY: "Monatlich",
  YEARLY: "Jährlich",
};

/** Kategorien, die bei einem Typ zuerst angeboten werden — reine UI-Hilfe, keine Einschränkung. */
export const SUGGESTED_BY_TYPE: Record<TxType, Category[]> = {
  INCOME: ["SALARY", "SAVINGS", "OTHER"],
  EXPENSE: [
    "RENT",
    "GROCERIES",
    "SUBSCRIPTION",
    "TRANSPORT",
    "LEISURE",
    "HEALTH",
    "INSURANCE",
    "OTHER",
  ],
};

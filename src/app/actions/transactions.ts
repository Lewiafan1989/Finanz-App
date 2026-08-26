"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parseIsoDate } from "@/lib/dates";
import { fieldErrors, idSchema, transactionSchema, type ActionState } from "@/lib/validation";

/**
 * Actions geben Fehler als Wert zurück statt zu werfen: `useActionState` im Formular
 * kann sie dann direkt am jeweiligen Feld rendern, ohne Error Boundary.
 */

/**
 * Net Worth hängt an beiden Tabellen, jede Mutation betrifft also jede Seite.
 *
 * Der "layout"-Scope ist hier nicht die Holzhammer-Variante, sondern die richtige:
 * revalidatePath("/") allein invalidiert nur den Page-Eintrag, und der Client-Router
 * frischt nach einer Action verlässlich nur die Route auf, auf der man gerade steht.
 * Der gecachte RSC-Payload der anderen Seiten würde weiter ausgeliefert — man löscht
 * eine Position im Portfolio und das Dashboard zeigt sie beim Zurückklicken noch.
 */
function refresh() {
  revalidatePath("/", "layout");
}

export async function addTransaction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const isRecurring = formData.get("isRecurring") === "on";

  const parsed = transactionSchema.safeParse({
    amount: String(formData.get("amount") ?? ""),
    type: String(formData.get("type") ?? ""),
    category: String(formData.get("category") ?? ""),
    date: String(formData.get("date") ?? ""),
    recurrence: isRecurring ? String(formData.get("recurrenceInterval") ?? "MONTHLY") : "NONE",
    note: String(formData.get("note") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const { amount, type, category, date, recurrence, note } = parsed.data;

  await db.transaction.create({
    data: { amount, type, category, date: parseIsoDate(date), recurrence, note },
  });

  refresh();
  return { ok: true, message: "Buchung gespeichert." };
}

export async function deleteTransaction(formData: FormData): Promise<void> {
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) return;

  try {
    await db.transaction.delete({ where: { id: parsed.data } });
  } catch (error) {
    // Kein Rethrow: ein Doppelklick auf Löschen soll keine Fehlerseite erzeugen.
    console.error(`[transactions] Löschen von ${parsed.data} fehlgeschlagen:`, error);
    return;
  }

  refresh();
}

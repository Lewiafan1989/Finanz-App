"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parseIsoDate } from "@/lib/dates";
import { getEurRateOn, lookupSymbol } from "@/lib/quotes";
import { assetSchema, fieldErrors, idSchema, type ActionState } from "@/lib/validation";

/** Siehe transactions.ts: der "layout"-Scope räumt auch den Client-Router-Cache
 *  der jeweils anderen Seiten ab. */
function refresh() {
  revalidatePath("/", "layout");
}

export async function addAsset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = assetSchema.safeParse({
    symbol: String(formData.get("symbol") ?? ""),
    shares: String(formData.get("shares") ?? ""),
    buyPrice: String(formData.get("buyPrice") ?? ""),
    buyCurrency: String(formData.get("buyCurrency") ?? ""),
    buyDate: String(formData.get("buyDate") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const { symbol, shares, buyPrice, buyCurrency, buyDate } = parsed.data;

  // Ticker gegen Yahoo prüfen, bevor er in der DB landet: sonst taucht ein Tippfehler
  // später als dauerhaft kursloses Papier in der Tabelle auf. Der Aufruf füllt
  // nebenbei den Kurspuffer und liefert die echte Notierungswährung.
  const quote = await lookupSymbol(symbol);
  if (!quote) {
    return {
      ok: false,
      errors: {
        symbol: `"${symbol}" wurde bei Yahoo Finance nicht gefunden (oder der Abruf ist gerade nicht möglich).`,
      },
    };
  }

  const purchaseDate = parseIsoDate(buyDate);
  // Ohne Angabe gilt die Notierungswährung des Papiers.
  const currency = buyCurrency ?? quote.currency;

  // Wechselkurs vom Kauftag festhalten: nur damit lässt sich der Einsatz später
  // vom Währungseffekt trennen. Fehlt er (kein FX-Kurs für den Tag), rechnet die
  // Bewertung wie bisher mit dem aktuellen Kurs.
  const buyFxRate = await getEurRateOn(currency, purchaseDate);

  await db.asset.create({
    data: {
      symbol: quote.symbol,
      shares,
      buyPrice,
      currency: quote.currency,
      buyCurrency: currency,
      buyFxRate,
      buyDate: purchaseDate,
    },
  });

  refresh();
  return {
    ok: true,
    message:
      buyFxRate === null && currency !== "EUR"
        ? `${quote.symbol} hinzugefügt — für den Kauftag gab es keinen ${currency}-Wechselkurs, der Einstand wird mit dem heutigen bewertet.`
        : `${quote.symbol} hinzugefügt.`,
  };
}

export async function deleteAsset(formData: FormData): Promise<void> {
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) return;

  try {
    await db.asset.delete({ where: { id: parsed.data } });
  } catch (error) {
    console.error(`[assets] Löschen von ${parsed.data} fehlgeschlagen:`, error);
    return;
  }

  refresh();
}

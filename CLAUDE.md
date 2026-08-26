# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Projekt

Lokale Personal-Finance-App (Next.js 16 App Router, React 19, Prisma 7 auf SQLite,
Tailwind 4, Recharts). Manueller Cashflow + Wertpapier-Portfolio mit Yahoo-Finance-Kursen,
zusammengeführt zu einem Net Worth. UI-Sprache und Code-Kommentare sind Deutsch —
neue Kommentare, Labels und Fehlermeldungen ebenfalls auf Deutsch schreiben.

## Befehle

```bash
npm run dev          # Dev-Server (Turbopack), http://localhost:3000
npm run build        # Produktionsbuild
npm run typecheck    # tsc --noEmit
npm run lint         # eslint

npm run db:generate  # Prisma Client nach src/generated/prisma erzeugen
npm run db:migrate   # Migration erstellen + anwenden
npm run db:reset     # DB verwerfen, migrieren, neu seeden
npm run seed         # prisma/seed.ts (6 Monate Haushalt + 3 Positionen)
npm run db:studio    # Prisma Studio
```

Es gibt kein Testframework. Verifikation läuft über `npm run typecheck` und `npm run lint`;
für Verhalten die App starten (`npm run dev`).

Nach jeder Änderung an `prisma/schema.prisma` muss `npm run db:generate` laufen — der
Client liegt unter `src/generated/prisma` und ist gitignored, ein frischer Checkout
kompiliert ohne ihn nicht.

## Architektur

Datenfluss: Server Component (`src/app/**/page.tsx`) → Aggregatfunktion aus `src/lib/`
→ Prisma (`src/lib/db.ts`). Mutationen laufen ausschließlich über Server Actions in
`src/app/actions/`. Client Components (`"use client"`) gibt es nur für Formulare,
Charts und den Monatsfilter — sie greifen nie selbst auf die DB zu.

`src/lib/` ist die Domänenschicht, die Pages sind dünn:

| Modul | Rolle |
|---|---|
| `db.ts` | Prisma-Singleton am `globalThis` (better-sqlite3-Adapter), Hot-Reload-sicher |
| `money.ts` | Cent-Arithmetik, Parsing von "1.234,56", alle `Intl`-Formatierer |
| `dates.ts` | UTC-Mitternacht, `monthRange()`, deutsche Datumsformate |
| `validation.ts` | zod-Schemas + `ActionState`, geteilt von Formular und Action |
| `quotes.ts` | Yahoo-Abruf, `PriceCache`, FX-Faktoren, EOD-Historie |
| `portfolio.ts` | Lots → Positionen, Bewertung in EUR, Wertreihe |
| `finance.ts` | Cashflow-Aggregate, Fixkosten, Net Worth |
| `categories.ts` | Enum-Werte + deutsche Labels |

`quotes.ts`, `portfolio.ts` und `finance.ts` importieren `server-only` — nicht aus
Client Components importieren.

## Konventionen, die den Code prägen

**Geld ist Integer in Cent.** `Transaction.amount` und `Asset.buyPrice` sind `Int` in
Cent, immer positiv; das Vorzeichen kommt aus `type` (`signedCents()`). Kurse und
Marktwerte aus Yahoo sind dagegen normale Euro-`number`. Umrechnung und Formatierung
laufen nur über `money.ts` — keine eigenen `toFixed(2)`-Stellen.

**Basiswährung EUR.** Fremdwährungen werden über `getEurFactors()` umgerechnet
(`Betrag * Faktor = EUR`). Fehlt ein FX-Kurs, fehlt der Eintrag in der Map — dann
wird die Position bewusst aus den Summen gelassen, statt 1:1 zu rechnen; die Seite
meldet das über `Portfolio.unpriced` / `unconverted` (`PortfolioNotices`).

**Untereinheiten gehören nicht in die Domäne.** Yahoo notiert London in Pence
("GBp"), Tel Aviv in Agorot, Johannesburg in Cent. `quotes.ts` rechnet das direkt
beim Abruf auf die Hauptwährung um (`MINOR_UNITS`) — sonst steht der Kurs 100-fach
zu hoch da und findet kein FX-Paar. Groß-/Kleinschreibung ist dabei bedeutungstragend
("GBp" != "GBP"), Währungscodes deshalb nie blind uppercasen.

**Kaufwährung != Notierungswährung.** `Asset.buyCurrency` ist die Währung, in der
der Kaufpreis eingegeben wurde (Kauf über eine deutsche Börse in EUR), `currency`
die des Papiers. `Asset.buyFxRate` hält den EUR-Kurs vom Kauftag fest — nur dadurch
ist der Einstand der echte Einsatz und der Währungsanteil der Rendite überhaupt
ausweisbar (`Position.fxGainEur` / `priceGainEur`). Fehlt der Wert (Altbestand),
wird mit dem heutigen Kurs gerechnet.

**Kurse laufen nie ungepuffert.** `getQuotes()` liest `PriceCache` und lädt nur
Symbole nach, die älter als 15 min sind, in einem Batch. Schlägt Yahoo fehl, wird
nicht geworfen: die Seite rendert mit dem alten Stand und `stale: true`. Neue
Kurszugriffe über `getQuotes()`/`getHistory()` führen, nicht direkt über `yahoo-finance2`.

**Ein `Asset`-Datensatz = ein Kauf (Lot).** Verdichtung zu Positionen (Ø-Einstand)
passiert erst in `getPortfolio()`; gelöscht wird lotweise.

**Datumsfelder sind UTC-Mitternacht.** Immer über `parseIsoDate()` / `toIsoDate()` /
`monthRange()` gehen, nie `new Date("2026-08-01")` direkt — sonst wandern Buchungen
je nach Zeitzone in den Vormonat.

**Wiederkehrend ist ein Intervall.** `recurrence` ist `NONE|MONTHLY|YEARLY`. Die
Fixkosten-Kennzahl zählt je Serie (Kategorie + Notiz + Intervall) nur die jüngste
Buchung; Jahresposten mit 1/12.

## Server Actions

Signatur `(prev: ActionState, formData: FormData) => Promise<ActionState>` für alles,
was `useActionState` bedient; Löschen nimmt nur `FormData`. Fehler werden als Wert
zurückgegeben (`{ ok: false, errors }`), nie geworfen — die Formulare rendern sie
am Feld. Validierung immer über die zod-Schemas aus `validation.ts`, `fieldErrors()`
dampft den `ZodError` auf `{ feld: "meldung" }` ein.

Jede Mutation ruft `revalidatePath("/", "layout")` (die lokale `refresh()`-Funktion).
Der `layout`-Scope ist Absicht: Net Worth hängt an beiden Tabellen, und nur so wird
auch der Client-Router-Cache der jeweils anderen Seiten abgeräumt.

Neue Assets werden vor dem Speichern per `lookupSymbol()` gegen Yahoo geprüft; das
liefert zugleich die echte Notierungswährung.

## UI

Farben kommen als Rollen-Custom-Properties aus `globals.css` (`--surface`, `--positive`,
`--chart-series`, …) und sind über `@theme inline` als Tailwind-Klassen verfügbar
(`bg-surface`, `text-positive`). Keine Hex-Werte in Komponenten, keine `dark:`-Varianten —
Light/Dark tauscht nur die Werte via `prefers-color-scheme`.

Charts benutzen ausschließlich das Vokabular aus `src/components/charts/chart-theme.tsx`
(`CHART`, `axisTick`, `TooltipShell`, `ChartLegend`). Die kategoriale Palette hat genau
vier Slots und wird nicht zyklisch weitergedreht — Weiteres geht ins Kontextgrau.

Primitives liegen in `src/components/ui/` (`Card`, `Field`/`Input`/`Select`, `StatTile`,
`SubmitButton`) — vor neuem Markup dort nachsehen.

Dashboard und Portfolio-Seite sind `export const dynamic = "force-dynamic"`, weil sie
gegen den Kurspuffer bewerten. Der Monatsfilter lebt in der URL (`?month=2026-08`),
nicht im Component-State.

## Sonstiges

- `next.config.ts` hält `yahoo-finance2`, `@prisma/client` und `better-sqlite3` per
  `serverExternalPackages` aus dem Bundle — beide laden dynamisch.
- Prisma-Typen aus `@/generated/prisma/client` bzw. `@/generated/prisma/enums` importieren,
  nicht aus `@prisma/client`.
- `AGENTS.md` wird von `next dev` neu geschrieben; die Änderung mitcommitten statt entfernen.
- Weitere Begründungen zu den Designentscheidungen stehen in `README.md`.

# Finanzübersicht

Lokale Personal-Finance-App: manueller Cashflow, Wertpapier-Portfolio mit
End-of-Day-Kursen von Yahoo Finance und ein Dashboard, das beides zu einem Net Worth
zusammenführt. Basiswährung ist EUR; Fremdwährungen werden per FX-Kurs umgerechnet.

## Start

```bash
npm install
npm run db:generate     # Prisma Client erzeugen (npm blockiert hier ggf. postinstall)
npm run db:migrate      # SQLite anlegen: prisma/dev.db
npm run seed            # Demodaten: 6 Monate Haushalt + 3 Positionen
npm run dev             # http://localhost:3000
```

`DATABASE_URL` steht in `.env` und zeigt auf `file:./prisma/dev.db`.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `prisma/schema.prisma` | Datenmodell: `Transaction`, `Asset`, `PriceCache` |
| `src/lib/db.ts` | Prisma-Client-Singleton (better-sqlite3-Adapter) |
| `src/lib/money.ts` | Cent-Arithmetik und Formatierung |
| `src/lib/validation.ts` | zod-Schemas, geteilt von Formular und Server Action |
| `src/lib/quotes.ts` | Yahoo-Abruf, Kurspuffer, FX-Faktoren, EOD-Historie |
| `src/lib/portfolio.ts` | Positionsbewertung, G/V, Wertreihe |
| `src/lib/finance.ts` | Cashflow-Aggregate, Fixkosten, Net Worth |
| `src/app/actions/` | Server Actions für Buchungen und Positionen |
| `src/components/charts/` | Recharts-Komponenten (Client) |

## Entscheidungen, die man kennen sollte

**Geld als Integer in Cent.** Alle Beträge liegen als ganzzahlige Cent in der DB.
Float-Euro driftet über eine Transaktionsliste sichtbar. Umrechnung und Formatierung
laufen ausschließlich über `src/lib/money.ts`.

**Kurspuffer statt Live-Abruf pro Request.** `getQuotes()` liest `PriceCache` und lädt
nur nach, wenn ein Eintrag älter als 15 Minuten ist — in einem Batch für alle
veralteten Symbole. Fällt Yahoo aus, rendert die App mit dem letzten Stand weiter und
markiert ihn als veraltet, statt eine Fehlerseite zu zeigen.

**Ein Asset-Datensatz = ein Kauf.** Mehrere Käufe desselben Tickers werden für die
Anzeige zu einer Position verdichtet (Ø-Einstand), bleiben aber einzeln löschbar. Das
Kaufdatum ist Pflicht, weil die Wertentwicklung sonst nicht rekonstruierbar wäre.

**Wertentwicklung aus echten EOD-Kursen.** `getPortfolioSeries()` holt die
Kurshistorie und bewertet pro Handelstag nur die Lots, die zu dem Zeitpunkt schon
gekauft waren. Vereinfachung: der FX-Kurs wird mit dem heutigen Stand gerechnet, nicht
mit dem historischen.

**Wiederkehrend ist ein Intervall, kein Boolean.** `recurrence` kennt
`NONE`/`MONTHLY`/`YEARLY`. Die Fixkosten-Kennzahl zählt je Serie nur die jüngste
Buchung (Schlüssel: Kategorie + Notiz + Intervall) — sonst käme bei sechs Monaten
Historie das Sechsfache der Miete heraus.

**Ticker werden beim Anlegen geprüft.** Die Asset-Action fragt das Symbol einmal bei
Yahoo ab; unbekannte Symbole werden im Formular abgelehnt, statt später als kursloses
Papier in der Tabelle zu stehen.

## Charts

Beide Charts benutzen dieselben Farbrollen aus `globals.css`
(`--chart-series`, `--chart-context`, `--chart-grid`), je ein Wertepaar für Light und
Dark. Die Ausgabenverteilung ist ein sortiertes Balkendiagramm statt eines
Kreisdiagramms — bei zehn Kategorien mit ähnlichen Beträgen sind Winkel nicht
vergleichbar, Längen schon. Die Wertentwicklung nutzt das Emphasis-Muster: der
Portfoliowert in der Akzentfarbe, das investierte Kapital als graue, gestrichelte
Kontextlinie.

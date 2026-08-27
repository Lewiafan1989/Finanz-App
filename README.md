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
gekauft waren. Vereinfachung: der Marktwert wird mit dem heutigen Wechselkurs
gerechnet, nicht mit dem des jeweiligen Tages — historische FX-Reihen wären ein
zweiter Satz Abrufe pro Währung. Der Einsatz dagegen steht mit dem Kurs vom Kauftag
in der Reihe, weil der ohnehin je Kauf gespeichert ist.

**Währungen sind der heikelste Teil.** Kurse werden in Notierungswährung gespeichert
und erst beim Lesen nach EUR umgerechnet — eine Umrechnung pro Anzeige statt eines
zweiten, mitalternden Werts in der DB. Drei Regeln hängen daran:

- *Fehlt ein FX-Kurs, wird nicht 1:1 gerechnet.* Die Position fällt aus den Summen
  und die Seite sagt es (`Portfolio.unpriced` / `unconverted`, gerendert von
  `PortfolioNotices`) — stille Abweichungen sind schlimmer als eine Lücke.
- *Untereinheiten werden an der Quelle normalisiert.* Yahoo notiert London in Pence
  ("GBp"), Tel Aviv in Agorot, Johannesburg in Cent. `quotes.ts` rechnet das beim
  Abruf auf die Hauptwährung um; sonst steht der Kurs 100-fach zu hoch da und findet
  kein FX-Paar. Groß-/Kleinschreibung ist dabei bedeutungstragend: "GBp" != "GBP".
- *Kaufwährung ist nicht Notierungswährung.* Wer ein US-Papier über eine deutsche
  Börse kauft, zahlt in EUR. `Asset.buyCurrency` hält fest, worin der Kaufpreis
  eingegeben wurde, `Asset.buyFxRate` den EUR-Kurs vom Kauftag. Erst dadurch ist
  "Investiert" der echte Einsatz und der Währungsanteil der Rendite ausweisbar
  (`Position.fxGainEur`). Fehlt der Wert, gilt der heutige Kurs.

**Wiederkehrend ist ein Intervall, kein Boolean.** `recurrence` kennt
`NONE`/`MONTHLY`/`YEARLY`. Die Fixkosten-Kennzahl zählt je Serie nur die jüngste
Buchung (Schlüssel: Kategorie + Notiz + Intervall) — sonst käme bei sechs Monaten
Historie das Sechsfache der Miete heraus.

**Ticker werden beim Anlegen geprüft.** Die Asset-Action fragt das Symbol einmal bei
Yahoo ab; unbekannte Symbole werden im Formular abgelehnt, statt später als kursloses
Papier in der Tabelle zu stehen.

## Charts

Beide Charts benutzen dieselben Farbrollen aus `globals.css`
(`--chart-series`, `--chart-context`, `--chart-grid`, `--chart-cat-1…4`), je ein
Wertepaar für Light und Dark.

Die Ausgabenverteilung ist ein Donut mit **höchstens fünf Segmenten**: Top 4 einzeln,
alles Weitere als Sammelsegment im Kontextgrau. Ab da sind Winkel nicht mehr
vergleichbar. Die kategoriale Palette hat genau **vier Slots**, weil größere Sets aus
der Referenzpalette die Schwellen für Farbfehlsichtigkeit reißen (geprüft mit dem
Validator des dataviz-Skills, All-Pairs in Light und Dark). Identität hängt deshalb
nie an der Farbe allein: neben dem Ring steht jedes Segment mit Name, Betrag und
Anteil — Legende und Tabellenansicht in einem.

Die Wertentwicklung nutzt das Emphasis-Muster: der Portfoliowert in der Akzentfarbe,
das investierte Kapital als graue, gestrichelte Kontextlinie.

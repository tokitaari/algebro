# Lemmio

Algebra üben für Klasse 8 bis Abitur. Responsive Web-App im Browser, ohne Konten und ohne Tracking; der Fortschritt bleibt lokal im Browser.

Live: https://tokitaari.github.io/lemmio/

## Einheit 1: Terme und binomische Formeln

Drei Teilthemen, je mit Erklärung, durchgerechneten Beispielen, Formeln und einer Übung:

1. Klammern ausmultiplizieren (Summe mal Summe)
2. Binomische Formeln 1 bis 3 anwenden
3. Faktorisieren (Ausklammern, binomische Formeln rückwärts)

Die Übung erzeugt Serien aus 10 Aufgaben. Die Antwort wird als Term eingegeben (`x^2+6x+9`, `x²+6x+9`, `9+6x+x^2` sind gleichwertig) und doppelt geprüft: auf algebraische Äquivalenz und auf die verlangte Form (z. B. „ausmultipliziert“). Die Rückmeldung zeigt beides getrennt als Chips „äquivalent“ und „Form ok“, danach folgt die Musterlösung. Der Fortschritt je Teilthema steht in `localStorage`.

## Design

Genau zwei Themes: hell und dunkel. Ohne gespeicherte Wahl folgt die App der Systemeinstellung. Der Schalter „Design: Hell / Dunkel“ in der Kopfzeile speichert die Wahl unter dem Schlüssel `lemmio:theme`. Ein kleines Inline-Skript in `index.html` setzt das Theme vor dem ersten Rendern, damit nichts aufblitzt. Details: [Theme-System](docs/architektur.md#theme-system).

## Entwicklung

Voraussetzung: Node.js 22 (siehe `.nvmrc`).

```bash
npm ci            # Abhängigkeiten installieren
npm run dev       # Dev-Server auf http://localhost:5173
npm run lint      # ESLint
npm test          # Vitest (einmalig)
npm run build     # Typprüfung + Produktions-Build nach dist/
npm run preview   # Build lokal ansehen
```

### Dev-Container

Alles läuft in einem Container mit Node 22; `node_modules` liegt in einem Docker-Volume. Auf dem Host wird weder Node noch npm benötigt, nur Docker.

**Mit VS Code:** Ordner öffnen und „Reopen in Container“ wählen. Danach im Terminal `npm run dev` starten, die Seite ist unter http://localhost:5173 erreichbar.

**Ohne VS Code:**

```bash
scripts/dev.sh dev      # Container starten und Dev-Server auf http://localhost:5173
scripts/dev.sh check    # Lint, Tests und Build wie in der CI
scripts/dev.sh preview  # Produktions-Build auf http://localhost:4173
scripts/dev.sh shell    # Shell im Container
scripts/dev.sh rebuild  # Image mit der neuesten Node-22-Version neu bauen
scripts/dev.sh down     # stoppen
scripts/dev.sh reset    # stoppen und node_modules-Volume löschen
```

Liegt das Repo unter WSL2 auf einem Windows-Laufwerk (`/mnt/d/...`), schaltet das Skript das Polling für Dateiänderungen automatisch ein. Besser und schneller ist ein Klon im WSL-Dateisystem (z. B. `~/lemmio`). Ports lassen sich mit `DEV_PORT` und `PREVIEW_PORT` ändern.

## Projektaufbau

```text
index.html        Einstieg mit Inline-Skript für das Theme
src/math/         Mathe-Kern: Parser, Polynome, Prüfung, Aufgabengeneratoren (ohne React)
src/content/      Erklärtexte, Beispiele und Formelsatz je Teilthema
src/practice/     Übungsserie als reiner Zustand und Fortschritt in localStorage
src/theme/        Theme-System (hell/dunkel)
src/components/   React-Bausteine (Practice, SkillPath, MathInput, ThemeToggle, ...)
src/pages/        Seiten: Startseite, Teilthema, Formelsatz, nicht gefunden
src/topics.ts     Liste der Teilthemen (Slug, Titel, Kurztext)
src/index.css     Design-Tokens beider Themes und alle Styles
```

Mehr dazu:

- [Architekturüberblick](docs/architektur.md)
- [Anleitung: neue Einheit oder neues Teilthema hinzufügen](docs/neue-einheit.md)

## Stack

React, TypeScript, Vite, React Router, KaTeX (Formelsatz, lokal gebündelt), Vitest (mit Testing Library), ESLint.

## CI und Deployment

`.github/workflows/ci.yml` führt bei jedem Push und Pull Request Lint, Tests und Build aus. Pushes auf `main` werden zusätzlich auf GitHub Pages veröffentlicht (Basispfad `/<repo>/`). Direktlinks auf Unterseiten laufen über eine Kopie von `index.html` als `404.html`: Der Inhalt stimmt, der HTTP-Status ist dabei 404.

Einmalig im Repo einstellen: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Datenschutz

Keine Konten, kein Backend, kein Tracking, keine Übertragung an Server. Gespeichert werden nur zwei Einträge im Browser: `lemmio:progress` (Übungsfortschritt) und `lemmio:theme` (gewähltes Design).

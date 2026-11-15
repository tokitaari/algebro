# Algebro

Algebra üben für Klasse 8 bis Abitur. Responsive Web-App im Browser, ohne Konten und ohne Tracking; der Fortschritt bleibt lokal im Browser.

Aktuell in Arbeit: Einheit 1 (Terme und binomische Formeln).

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

## Dev-Container

Alles läuft in einem Container mit Node 22; `node_modules` liegt in einem Docker-Volume.

**Mit VS Code:** Ordner öffnen und „Reopen in Container“ wählen. Danach im Terminal `npm run dev` starten, die Seite ist unter http://localhost:5173 erreichbar.

**Ohne VS Code:**

```bash
scripts/dev.sh dev      # Container starten und Dev-Server auf http://localhost:5173
scripts/dev.sh check    # Lint, Tests und Build wie in der CI
scripts/dev.sh preview  # Produktions-Build auf http://localhost:4173
scripts/dev.sh shell    # Shell im Container
scripts/dev.sh down     # stoppen
scripts/dev.sh reset    # stoppen und node_modules-Volume löschen
```

Liegt das Repo unter WSL2 auf einem Windows-Laufwerk (`/mnt/d/...`), schaltet das Skript das Polling für Dateiänderungen automatisch ein. Besser und schneller ist ein Klon im WSL-Dateisystem (z. B. `~/algebro`). Ports lassen sich mit `DEV_PORT` und `PREVIEW_PORT` ändern.

## Stack

React, TypeScript, Vite, React Router, Vitest (mit Testing Library), ESLint.

## CI und Deployment

`.github/workflows/ci.yml` führt bei jedem Push und Pull Request Lint, Tests und Build aus. Pushes auf `main` werden zusätzlich auf GitHub Pages veröffentlicht (Basispfad `/<repo>/`).

Einmalig im Repo einstellen: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

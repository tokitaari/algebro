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

## Stack

React, TypeScript, Vite, React Router, Vitest (mit Testing Library), ESLint.

## CI und Deployment

`.github/workflows/ci.yml` führt bei jedem Push und Pull Request Lint, Tests und Build aus. Pushes auf `main` werden zusätzlich auf GitHub Pages veröffentlicht (Basispfad `/<repo>/`).

Einmalig im Repo einstellen: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

# Changelog

Alle wichtigen Änderungen an Lemmio. Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/). Ein Release entspricht einer Lerneinheit; die Versionsnummer zählt die Einheiten.

## [0.0.1] – 2026-11-15

Erstes Release: Einheit 1, Terme und binomische Formeln.

### Hinzugefügt

- Drei Teilthemen mit Erklärung, durchgerechneten Beispielen und Formelsatz (KaTeX):
  - Klammern ausmultiplizieren (Summe mal Summe)
  - Binomische Formeln 1 bis 3 anwenden
  - Faktorisieren (Ausklammern, binomische Formeln rückwärts)
- Formelsatz-Seite unter `/formelsatz`.
- Übung je Teilthema: Serien aus 10 zufällig erzeugten Aufgaben, ohne direkte Wiederholung innerhalb einer Serie.
- Antworteingabe als Term mit Tasten für `²`, Klammern und Rechenzeichen. Eingaben wie `x^2+6x+9`, `x²+6x+9` und `9+6x+x^2` gelten als gleich.
- Prüfung auf algebraische Äquivalenz und auf die verlangte Form (z. B. „ausmultipliziert“), mit getrennten Rückmeldungen „äquivalent“ und „Form ok“ und Hinweisen bei falscher Form.
- Musterlösung nach jeder Antwort.
- Fortschritt je Teilthema im Browser (`localStorage`, Schlüssel `lemmio:progress`), mit Zurücksetzen und Rückfrage.
- Design hell und dunkel mit Umschalter in der Kopfzeile; ohne gespeicherte Wahl folgt die App der Systemeinstellung (Schlüssel `lemmio:theme`).
- Responsive Darstellung ab 360 px Breite.
- Dokumentation: README, Architekturüberblick (`docs/architektur.md`) und Anleitung für eine neue Einheit (`docs/neue-einheit.md`).

### Technik

- React, TypeScript und Vite als reine Frontend-SPA, ohne Backend, Konten oder Tracking.
- Mathe-Kern ohne React-Abhängigkeit (`src/math`) mit Unit-Tests.
- Vitest, ESLint und GitHub Actions (Lint, Test, Build) in der CI.
- Deployment auf GitHub Pages bei Pushes auf `main`.

### Geändert

- App umbenannt von Algebro in Lemmio (Code, Repo, Pages-Pfad, Verzeichnis, Dev-Container).

[0.0.1]: https://github.com/tokitaari/lemmio/releases/tag/release-v0.0.1

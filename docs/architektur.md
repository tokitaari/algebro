# Architekturüberblick

Lemmio ist eine reine Frontend-SPA: React, TypeScript und Vite, statisch auf GitHub Pages gehostet. Es gibt kein Backend und keine Konten. Zustand, der über einen Besuch hinausgeht, liegt in `localStorage`.

Stand: Einheit 1 (Terme und binomische Formeln), nach Sub-Task 4a (Redesign).

## Schichten

```text
pages/ + components/        Darstellung (React)
        │
        ├── content/        Texte, Beispiele, Formelsatz (Daten + KaTeX-Satz)
        ├── practice/       Übungsserie (reiner Zustand) und Fortschritt
        ├── theme/          Theme-Wahl
        │
        └── math/           Mathe-Kern, ohne React
```

Abhängigkeiten zeigen nur nach unten. `src/math` kennt weder React noch den Browser; `src/practice/session.ts` ist ebenfalls reiner Zustand ohne React. Beides ist deshalb ohne DOM testbar.

## Verzeichnisse

| Pfad | Inhalt |
|---|---|
| `index.html` | Einstieg, `lang="de"`, Inline-Skript für das Theme |
| `src/main.tsx` | Start: `initTheme()`, Router (`basename` aus `import.meta.env.BASE_URL`), KaTeX-CSS, `index.css` |
| `src/routes.tsx` | Routen: `/` (Startseite), `/formelsatz`, `/:slug` (Teilthema), `*` (nicht gefunden), alle unter `Layout` |
| `src/topics.ts` | Liste der Teilthemen: `slug`, `title`, `summary`; `findTopic(slug)` |
| `src/math/` | Mathe-Kern (siehe unten) |
| `src/content/` | Inhalte je Teilthema, `formulas.ts`, `markup.ts` |
| `src/practice/` | `session.ts`, `progress.ts`, `useTopicProgress.ts` |
| `src/theme/` | `theme.ts`, `useTheme.ts` |
| `src/components/` | `Layout`, `Breadcrumb`, `ThemeToggle`, `Practice`, `SkillPath`, `MathInput`, `SolutionSteps`, `Tex`, `RichText`, `FormulaList`, `WorkedExampleCard` |
| `src/pages/` | `Home`, `TopicPage`, `FormulaSheet`, `NotFound` |
| `src/index.css` | Design-Tokens beider Themes und alle Styles (eine Datei) |
| `src/test/setup.ts` | Testumgebung (jest-dom) |

Tests liegen neben dem Code (`*.test.ts` bzw. `*.test.tsx`).

## Routing

`createBrowserRouter(routes, { basename: import.meta.env.BASE_URL })`. Lokal ist `BASE_URL` gleich `/`, in der CI `/<repo>/` (Variable `BASE_PATH` in `vite.config.ts`). Die Route `/:slug` rendert `TopicPage`; ein unbekannter Slug liefert dort `NotFound`. Der Slug eines Teilthemas ist zugleich dessen `TopicId` im Mathe-Kern.

Auf GitHub Pages gibt es kein serverseitiges Routing. Die CI kopiert deshalb `dist/index.html` nach `dist/404.html`. Direktlinks funktionieren, der HTTP-Status ist aber 404.

## Mathe-Kern (`src/math`)

Einstieg ist `src/math/index.ts`.

- **Eingabe:** `parser.ts` liest Terme in Schulschreibweise (`2x`, `3(x+1)`, `^2` und `²`, `·`/`*`/`×`, Dezimalkomma). `parse` wirft `TermError`; `readTerm` fängt das ab und liefert `{ ok, … }`.
- **Normalform:** `polynomial.ts` und `normalize.ts` bringen einen Term in ein kanonisches Polynom (`Polynomial`, Koeffizienten als `Rational`). Zwei Terme sind gleichwertig, wenn ihre Polynome gleich sind (`areEquivalent`).
- **Prüfung:** `checkAnswer(task, input)` prüft zuerst Äquivalenz, dann die verlangte Form (`form.ts`: `expanded` oder `factored`). Ergebnis: `correct`, `wrong`, `wrong-form` (mit `hint.code` und deutschem `hint.message`) oder `invalid` (mit `error.code`, `error.message`, `error.position`, `error.length`).
- **Ausgabe:** `toLatex` für KaTeX, `toText` für Klartext (wieder einlesbar).
- **Aufgaben:** `tasks/` enthält je Teilthema einen Generator (`expand.ts`, `binomial.ts`, `factor.ts`). `generators` ist die Tabelle `TopicId → Generator`, `generateTask` und `generateSeries` vermeiden Wiederholungen über `task.key`. Jede `Task` trägt `instruction`, `prompt`, `steps[]` (Musterlösung), `solution`, `key` und `form`. `build*Task`-Funktionen erzeugen dieselben Aufgaben mit festen Zahlen für Beispiele.
- **Zufall:** `Rng` ist eine Funktion `() => number`. In der App ist es `Math.random`, in Tests `createRng(seed)`.

Aufgaben haben nur ganzzahlige Koeffizienten; Variablen sind `x`, `y`, `a`, `b`.

## Inhalte (`src/content`)

`topicContent[topicId]` ist ein `TopicContent`: `sections` (Überschrift, Absätze, optional Schritte), `pitfalls`, `examples` (Titel, `task`, optional `comment`) und `formulaIds`. Der Formelsatz steht in `formulas.ts`.

In Texten steht `$…$` für einen Term in Eingabesyntax, auch als Kette mit `=` und `≠`. `markup.ts` setzt ihn über `toLatex`, die Malpunkte aus der Quelle bleiben erhalten. Die Tests in `content.test.ts` prüfen jede Gleichung und Ungleichung im Text und jede Formel auf Wahrheit, parsen alle Terme und setzen sie mit KaTeX im strikten Modus. Ein falscher Text lässt also die CI scheitern.

## Übung (`src/practice`, `components/Practice.tsx`)

- `session.ts`: Eine Serie ist ein reiner Zustand (`Session`: `tasks`, `index`, `outcomes`, `feedback`). Übergänge sind Funktionen: `createSession`, `submitAnswer`, `revealSolution`, `nextTask`; `finishedBetween` meldet, ob dabei eine Aufgabe oder die Serie abgeschlossen wurde.
- Ablauf: Serie aus `SERIES_LENGTH` = 10 Aufgaben. `correct` und `wrong` beenden die Aufgabe und zeigen die Musterlösung. `wrong-form` und `invalid` zeigen nur einen Hinweis und erlauben einen neuen Versuch. „Lösung anzeigen“ zählt als falsch.
- `progress.ts` und `useTopicProgress.ts`: Fortschritt je Teilthema (`answered`, `correct`, `lastSeries`) unter dem Schlüssel `lemmio:progress` (Version 1, ein Eintrag für alle Teilthemen). Beim Lesen wird validiert; kaputte oder fremde Daten fallen auf „leer“ zurück. Ist Speichern nicht möglich, zeigt die Übung eine Warnung und arbeitet im Speicher weiter.
- `Practice` ist in `TopicPage` per `key={topic.slug}` an das Teilthema gebunden: Ein Wechsel startet eine frische Serie.

### Rückmeldung

| Ergebnis | Klasse | Chips |
|---|---|---|
| `correct` | `.feedback-correct` | ✓ äquivalent, ✓ Form ok |
| `wrong` | `.feedback-wrong` | ✗ nicht äquivalent |
| `wrong-form` | `.feedback-form` | ✓ äquivalent, ✗ Form nicht ok |
| `revealed` | `.feedback-wrong` | keine |
| `invalid` | `.feedback-invalid` | keine (stattdessen markierte Eingabe) |

Die Chips sind die lokale Komponente `Chip` in `Practice.tsx` (`.chips`, `.chip`, `.chip-ok`, `.chip-bad`). Sie zeigen ein Zeichen (✓/✗) zusätzlich zur Farbe.

### Skill-Pfad und Breadcrumb

- `SkillPath` zeigt eine Serie als Pfad aus Knoten statt als Fortschrittsbalken. Props: `total`, `outcomes`, `current` (fehlt am Ende der Serie), `label`. Zustände: `correct`, `wrong`, `current`, `todo`. Fertige Knoten tragen ✓ oder ✗, jeder Knoten hat einen Text für Screenreader („Aufgabe 3: richtig“), der aktuelle Knoten `aria-current="step"`. Die Liste bekommt `role="list"` ausdrücklich, weil Safari die Listensemantik ohne `list-style` verwirft. Verwendet in der laufenden Serie und in der Zusammenfassung.
- `Breadcrumb` zeigt den Pfad über dem Seitentitel, z. B. `einheit_1 / binomische_formeln`. Der erste Teil verlinkt auf die Startseite; `einheit_1` ist derzeit fest im Code (siehe [neue-einheit.md](neue-einheit.md#was-heute-noch-fest-auf-einheit-1-steht)). Verwendet in `TopicPage` und `FormulaSheet`.

## Theme-System

Genau zwei Themes: `light` und `dark` (`Theme` in `src/theme/theme.ts`). Es gibt keinen dritten Zustand „System“: Die Systemeinstellung liefert nur den Standardwert, bis die Lernenden selbst wählen.

**Ablauf:**

1. **Vor dem ersten Rendern** läuft das Inline-Skript in `index.html`. Es liest `localStorage['lemmio:theme']`; gilt der Wert nicht (`light` oder `dark`) oder ist der Speicher gesperrt, nimmt es `prefers-color-scheme`. Es setzt `data-theme` und `style.colorScheme` am `<html>`-Element und die Farbe im `<meta name="theme-color">`. Dadurch gibt es kein Aufblitzen im falschen Theme.
2. **`initTheme()`** in `main.tsx` gleicht den App-Zustand damit ab und folgt Änderungen der Systemeinstellung, solange nichts gespeichert ist.
3. **`ThemeToggle`** (Kopfzeile, Gruppe „Design“, Schaltflächen „Hell“ und „Dunkel“ mit `aria-pressed`) ruft über `useTheme` die Funktion `chooseTheme` auf. Sie wendet das Theme an und speichert es unter `lemmio:theme`. Ab dann hat die Wahl Vorrang vor der Systemeinstellung.
4. **`useTheme`** liest den aktiven Wert mit `useSyncExternalStore` aus `data-theme`; `applyTheme` benachrichtigt die Abonnenten.

**Speicher:** `lemmio:theme` ist vom Fortschritt (`lemmio:progress`) getrennt. Zurücksetzen des Fortschritts ändert das Theme nicht und umgekehrt. Alle Speicherzugriffe sind in `try/catch` gefasst; ohne Speicher gilt die Wahl nur für den Besuch.

**Farben:** `src/index.css` definiert die Design-Tokens als CSS-Variablen. Die Werte für Hell stehen in `:root`, `:root[data-theme='dark']` überschreibt sie. Komponenten verwenden nur Tokens (`--bg`, `--surface`, `--text`, `--muted`, `--border`, `--accent`, `--success`, `--danger`, `--warning` usw.), keine festen Farben. Der Kontrast jedes Text/Hintergrund-Paars liegt in beiden Themes bei mindestens 4,5:1 (WCAG 2.2 AA), Rahmen und Zustandsmarken bei mindestens 3:1.

**Drei Stellen müssen übereinstimmen**, wenn sich etwas ändert:

| Was | Wo |
|---|---|
| Schlüssel `lemmio:theme` | `THEME_STORAGE_KEY` in `src/theme/theme.ts` und Inline-Skript in `index.html` |
| Farbe der Browserleiste (`#e9edfb` hell, `#0a1028` dunkel) | `THEME_COLORS` in `theme.ts`, Inline-Skript und `<meta name="theme-color">` in `index.html`, `--bg` in `index.css` |
| Gültige Werte `light` / `dark` | `isTheme` in `theme.ts` und Inline-Skript |

`src/theme/theme.test.tsx` führt das Inline-Skript aus `index.html` aus und prüft, dass es dieselben Werte setzt wie die App (Schlüssel, Farbe der Browserleiste, Vorrang der gespeicherten Wahl).

**Ein Token ändern:** in beiden Blöcken von `index.css` anpassen und die Kontrastpaare prüfen, in denen es vorkommt.

## Build, CI und Deployment

- `npm run build` führt `tsc -b` und `vite build` aus. KaTeX und React/Router liegen in eigenen Chunks (`vite.config.ts`), damit Browser sie über App-Updates hinweg zwischenspeichern.
- `.github/workflows/ci.yml`: Lint, Tests, Build mit `BASE_PATH=/<repo>/`, Kopie von `index.html` nach `404.html`. Auf `main` folgt der Deploy nach GitHub Pages.
- Der Dev-Container (`.devcontainer/`, `scripts/dev.sh`) ist in der [README](../README.md) beschrieben.

## Entscheidungen, die man kennen sollte

- **Keine Konten, kein Backend, kein Tracking.** Neue Funktionen dürfen nichts an Server senden.
- **Zwei Datenspeicher, je ein Schlüssel:** `lemmio:progress` und `lemmio:theme`. Neue Schlüssel bekommen das Präfix `lemmio:`.
- **Mathe-Kern ohne React.** Neue Logik für Aufgaben gehört dorthin, nicht in Komponenten.
- **Eine Wahrheit für Texte:** Aussagen in Erklärtexten stehen in `$…$` und werden von den Tests bewiesen.
- **Barrierefreiheit:** Zustände nie nur über Farbe (Zeichen und Text dazu), Touch-Ziele mindestens 44 px (`min-height: 2.75rem`), bedienbar ab 360 px Breite.

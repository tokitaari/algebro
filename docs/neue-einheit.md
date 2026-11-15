# Anleitung: neue Einheit oder neues Teilthema

Diese Anleitung beschreibt, welche Stellen im Code angefasst werden, wenn Lemmio um Inhalt wächst. Sie gilt für den Stand nach Einheit 1. Wo die Struktur noch nicht für mehrere Einheiten gebaut ist, steht das ausdrücklich dabei.

Vorab, wie der Code heute gebaut ist:

- Ein **Teilthema** ist die kleinste Lerneinheit: Erklärung, Beispiele, Formeln, Übung. Sein Slug (z. B. `faktorisieren`) ist zugleich Route (`/faktorisieren`), `TopicId` im Mathe-Kern und Schlüssel für Inhalt und Fortschritt.
- Eine **Einheit** ist bisher kein Begriff im Code. `src/topics.ts` ist eine flache Liste, alle Teilthemen stehen in derselben Navigation und auf der Startseite.

Je nach Ziel gilt:

- **Neues Teilthema in Einheit 1:** Schritte 1 bis 6.
- **Neue Einheit (z. B. Einheit 2 „Lineare Gleichungen“):** zusätzlich Schritt 0 und der Abschnitt [Was heute noch fest auf Einheit 1 steht](#was-heute-noch-fest-auf-einheit-1-steht).

## Schritt 0: Planen (nur bei neuer Einheit)

Vor dem ersten Code klären und festhalten:

1. Teilthemen mit Slug (Kleinbuchstaben und Bindestriche, eindeutig, nicht `formelsatz`).
2. Welche Antwortform gilt? Der Mathe-Kern prüft heute Polynome: `AnswerKey` besteht aus `expected: Polynomial` und `form: FormRequirement` (`expanded` oder `factored`). Aufgaben mit anderer Art von Antwort (eine Zahl als Lösung einer Gleichung, ein Funktionsterm, eine Zeichnung) brauchen eine eigene Prüfung. Das ist eine Planungsentscheidung der Einheit, kein Handgriff.
3. Ob die Navigation und die Startseite mehrere Einheiten abbilden sollen (siehe unten).

## Schritt 1: Mathe-Kern

Dateien: `src/math/tasks/` und `src/math/index.ts`.

1. Slug zu `TopicId` und `TOPIC_IDS` in `tasks/types.ts` hinzufügen. Beide Listen müssen übereinstimmen.
2. Generator in `tasks/<name>.ts` schreiben: Funktion `(rng: Rng) => Task`. Zufallszahlen nur über `rng` (`randInt`, `randNonZero`, `pick`, `pickWeighted` aus `random.ts`), nie `Math.random` direkt. Das Ergebnis baut `makeTask` aus `helpers.ts`: Es füllt `key`, `expected` und `solution` aus dem Prompt und den Schritten.
3. Die Musterlösung ist eine Liste `steps` (`expr`, optional `note` als deutscher Klartext). **Jeder Schritt muss zum Prompt äquivalent sein.**
4. Zusätzlich eine `build<Name>Task`-Funktion mit festen Zahlen anbieten, die der Generator selbst benutzt. Sie liefert die Beispiele in den Erklärtexten.
5. In `tasks/index.ts` in die Tabelle `generators` eintragen und die `build*`-Funktion exportieren; in `src/math/index.ts` ebenfalls exportieren.

Tests: `tasks.test.ts` läuft mit `describe.each(TOPIC_IDS)` über alle Teilthemen und prüft für jedes Äquivalenz der Schritte, dass die Musterlösung als `correct` gilt, dass der unveränderte Prompt `wrong-form` ergibt, kleine ganze Zahlen und Determinismus bei gleichem Seed. Ein neues Teilthema wird davon automatisch erfasst. Eigene Besonderheiten des Generators (Varianten, Grenzfälle) bekommen eigene Tests im selben File.

## Schritt 2: Teilthema registrieren

In `src/topics.ts` einen Eintrag ergänzen (`slug`, `title`, `summary`). Die Reihenfolge bestimmt Navigation und Startseite. Eine Route muss nicht angelegt werden: `/:slug` in `routes.tsx` greift automatisch.

Der Test `cover exactly the subtopics of the app` in `tasks.test.ts` schlägt fehl, wenn `topics.ts` und `TOPIC_IDS` auseinanderlaufen.

## Schritt 3: Inhalte

Dateien: `src/content/<slug>.ts`, `src/content/index.ts`, ggf. `src/content/formulas.ts`.

1. Eine Datei mit einem `TopicContent` anlegen. Als Vorlage dient `ausmultiplizieren.ts`:
   - `sections`: Überschrift, Absätze, optional nummerierte `steps`
   - `pitfalls`: typische Fehler
   - `examples`: Titel, `task` aus einer `build*Task`-Funktion, optional `comment`
   - `formulaIds`: IDs aus dem Formelsatz
2. In `index.ts` in `topicContent` eintragen. Weil das Objekt als `Record<TopicId, TopicContent>` typisiert ist, meldet TypeScript einen fehlenden Eintrag.
3. Neue Formeln in `formulas.ts` in eine `formulaGroups`-Gruppe aufnehmen (`id`, `name`, `lhs`, `rhs` in Eingabesyntax). Die `id` ist eindeutig.

Schreibregeln für Texte:

- Alles Mathematische steht in `$…$` und in Eingabesyntax (`$(a+b)^2 = a^2+2ab+b^2$`), nicht als LaTeX. Ketten mit `=` und `≠` sind erlaubt.
- Die Tests beweisen jede Gleichung und Ungleichung im Text. Eine falsche Aussage lässt die CI scheitern. Ein einzelnes `$` im Text ist nicht erlaubt (Fehler „Unbalanced"); Geldbeträge o. Ä. anders schreiben.
- Schritt-Notizen in Aufgaben (`note`) sind Klartext ohne `$…$`.
- Texte sind Deutsch, Du-Form, sachlich genug für die Oberstufe.

Tests: `content.test.ts` prüft für jedes Teilthema: Aufbau, bekannte Formel-IDs, Wahrheit der Aussagen, KaTeX-Satz im strikten Modus, Beispiele (gehören zum Teilthema, Musterlösung gilt als richtig). **Von Hand zu ergänzen:** der Test `works through the examples planned for unit 1` enthält eine feste Tabelle der Beispielaufgaben je Teilthema. Ein neues Teilthema braucht dort einen Eintrag, sonst schlägt der Test fehl.

## Schritt 4: Seiten und Übung

Hier ist meist nichts zu tun:

- `TopicPage` rendert Erklärung, Beispiele, Formeln und `Practice` für jeden Slug aus `topics.ts`.
- `Practice` und `session.ts` sind themenunabhängig. Die Eingabetasten ergeben sich aus den Buchstaben der Aufgabe (`taskVariables`).
- `progress.ts` legt den Fortschritt für alle Einträge von `TOPIC_IDS` an. Neue Teilthemen brauchen keine Migration; ältere Speicherstände bleiben gültig.

Nur wenn die Einheit eine andere Eingabe oder Rückmeldung braucht (andere Tasten, andere Chips), werden `MathInput.tsx` bzw. `FeedbackMessage` in `Practice.tsx` erweitert. Die Rückmeldung ist an `CheckResult` gebunden (siehe [Architektur](architektur.md#rückmeldung)).

Tests: `pages.test.tsx` und `Practice.test.tsx` laufen mit `TOPIC_IDS` über alle Teilthemen. Der Test `shows all three subtopics on the home page` in `routes.test.tsx` erwartet `toHaveLength(3)`; bei einer neuen Zahl von Teilthemen anpassen.

## Schritt 5: Design einhalten

Das Theme-System verlangt für neue Oberflächen nur Disziplin, keine Einrichtung:

- Farben ausschließlich über die Tokens aus `src/index.css` (`var(--surface)`, `var(--text)`, `var(--accent)` …). Keine festen Farbwerte. So funktionieren beide Themes ohne weiteren Code.
- Braucht eine neue Komponente eine Farbe, die es nicht gibt, ein neues Token **in beiden Blöcken** (`:root` und `:root[data-theme='dark']`) anlegen und den Kontrast prüfen (Text mindestens 4,5:1, Rahmen und Zustandsmarken mindestens 3:1).
- Zustände nie nur über Farbe: Zeichen (✓/✗) oder Text dazu, wie bei `SkillPath` und den Chips.
- Touch-Ziele mindestens `2.75rem` hoch, Layout ab 360 px Breite ohne Überlauf.
- Einen neuen `localStorage`-Schlüssel mit Präfix `lemmio:` versehen, mit `try/catch` lesen und schreiben und im Fehlerfall weiterarbeiten wie `theme.ts` und `progress.ts`.
- Nichts am Inline-Skript in `index.html` ändern, außer Schlüssel oder Farben des Themes ändern sich (dann alle drei Stellen, siehe [Theme-System](architektur.md#theme-system)).

Beide Themes im Browser ansehen (Schalter „Design" in der Kopfzeile), auch mobil.

## Schritt 6: Prüfen und abschließen

```bash
scripts/dev.sh check    # Lint, Tests und Build wie in der CI
```

Alternativ lokal `npm run lint && npm test && npm run build`. Danach per Hand: jedes neue Teilthema durchklicken, eine Serie spielen, Seite neu laden (Fortschritt bleibt), beide Themes ansehen, Direktlink auf die Unterseite öffnen.

README (Abschnitt „Einheit 1") und `docs/` bei Bedarf nachziehen.

## Was heute noch fest auf Einheit 1 steht

Diese Stellen sind nicht für mehrere Einheiten gebaut. Beim Start der zweiten Einheit entscheiden, wie sie aussehen sollen (gemeinsam mit der Frage, ob die Navigation nach Einheiten gruppiert wird):

| Datei | Was fest ist |
|---|---|
| `src/topics.ts` | flache Liste; Kommentar „The three subtopics of unit 1" |
| `src/components/Layout.tsx` | Fußzeile „Einheit 1: Terme und binomische Formeln"; Navigation zeigt alle Teilthemen |
| `src/pages/Home.tsx` | Eyebrow `einheit_1 · terme_und_binomische_formeln`, Text „Einheit 1 hat drei Themen" |
| `src/components/Breadcrumb.tsx` | erster Teil ist fest `einheit_1` |
| `src/pages/FormulaSheet.tsx` | Einleitungstext nennt die Einheit „Terme und binomische Formeln“; eine Seite für alle Formeln |
| `src/math/tasks/types.ts` | `TopicId` ist eine geschlossene Union von Einheit 1 |

Die Anzahl der Teilthemen und die Slugs sind ansonsten nirgends fest verdrahtet, abgesehen von den oben genannten Testtabellen.

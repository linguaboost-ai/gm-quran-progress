# Mushaf-Fortschritt

Zeigt eine Seite des Madani-Mushafs (King Fahd Complex, 604 Seiten, 15 Zeilen) so, wie
ein Schüler sie nach einer bestimmten Lektion des Lesekurses lesen kann:
**bereits gelernte Buchstaben und Zeichen schwarz, noch unbekannte sehr hellgrau.**

- Stelle wählen: Sure und Vers oder Seitenzahl (1–604)
- Lektion wählen: 1–60 (Liste, Schieberegler oder Pfeiltasten ↑/↓)
- Herunterladen:
  - **PDF · Lektionen 1–60:** die gewählte Seite 60-mal, jede PDF-Seite eine Lektion (A5)
  - **PDF · nur Lektion n:** die Seite für die aktuelle Lektion
  - **SVG**, **PNG** und **App-JSON:** für App-Entwickler, siehe unten

Die Seite ist rein statisch (HTML, CSS, JavaScript). Sie muss über einen Webserver
geöffnet werden, z. B. GitHub Pages oder lokal mit `npm run serve`.

## So entsteht die Seite

1. **Text und Zeilenumbruch:** Offizieller KFGQPC-Hafs-Text (Version 3.0) mit den
   Seiten- und Zeilenumbrüchen des Madani-Mushafs, aus dem Paket
   [`@quran.ws/text`](https://www.npmjs.com/package/@quran.ws/text). `tools/build-data.mjs`
   erzeugt daraus `data/pages/001.json` … `604.json`, mit Surenköpfen, Basmala,
   Versenden, Pausenzeichen und Hizb-Vierteln.
2. **Schrift:** *KFGQPC HAFS Uthmanic Script* v3.0 (`fonts/UthmanicHafs-v-3.0.ttf`,
   unverändert). Die Wörter werden im Browser mit [HarfBuzz](https://github.com/harfbuzz/harfbuzzjs)
   geformt, genau wie in Satzprogrammen.
3. **Blocksatz wie im Mushaf:** Jede Zeile wird auf volle Breite gebracht. Das geschieht
   vor allem durch die Kaschida-Formen der Schrift (gedehnte Buchstaben) und erst
   danach über die Wortabstände. Kurze Schlusszeilen einer Sure stehen mittig.
4. **Zeichen einzeln einfärben:** HarfBuzz liefert für jede Glyphe die zugehörigen
   Zeichen. Manche Wörter setzt die Schrift als eine einzige Ligatur, etwa „ٱللَّه“,
   „بِسۡمِ“ oder „ٱلرَّحۡمَٰن“. Diese Ligaturen zerlegt `tools/build_ligatures.py` in
   ihre Bestandteile (Umrisse und Bereiche je Buchstabe). So wird z. B. in „ٱللَّه“ in
   Lektion 17 das „ٱللّ“ schwarz und das ه grau.
5. **Gestaltung:** blauer Madani-Rahmen mit Flechtband und Goldlinien, Kopfzeile mit
   Juz und Surenname, Seitenzahl im Medaillon, Hizb-Marken am äußeren Rand und das
   blau-goldene Surenbanner. Die Seiten 1 und 2 haben das ovale Schmuckfeld.

## Welche Lektion für welches Zeichen?

Die Regeln stehen in `js/curriculum.js` und lassen sich dort anpassen. Grundlage ist
`curriculum.csv`. Zeichen, die im Lehrplan fehlen, sind an passender Stelle eingeordnet
(im Code mit „Annahme“ markiert). Ein Zeichen ist bekannt, wenn seine Lektion kleiner
oder gleich der gewählten ist.

| Lektion | Zeichen / Regel |
|---|---|
| 1 | د, Fatha, Kasra, Damma |
| 2, 4, 6, 8 | ز, م, ن, ل |
| 3 | Sukun (ۡ) |
| 5 | Buchstabenformen: vorher gelten Buchstaben nur alleinstehend als bekannt |
| 7 | Schadda |
| 9 | ا als langes a (َا), لا |
| 10 | ٱلۡ am Anfang (Mondbuchstaben) |
| 11–13 | ي, ِي/ِى (langes i), َيۡ |
| 14–16 | و, ُو und stummes Alif (وا۟), َوۡ |
| 17 | stummes ل vor Schadda (ٱلّ, ٱللّ, ٱلنّ, ٱلزّ, ٱلدّ); bei späteren Sonnenbuchstaben mit deren Lektion |
| 18–60 | weitere Buchstaben laut Lehrplan (ب 18 … ظ 60) |
| 20 | ة |
| 21 / 22 / 23 | ه am Anfang / in der Mitte / am Ende (nach Form) |
| 23 | *Annahme:* kleines Waw/Ya (لَهُۥ, بِهِۦ, kitābuhu) zusammen mit ه am Ende |
| 26 | Tanwin (auch versetzt ࣰ ࣱ ࣲ), ًا; *Annahme:* Iqlab-Mim ۢ ۭ |
| 28 / 29 / 30 | kleines Alif ٰ / ىٰ und وٰ / ًى |
| 34 / 35 / 36 / 54 | ٱ im Wort (وَٱ) / nach Vokal / nach langem Vokal / nach Tanwin |
| 39–43 | إِ, إِي(ّ), أُ, أَ und آ, أَوۡ/أَيۡ |
| 42 | *Annahme:* Madd-Zeichen ٓ und ءَا am Wortanfang (= آ) |
| 46 | ء und Tatweel ـ (Hamza-Träger) |
| 47 / 48 / 49 | أ in der Wortmitte / ؤ / ئ |
| 50 | Hamza mit Sukun oder Tanwin, Sukun vor Hamza (z. B. ٱلۡأَرۡض) |
| 55 | *Annahme:* Pausenzeichen (ۖ ۗ ۚ ۛ ۘ) sowie ٱ am Anfang außerhalb des Artikels (ٱهۡدِنَا) |
| 58 | *Annahme:* kleines Sin (بَصۜطَة) |
| 60 | *Annahme:* Sonderzeichen für Ischmam, Tas-hil, Imala (je 1–2 Stellen im Quran) |
| immer | Versende-Zeichen, ۞, ۩ (Seitengestaltung, kein Lesestoff) |

Das Wasla-Alif wird nach dem Ende des vorigen Wortes beurteilt. Nach einem Versende und
am Surenanfang beginnt das Lesen neu. Lektion 24 (ة) und Lektion 55 (Vokale) bringen
keine neuen Zeichen; 55 ist deshalb für Pausen und den Neubeginn mit ٱ verwendet.

## Für App-Entwickler

**SVG** (`mushaf-seite-050-lektion-17.svg`): Die Seite 1:1 als Vektorgrafik
(viewBox `0 0 1000 1414`, Seitenverhältnis A-Format). Jeder Textpfad hat `data-lesson`.
Ein Pfad ist bekannt, wenn `data-lesson` ≤ gewählte Lektion ist; `0` heißt immer sichtbar.
So bildet eine einzige Datei alle 60 Lektionen ab: Die App setzt nur die Füllfarbe
(`#141414` bekannt, `#D5D3CE` unbekannt).

**App-JSON** (`mushaf-seite-050.json`): enthält dieselben Pfade als Daten, dazu die Wörter
der Seite mit Versangabe und Lektion je Zeichen.

```jsonc
{
  "format": "gm-quran-progress/page", "version": 1,
  "page": 50, "juz": 3, "surah": { "number": 3, "name": "Āl-‘Imrān", "arabic": "آلِ عِمۡرَانَ" },
  "viewBox": [0, 0, 1000, 1414],
  "colors": { "known": "#141414", "unknown": "#D5D3CE", "decorText": "#1d2b4f" },
  "decor": [ { "d": "M…Z", "fill": "#DCE8F6", "stroke": "#173F7D", "strokeWidth": 1.8, "fillRule": "evenodd" } ],
  "decorText": "M…Z",
  "text": [ { "lesson": 17, "d": "M…Z" }, { "lesson": 23, "d": "M…Z", "clipX": [626.7, 1010] } ],
  "words": [
    { "line": 2, "key": null, "text": "بِسۡمِ", "lessons": [18, 1, 25, 3, 5, 1], "knownFrom": 25 },
    { "line": 3, "key": "3:1:1", "text": "الٓمٓ", "lessons": [9, 8, 42, 5, 42], "knownFrom": 42 }
  ]
}
```

`line` zählt alle 15 Zeilen der Seite (Banner und Basmala eingeschlossen); die Basmala
vor einer Sure hat keinen Versschlüssel (`key: null`). `lessons` gilt je UTF-16-Zeichen
von `text`.

Zeichenreihenfolge: erst `decor` (Füllung/Kontur wie angegeben), dann `decorText`, dann
`text`. Alle Pfade sind absolute SVG-Pfadbefehle (`M L H V Q C Z`). Pfade mit `clipX`
werden nur zwischen den beiden x-Werten gezeichnet; das betrifft geteilte Ligaturen.

## Entwicklung

```bash
npm install              # Werkzeuge: @quran.ws/text, quran-meta, pdf-lib
npm run serve            # http://localhost:8080
npm test                 # Regeln, Satz, PDF, App-JSON
npm run build:data       # data/pages/*.json und data/meta.json neu erzeugen
npm run build:ligatures  # data/ligatures.json neu erzeugen (Python + fontTools)
node tools/render-page.mjs 50 17 seite.svg      # eine Seite als SVG
node tools/export-pdf.mjs 50 1 60 seite.pdf     # PDF ohne Browser
```

| Pfad | Inhalt |
|---|---|
| `index.html`, `css/app.css`, `js/app.js` | Oberfläche (Design-Kit: `css/uebungen.css`, `css/fonts/`) |
| `js/curriculum.js` | Lehrplan-Regeln: Lektion je Zeichen |
| `js/mushaf.js` | Satz (HarfBuzz, Kaschida, Ligaturen) und SVG |
| `js/ornaments.js` | Rahmen, Banner, Kopfzeile, Medaillons |
| `js/export.js` | PDF (pdf-lib), App-JSON |
| `data/` | Seiten, Metadaten, Ligatur-Zerlegung |
| `tools/` | Daten-Build, Kommandozeilen-Export |

## Quellen und Lizenzen

Siehe [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). Kurz:

- Quran-Text und Zeilenlayout: King Fahd Glorious Qur'an Printing Complex, aufbereitet von
  quran.ws (`@quran.ws/text`, CC BY 4.0). Hizb-Viertel: `quran-meta` (MIT).
- Schrift *KFGQPC HAFS Uthmanic Script*: © King Fahd Complex, frei nutzbar und weitergebbar,
  darf nicht verkauft oder verändert werden (liegt unverändert bei).
- HarfBuzz (harfbuzzjs, MIT), pdf-lib (MIT), DM Sans und Scheherazade New (OFL).
- Rahmen, Surenbanner und Medaillons sind eigene Entwürfe im Stil des blauen Madani-Mushafs.

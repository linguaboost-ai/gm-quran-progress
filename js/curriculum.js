// Lehrplan-Regeln: Für jedes Zeichen einer Mushaf-Seite wird berechnet, ab
// welcher Lektion (1–60) der Schüler es kennt. Eine Seite für Lektion L zeigt
// alle Zeichen mit Lektion <= L schwarz, alle anderen hellgrau.
//
// Grundlage ist curriculum.csv. Zeichen, die dort nicht stehen, sind an einer
// passenden Stelle eingeordnet; jede solche Annahme ist unten mit „Annahme“
// gekennzeichnet und kann hier direkt angepasst werden.
//
// Lektion 0 heißt „immer sichtbar“: Versende-Zeichen, ۞ und das Sajda-Zeichen
// gehören zur Seitengestaltung, nicht zum Lesestoff.

export const NEUTRAL = 0;
export const LAST_LESSON = 60;

// ---------------------------------------------------------------- Zeichen
const FATHA = "َ", DAMMA = "ُ", KASRA = "ِ";
const SHADDA = "ّ";
const SILENT = "ْ"; // im KFGQPC-Text: runde Null über stummen Buchstaben (وا۟)
const SUKUN = "ۡ"; // im KFGQPC-Text: das eigentliche Sukun (ْ in curriculum.csv)
const DAGGER = "ٰ"; // kleines (senkrechtes) Alif ٰ
const MADDA = "ٓ";
const HAMZA_ABOVE = "ٔ", HAMZA_BELOW = "ٕ";
const TANWEEN = new Set(["ً", "ٌ", "ٍ", "ࣰ", "ࣱ", "ࣲ"]);
const HARAKA = new Set([FATHA, DAMMA, KASRA]);
const WAQF = new Set(["ۖ", "ۗ", "ۘ", "ۙ", "ۚ", "ۛ", "ۜ"]);
const NEUTRAL_SIGNS = new Set(["۞", "۩", "ۤ", "۝"]); // ۞ ۩ Sajda-Strich, ۝

// Buchstaben mit ihrer Lektion (Grundform). Kontextregeln stehen weiter unten.
const LETTER = {
  "د": 1, "ز": 2, "م": 4, "ن": 6, "ل": 8, "ا": 9, "ي": 11, "و": 14,
  "ب": 18, "ت": 19, "ة": 20, "س": 25, "ش": 27, "ك": 31, "ف": 32, "ر": 33,
  "ج": 37, "خ": 38, "إ": 39, "ث": 44, "ذ": 45, "ء": 46, "ـ": 46, "ؤ": 48, "ئ": 49,
  "غ": 51, "ح": 52, "ق": 53, "ع": 56, "ط": 57, "ص": 58, "ض": 59, "ظ": 60,
  "ى": 12, "ٱ": 10, "أ": 42, "ه": 23,
};

// Zeichen über/unter Buchstaben
const MARK = {
  [FATHA]: 1, [KASRA]: 1, [DAMMA]: 1, // Lektion 1
  [SUKUN]: 3, // Lektion 3
  [SHADDA]: 7, // Lektion 7
  [SILENT]: 15, // Lektion 15: وا۟ (stummes Alif/Waw)
  "۠": 15, // Annahme: ۠ (Alif nur beim Anhalten gesprochen, أَنَا۠) wie das stumme Alif
  "ً": 26, "ٌ": 26, "ٍ": 26, "ࣰ": 26, "ࣱ": 26, "ࣲ": 26, // Lektion 26 (auch die versetzten Tanwin-Formen)
  [DAGGER]: 28, // Lektion 28
  [MADDA]: 42, // Annahme: Madd-Zeichen ٓ zusammen mit آ (Lektion 42)
  "ۥ": 23, "ۦ": 23, "ۧ": 23, // Annahme: kleines Waw/Ya (lahu, bihi) mit ه am Wortende (Lektion 23)
  "ۢ": 26, "ۭ": 26, // Annahme: Iqlab-Mim ۢ ۭ mit dem Tanwin (Lektion 26)
  "ۜ": 58, "ۣ": 58, // Annahme: kleines Sin über/unter ص (بَصۜطَةࣰ) mit ص (Lektion 58)
  "ۨ": 46, // Annahme: kleines Nun in نُـۨجِي (steht auf einem Tatweel, Lektion 46)
  "۬": 60, "ٜ": 60, // Annahme: Ischmam/Tas-hil/Imala (je 1–2 Stellen) ganz am Ende
};
const WAQF_LESSON = 55; // Annahme: Pausenzeichen mit Lektion 55 (Anhalten/Neubeginn)

// Verbindungsverhalten der Buchstaben (für die Buchstabenformen, Lektion 5 und ه)
const DUAL = new Set([..."بتثجحخسشصضطظعغفقكلمنهيىئ"]);
const RIGHT = new Set([..."اأإآٱدذرزوؤة"]);
const JOIN_CAUSING = "ـ";
const joinsLeft = (c) => DUAL.has(c) || c === JOIN_CAUSING;
const joinsRight = (c) => DUAL.has(c) || RIGHT.has(c) || c === JOIN_CAUSING;

// Kleines Waw/Ya (ۥ ۦ) sind in Unicode „Buchstaben“, werden aber wie Zeichen gesetzt.
const isMarkChar = (c) => /\p{M}/u.test(c) || c === "\u06E5" || c === "\u06E6";
const HAMZA_SEATS = new Set(["ء", "أ", "إ", "ؤ", "ئ"]);
const PREFIX = new Set([..."وفبلك"]);

/** Zerlegt ein Wort in Buchstaben mit ihren Zeichen. */
function letters(word) {
  const out = [];
  for (let i = 0; i < word.length; i++) {
    const c = word[i];
    if (isMarkChar(c) && out.length) out[out.length - 1].marks.push({ i, c });
    else out.push({ i, c, marks: [] });
  }
  return out;
}

const has = (L, c) => L && L.marks.some((m) => m.c === c);
const hasAny = (L, set) => L && L.marks.some((m) => set.has(m.c));
const hasHaraka = (L) => hasAny(L, HARAKA);
const bare = (L) => L && !L.marks.some((m) => !WAQF.has(m.c) && !NEUTRAL_SIGNS.has(m.c));

/**
 * Wie endet ein Wort (für das Wasla-Alif am Anfang des nächsten Wortes)?
 * "tanween" | "long" | "haraka" | "fresh"
 */
export function wordEnding(word) {
  const ls = letters(word).filter((L) => !WAQF.has(L.c) && !NEUTRAL_SIGNS.has(L.c));
  if (!ls.length) return "haraka";
  const last = ls[ls.length - 1];
  const prev = ls[ls.length - 2];
  if (last.marks.some((m) => m.c === "ۘ")) return "fresh"; // Pflicht-Pause ۘ
  if (hasAny(last, TANWEEN)) return "tanween";
  if (last.c === "ا" && prev && hasAny(prev, TANWEEN)) return "tanween"; // ًا
  if (last.c === "ا" && (bare(last) || has(last, SILENT))) return "long"; // ـَا ، ـُوا۟
  if (last.c === "و" && bare(last) && has(prev, DAMMA)) return "long";
  if ((last.c === "ي" || last.c === "ى") && bare(last) && has(prev, KASRA)) return "long";
  if (last.c === "ى" && (bare(last) || has(last, DAGGER))) return "long";
  if (hasHaraka(last)) return "haraka";
  return "haraka";
}

/**
 * Lektion je Zeichen eines Wortes.
 * @param {string} word  Wort (mit angehängten Pausenzeichen)
 * @param {"fresh"|"haraka"|"long"|"tanween"} before  Ende des vorigen Wortes
 * @param {boolean} waslaNext  folgt ein Wort mit ٱ (für ى ohne kleines Alif)
 * @returns {number[]} Lektion je UTF-16-Zeichen
 */
export function wordLessons(word, before = "fresh", waslaNext = true) {
  const ls = letters(word);
  const res = new Array(word.length).fill(1);
  const bases = ls.filter((L) => !WAQF.has(L.c) && !NEUTRAL_SIGNS.has(L.c));
  const idx = new Map(bases.map((L, k) => [L, k]));

  const baseLesson = new Map();
  for (const L of bases) {
    const k = idx.get(L);
    const P = bases[k - 1];
    const N = bases[k + 1];
    const c = L.c;
    let n = LETTER[c] ?? 1;

    // Buchstabenformen: vor Lektion 5 nur die alleinstehende Form
    const jPrev = P && joinsLeft(P.c) && joinsRight(c);
    const jNext = N && joinsLeft(c) && joinsRight(N.c);

    if (c === "ه") {
      // Lektion 21: am Anfang, 22: in der Mitte, 23: am Ende/alleinstehend (Form)
      n = jNext && !jPrev ? 21 : jNext && jPrev ? 22 : 23;
    } else if (c === "ٱ") {
      if (k > 0) n = 34; // Lektion 34: وَٱ فَٱ بِٱ … (Wasla im Wort)
      else if (before === "haraka") n = 35; // Lektion 35: Vokal + ٱ
      else if (before === "long") n = 36; // Lektion 36: langer Vokal + ٱ
      else if (before === "tanween") n = 54; // Lektion 54: Tanwin + ٱ
      else n = N && N.c === "ل" ? 10 : 55; // Anfang: ٱلۡ (Lektion 10); Annahme: sonst Lektion 55
    } else if (c === "ل") {
      if (has(L, SUKUN) && P && P.c === "ٱ") n = 10; // ٱلۡ
    } else if (c === "ا") {
      if (has(L, SILENT) || has(L, "۠")) n = 15; // وا۟
      else if (hasAny(P, TANWEEN)) n = 26; // ًا
      else n = 9; // َا und لا
    } else if (c === "ي") {
      if (has(L, HAMZA_ABOVE) || has(L, HAMZA_BELOW)) n = 49; // ئ in zerlegter Schreibung
      else if (P && P.c === "إ") n = 40; // إِي، إِيَّ
      else if (has(L, SUKUN) && P && (P.c === "أ" || P.c === "ء")) n = 43; // أَيۡ
      else if (has(L, SUKUN) && has(P, FATHA)) n = 13; // َيۡ
      else if (bare(L) && has(P, KASRA)) n = 12; // ِي
      else n = 11;
    } else if (c === "ى") {
      if (has(L, HAMZA_ABOVE) || has(L, HAMZA_BELOW)) n = 49;
      else if (has(L, DAGGER)) n = 29; // ىٰ
      else if (hasAny(P, TANWEEN)) n = 30; // ًى
      else if (has(P, KASRA)) n = 12; // ِى
      else n = waslaNext ? 36 : 29; // bloßes ى nach Fatha: vor ٱ Lektion 36, sonst wie ىٰ
    } else if (c === "و") {
      if (has(L, SILENT)) n = 15; // أُوْلَٰٓئِكَ
      else if (has(L, DAGGER)) n = 29; // وٰ
      else if (has(L, SUKUN) && P && (P.c === "أ" || P.c === "ء")) n = 43; // أَوۡ
      else if (has(L, SUKUN) && has(P, FATHA)) n = 16; // َوۡ
      else if (bare(L) && has(P, DAMMA)) n = 15; // ُو
      else n = 14;
    } else if (c === "ـ") {
      n = 46;
    }

    // Hamza: Grundregeln (Lektion 39–49) und Lektion 50
    const hamza = HAMZA_SEATS.has(c) || has(L, HAMZA_ABOVE) || has(L, HAMZA_BELOW);
    if (c === "أ") {
      const atStart = k === 0 || (k === 1 && PREFIX.has(P.c) && hasHaraka(P)) || (k === 1 && (P.c === "ء" || P.c === "أ"));
      if (!atStart) n = 47; // َأَ in der Wortmitte
      else if (has(L, DAMMA)) n = 41; // أُ
      else n = 42; // أَ
    }
    if (c === "ء" && k === 0 && has(L, FATHA) && N && N.c === "ا") n = 42; // Annahme: ءَا am Wortanfang = آ
    if (hamza) {
      if (has(L, SUKUN) || hasAny(L, TANWEEN) || (P && has(P, SUKUN))) n = Math.max(n, 50); // Lektion 50
    }

    if ((jPrev || jNext) && n < 5) n = 5;
    baseLesson.set(L, n);
  }

  // Unausgesprochenes ل vor Sonnenbuchstaben (ٱلّ, ٱلنّ, …): Lektion 17, aber
  // erst, wenn der folgende Buchstabe bekannt ist (ٱلتّ mit ت usw.).
  for (const L of bases) {
    const k = idx.get(L);
    const N = bases[k + 1];
    if (L.c === "ل" && N && bare(L) && has(N, SHADDA)) {
      baseLesson.set(L, Math.max(17, baseLesson.get(N)));
    }
  }

  for (const L of ls) {
    if (WAQF.has(L.c)) res[L.i] = WAQF_LESSON;
    else if (NEUTRAL_SIGNS.has(L.c)) res[L.i] = NEUTRAL;
    else res[L.i] = baseLesson.get(L);
    for (const m of L.marks) {
      let n;
      if (WAQF.has(m.c)) {
        // ۜ steht im Wort für das kleine Sin, am Wortende als Pausenzeichen (Sakta)
        const trailing = !ls.some((X) => X.i > m.i && !isMarkChar(X.c));
        n = m.c === "ۜ" && !trailing ? 58 : WAQF_LESSON;
      } else if (NEUTRAL_SIGNS.has(m.c)) n = NEUTRAL;
      else if (m.c === DAGGER && (L.c === "ى" || L.c === "و")) n = 29; // ىٰ وٰ
      else if (TANWEEN.has(m.c) && L.c === "ى") n = 30;
      else if (m.c === HAMZA_ABOVE || m.c === HAMZA_BELOW) n = baseLesson.get(L) >= 49 ? baseLesson.get(L) : Math.max(46, baseLesson.get(L));
      else if (m.c === SILENT) n = 15;
      else n = MARK[m.c] ?? 1;
      res[m.i] = n;
    }
  }
  return res;
}

/**
 * Berechnet die Lektionen für alle Wörter einer Seite (Format data/pages/NNN.json).
 * Ergänzt jedes Wort-Token um `lessons` (Array je Zeichen).
 */
export function annotatePage(page) {
  // Alle Tokens in Lesereihenfolge; Kopfzeilen und Basmala trennen den Lesefluss.
  const seq = [];
  for (const line of page.lines) {
    if (line.type === "surah") { seq.push(null); continue; }
    if (line.type === "basmala") seq.push(null);
    for (const tok of line.tokens) seq.push(tok);
    if (line.type === "basmala") seq.push(null);
  }
  let before = "fresh";
  seq.forEach((tok, i) => {
    if (tok === null || tok.end !== undefined) {
      if (tok) tok.lessons = null;
      before = "fresh";
      return;
    }
    if (tok.sign !== undefined) { tok.lessons = [NEUTRAL]; return; }
    const next = seq[i + 1];
    const waslaNext = !!(next && next.w && next.w[0] === "ٱ");
    tok.lessons = wordLessons(tok.w, before, waslaNext);
    before = wordEnding(tok.w);
  });
  return page;
}

// ---------------------------------------------------------------- Lehrplan (Anzeige)
/**
 * Liest curriculum.csv (Semikolon-getrennt) für die Anzeige der Lektionen.
 * In den Lektionen 35, 36 und 54 stehen Paare (Endung + ٱ) in getrennten
 * Spalten; sie werden wieder zusammengefügt.
 */
export function parseCurriculum(csv) {
  const rows = csv.replace(/^﻿/, "").split(/\r?\n/).filter((r) => r.trim());
  const lessons = [];
  for (const row of rows.slice(1)) {
    const [id, ...cells] = row.split(";");
    const n = Number(id);
    if (!n) continue;
    let items = cells.map((c) => c.trim()).filter((c) => c && c !== "M");
    if (items.length > 1 && items.filter((x, i) => i % 2 === 1).every((x) => x === "ٱ")) {
      const pairs = [];
      for (let i = 0; i < items.length; i += 2) pairs.push(items[i] + " ٱ");
      items = pairs;
    }
    lessons.push({ n, items });
  }
  return lessons;
}

/** Zeichen ohne Grundbuchstaben auf den gestrichelten Kreis setzen (◌َ). */
export function displayItem(s) {
  return /^\p{M}/u.test(s) ? "◌" + s : s;
}

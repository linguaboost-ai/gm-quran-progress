import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { wordLessons, wordEnding, parseCurriculum, annotatePage } from "../js/curriculum.js";

// Lektion je Zeichen als "Zeichen:Lektion" (Zeichen ohne Grundbuchstaben mit ◌)
const L = (w, before = "fresh", wasla = true) =>
  [...w].map((c, i) => `${/\p{M}/u.test(c) || c === "ۥ" ? "◌" + c : c}${wordLessons(w, before, wasla)[i]}`).join(" ");

test("Lehrplan: 60 Lektionen, Paare mit ٱ zusammengefügt", () => {
  const ls = parseCurriculum(fs.readFileSync(new URL("../curriculum.csv", import.meta.url), "utf8"));
  assert.equal(ls.length, 60);
  assert.deepEqual(ls[0].items, ["د", "َ", "ِ", "ُ"]);
  assert.deepEqual(ls.find((l) => l.n === 35).items, ["ِ ٱ", "ُ ٱ", "َ ٱ"]);
  assert.equal(ls.find((l) => l.n === 36).items.length, 6);
});

test("Vokale sind ab Lektion 1 bekannt, Sukun ab 3, Schadda ab 7", () => {
  assert.equal(L("دَدَ"), "د1 ◌َ1 د1 ◌َ1");
  assert.equal(L("مِنۡ"), "م5 ◌ِ1 ن6 ◌ۡ3"); // م verbunden: Buchstabenform erst ab Lektion 5
  assert.equal(L("رَبِّ"), "ر33 ◌َ1 ب18 ◌ِ1 ◌ّ7");
});

test("Artikel: ٱلۡ (Lektion 10) und Sonnenbuchstaben (17 bzw. mit dem Buchstaben)", () => {
  assert.equal(L("ٱلۡحَمۡدُ"), "ٱ10 ل10 ◌ۡ3 ح52 ◌َ1 م5 ◌ۡ3 د5 ◌ُ1");
  assert.equal(L("ٱلدِّينِ", "haraka"), "ٱ35 ل17 د5 ◌ِ1 ◌ّ7 ي12 ن6 ◌ِ1");
  assert.equal(L("ٱلرَّحِيمِ", "haraka").split(" ").slice(0, 2).join(" "), "ٱ35 ل33"); // ٱلرّ mit ر (Lektion 33)
});

test("Wasla: im Wort 34, nach Vokal 35, nach langem Vokal 36, nach Tanwin 54", () => {
  assert.equal(wordLessons("وَٱلَّذِينَ")[2], 34);
  assert.equal(wordLessons("ٱللَّهِ", "haraka")[0], 35);
  assert.equal(wordLessons("ٱلۡأَرۡضِ", "long")[0], 36);
  assert.equal(wordLessons("ٱلۡأَرۡضِ", "tanween")[0], 54);
  assert.equal(wordLessons("ٱهۡدِنَا", "fresh")[0], 55); // Annahme: Beginn mit Wasla außerhalb des Artikels
  assert.equal(wordEnding("فِي"), "long");
  assert.equal(wordEnding("بِسۡمِ"), "haraka");
  assert.equal(wordEnding("عَلِيمࣱ"), "tanween");
  assert.equal(wordEnding("قَالُواْ"), "long");
});

test("Lange Vokale, Diphthonge, kleines Alif", () => {
  assert.equal(L("قَالُواْ"), "ق53 ◌َ1 ا9 ل8 ◌ُ1 و15 ا15 ◌ْ15");
  assert.equal(L("يَوۡمِ"), "ي11 ◌َ1 و16 ◌ۡ3 م4 ◌ِ1");
  assert.equal(L("عَلَيۡهِمۡ").split(" ")[4], "ي13");
  assert.equal(L("ٱلصَّلَوٰةَ").split(" ").slice(7, 9).join(" "), "و29 ◌ٰ29");
  assert.equal(L("هُدࣰى").split(" ").slice(3).join(" "), "◌ࣰ26 ى30");
  assert.equal(wordLessons("مُوسَى", "fresh", true)[5], 36); // ى vor ٱ
  assert.equal(wordLessons("ٱلۡعُلَى", "fresh", false)[7], 29); // am Versende
});

test("ه nach Form: Anfang 21, Mitte 22, Ende 23; lahu mit kleinem Waw ab 23", () => {
  assert.equal(wordLessons("هُوَ")[0], 21);
  assert.equal(wordLessons("تَهُمۡ")[2], 22);
  assert.equal(L("لَهُۥ"), "ل8 ◌َ1 ه23 ◌ُ1 ◌ۥ23");
});

test("Hamza: إِ 39, أُ 41, أَ 42, َأَ 47, ء 46, ؤ 48, ئ 49, mit/nach Sukun oder mit Tanwin 50", () => {
  assert.equal(wordLessons("إِنَّ")[0], 39);
  assert.equal(wordLessons("أُولَٰٓئِكَ")[0], 41);
  assert.equal(wordLessons("أَنتُمۡ")[0], 42);
  assert.equal(wordLessons("فَأَمَّا")[2], 42); // nach Vorsilbe wie am Wortanfang
  assert.equal(wordLessons("سَأَلَ")[2], 47);
  assert.equal(wordLessons("مُؤۡمِنِينَ")[2], 50);
  assert.equal(wordLessons("شَيۡءࣲ")[4], 50);
  assert.equal(wordLessons("ٱلۡأَرۡضِ")[3], 50); // ْأ: Sukun vor Hamza (Lektion 50)
  assert.equal(wordLessons("ءَامَنُواْ")[0], 42); // Annahme: ءَا = آ
});

test("Pausenzeichen ab Lektion 55, Iqlab-Mim ab 26", () => {
  const w = "رَيۡبَۛ";
  assert.equal(wordLessons(w)[w.length - 1], 55);
  const q = "عَلِيمُۢ";
  assert.equal(wordLessons(q)[q.length - 1], 26);
});

test("Jede Seite: jedes Zeichen hat eine Lektion zwischen 0 und 60", () => {
  for (const p of [1, 2, 3, 50, 187, 293, 604]) {
    const page = annotatePage(JSON.parse(fs.readFileSync(new URL(`../data/pages/${String(p).padStart(3, "0")}.json`, import.meta.url), "utf8")));
    for (const line of page.lines) {
      for (const t of line.tokens || []) {
        if (!t.w) continue;
        assert.equal(t.lessons.length, t.w.length);
        for (const l of t.lessons) assert.ok(Number.isInteger(l) && l >= 0 && l <= 60, `Seite ${p}: ${t.w} -> ${l}`);
      }
    }
  }
});

// Erzeugt die Seitendaten des Madani-Mushafs (604 Seiten, 15 Zeilen) aus dem
// offiziellen KFGQPC-Hafs-Text (Paket @quran.ws/text, Text und Zeilenumbrüche
// des King-Fahd-Komplexes) und den Hizb-Vierteln aus quran-meta.
//
// Aufruf: npm run build:data
// Ausgabe: data/pages/001.json … 604.json, data/meta.json

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Mushaf } from "@quran.ws/text";
import { HizbQuarterList } from "quran-meta/hafs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_PAGES = path.join(ROOT, "data", "pages");
fs.mkdirSync(OUT_PAGES, { recursive: true });

const m = await Mushaf.hafs();

// Surennamen für das Kopfbanner, im Genitiv wie im Mushaf: „سُورَةُ البَقَرَةِ“.
const SURAH_AR = [
  "الفَاتِحَةِ", "البَقَرَةِ", "آلِ عِمۡرَانَ", "النِّسَاءِ", "المَائِدَةِ", "الأَنۡعَامِ", "الأَعۡرَافِ",
  "الأَنۡفَالِ", "التَّوۡبَةِ", "يُونُسَ", "هُودٍ", "يُوسُفَ", "الرَّعۡدِ", "إِبۡرَاهِيمَ", "الحِجۡرِ",
  "النَّحۡلِ", "الإِسۡرَاءِ", "الكَهۡفِ", "مَرۡيَمَ", "طه", "الأَنۡبِيَاءِ", "الحَجِّ", "المُؤۡمِنُونَ",
  "النُّورِ", "الفُرۡقَانِ", "الشُّعَرَاءِ", "النَّمۡلِ", "القَصَصِ", "العَنۡكَبُوتِ", "الرُّومِ",
  "لُقۡمَانَ", "السَّجۡدَةِ", "الأَحۡزَابِ", "سَبَإٍ", "فَاطِرٍ", "يسٓ", "الصَّافَّاتِ", "صٓ",
  "الزُّمَرِ", "غَافِرٍ", "فُصِّلَتۡ", "الشُّورَىٰ", "الزُّخۡرُفِ", "الدُّخَانِ", "الجَاثِيَةِ",
  "الأَحۡقَافِ", "مُحَمَّدٍ", "الفَتۡحِ", "الحُجُرَاتِ", "قٓ", "الذَّارِيَاتِ", "الطُّورِ", "النَّجۡمِ",
  "القَمَرِ", "الرَّحۡمَٰنِ", "الوَاقِعَةِ", "الحَدِيدِ", "المُجَادَلَةِ", "الحَشۡرِ", "المُمۡتَحَنَةِ",
  "الصَّفِّ", "الجُمُعَةِ", "المُنَافِقُونَ", "التَّغَابُنِ", "الطَّلَاقِ", "التَّحۡرِيمِ", "المُلۡكِ",
  "القَلَمِ", "الحَاقَّةِ", "المَعَارِجِ", "نُوحٍ", "الجِنِّ", "المُزَّمِّلِ", "المُدَّثِّرِ", "القِيَامَةِ",
  "الإِنۡسَانِ", "المُرۡسَلَاتِ", "النَّبَإِ", "النَّازِعَاتِ", "عَبَسَ", "التَّكۡوِيرِ", "الانۡفِطَارِ",
  "المُطَفِّفِينَ", "الانۡشِقَاقِ", "البُرُوجِ", "الطَّارِقِ", "الأَعۡلَىٰ", "الغَاشِيَةِ", "الفَجۡرِ",
  "البَلَدِ", "الشَّمۡسِ", "اللَّيۡلِ", "الضُّحَىٰ", "الشَّرۡحِ", "التِّينِ", "العَلَقِ", "القَدۡرِ",
  "البَيِّنَةِ", "الزَّلۡزَلَةِ", "العَادِيَاتِ", "القَارِعَةِ", "التَّكَاثُرِ", "العَصۡرِ", "الهُمَزَةِ",
  "الفِيلِ", "قُرَيۡشٍ", "المَاعُونِ", "الكَوۡثَرِ", "الكَافِرُونَ", "النَّصۡرِ", "المَسَدِ",
  "الإِخۡلَاصِ", "الفَلَقِ", "النَّاسِ",
];

// Die Basmala vor den Suren ist im Text nicht enthalten (sie ist nur in der
// Fatiha als Vers 1 gezählt) und wird als eigene Zeile gesetzt.
const BASMALA = m.surah(1).ayah(1).wordList.map((w) => w.text);

// Hizb-Viertel: globale Versnummer (1-basiert) -> Viertel 1..240
const ayahIndex = []; // globale Versnummer -> [sure, vers]
for (const s of m.surahs) for (const a of s.ayahs) ayahIndex.push([s.number, a.number]);
const quarterOfAyah = new Map();
HizbQuarterList.forEach((id, q) => {
  if (q === 0 || !id || id > ayahIndex.length) return;
  const [s, a] = ayahIndex[id - 1];
  quarterOfAyah.set(`${s}:${a}`, q);
});

function wordToken(w) {
  let text = w.text;
  let before = [];
  for (const mk of w.marks) {
    if (mk.side === "before") before.push(mk.sign);
    else text += mk.sign;
  }
  const tok = { w: text };
  if (w.ayah) tok.k = `${w.surah.number}:${w.ayah.number}:${w.index}`;
  return { before, tok };
}

const meta = { surahs: [], juz: [], quarters: [] };
for (const s of m.surahs) {
  meta.surahs.push({
    n: s.number,
    name: s.nameEn,
    ar: SURAH_AR[s.number - 1],
    ayahs: s.ayahCount,
    revelation: s.revelation,
    // Seite je Vers (Index 0 = Vers 1)
    pages: s.ayahs.map((a) => a.page.number),
  });
}

for (let pn = 1; pn <= m.pageCount; pn++) {
  const page = m.page(pn);
  const lines = [];
  const quarters = [];
  for (const line of page.lines) {
    const first = line.wordList[0];
    // Beginnt auf dieser Zeile eine neue Sure, kommen Kopfbanner und Basmala davor.
    if (first.surah.start === first.position) {
      const sn = first.surah.number;
      lines.push({ type: "surah", surah: sn });
      if (sn !== 1 && sn !== 9) lines.push({ type: "basmala", tokens: BASMALA.map((w) => ({ w })) });
    }
    const tokens = [];
    for (const w of line.wordList) {
      if (w.ayah && w.index === 1) {
        const q = quarterOfAyah.get(`${w.surah.number}:${w.ayah.number}`);
        if (q) quarters.push({ q, line: lines.length });
      }
      const { before, tok } = wordToken(w);
      for (const b of before) tokens.push({ sign: b });
      tokens.push(tok);
      // Versende-Zeichen nach dem letzten Wort eines Verses
      if (w.ayah && w.index === w.ayah.length) tokens.push({ end: w.ayah.number, k: `${w.surah.number}:${w.ayah.number}` });
    }
    lines.push({ type: "text", tokens });
  }
  // Letzte Zeile einer Sure markieren (kurze Schlusszeilen werden zentriert).
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].type !== "text") continue;
    const next = lines[i + 1];
    const endsSurah = next ? next.type === "surah" : pn === m.pageCount || m.page(pn + 1).lines[0].wordList[0].surah.start === m.page(pn + 1).lines[0].wordList[0].position;
    const lastTok = lines[i].tokens[lines[i].tokens.length - 1];
    if (endsSurah && lastTok.end) lines[i].surahEnd = true;
  }
  const firstWord = page.wordList[0];
  const out = {
    page: pn,
    juz: firstWord.juz ? firstWord.juz.number : 1,
    surah: firstWord.surah.number,
    quarters,
    lines,
  };
  fs.writeFileSync(path.join(OUT_PAGES, String(pn).padStart(3, "0") + ".json"), JSON.stringify(out));
  for (const qd of quarters) meta.quarters[qd.q - 1] = { page: pn, line: qd.line };
}
for (let j = 1; j <= 30; j++) meta.juz.push(m.juz(j).page.number);

fs.writeFileSync(path.join(ROOT, "data", "meta.json"), JSON.stringify(meta));
console.log(`604 Seiten -> data/pages, Metadaten -> data/meta.json (${meta.quarters.filter(Boolean).length} Hizb-Viertel)`);

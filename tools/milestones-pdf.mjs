// PDF mit Meilenstein-Seiten (ganze Wörter / ganze Verse), gleiches Design wie auf der Webseite.
// Aufruf: node tools/milestones-pdf.mjs <ausgabe-ordner>
import fs from "node:fs";
import * as PDFLib from "pdf-lib";
import { loadRenderer } from "./render-page.mjs";
import { buildPdf } from "../js/export.js";

const out = process.argv[2] || ".";
const { r, meta, page } = loadRenderer();

const WORDS = [
  ["10 % der Wörter", 464, 9], ["20 % der Wörter", 604, 15], ["30 % der Wörter", 502, 31],
  ["40 % der Wörter", 604, 33], ["50 % der Wörter", 604, 34], ["60 % der Wörter", 604, 35],
  ["70 % der Wörter", 414, 45], ["80 % der Wörter", 533, 47], ["90 % der Wörter", 533, 53],
  ["100 % der Wörter", 604, 58],
];
const VERSES = [
  ["1 ganzer Vers", 604, 15], ["2 ganze Verse", 575, 27], ["3 ganze Verse", 575, 33],
  ["4 ganze Verse", 575, 37], ["5 ganze Verse", 604, 39], ["6 ganze Verse", 585, 43],
  ["7 ganze Verse", 585, 44], ["8 ganze Verse", 585, 45], ["10 ganze Verse", 585, 46],
  ["20 ganze Verse", 533, 47], ["25 ganze Verse", 585, 56], ["30 ganze Verse", 585, 57],
  ["35 ganze Verse", 585, 58], ["40 ganze Verse", 585, 60],
];

async function make(list, unit, title, file) {
  const doc = await PDFLib.PDFDocument.create();
  doc.setTitle(title);
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  for (const [label, p, lesson] of list) {
    const model = r.buildPage(page(p), meta, { unit });
    const one = await PDFLib.PDFDocument.load(await buildPdf(PDFLib, model, [lesson]));
    const [pg] = await doc.copyPages(one, [0]);
    doc.addPage(pg);
    pg.drawText(`${label} · Lektion ${lesson} · Seite ${p}`, { x: 14, y: 12, size: 7, font, color: PDFLib.rgb(0.5, 0.65, 0.84) });
  }
  const bytes = await doc.save({ useObjectStreams: true });
  fs.writeFileSync(`${out}/${file}`, bytes);
  console.log(file, list.length, "Seiten", (bytes.length / 1024).toFixed(0), "KB");
}

await make(WORDS, "word", "Meilensteine: ganze Wörter", "meilensteine-ganze-woerter.pdf");
await make(VERSES, "verse", "Meilensteine: ganze Verse", "meilensteine-ganze-verse.pdf");

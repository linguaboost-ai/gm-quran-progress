// PDF in Node erzeugen (gleicher Code wie im Browser).
// Aufruf: node tools/export-pdf.mjs <seite> [von-lektion] [bis-lektion] <ausgabe.pdf>
import fs from "node:fs";
import * as PDFLib from "pdf-lib";
import { loadRenderer } from "./render-page.mjs";
import { buildPdf } from "../js/export.js";

const [pn = "3", from = "1", to = "60", out = "mushaf.pdf"] = process.argv.slice(2);
const { r, meta, page } = loadRenderer();
const model = r.buildPage(page(+pn), meta);
const lessons = [];
for (let l = +from; l <= +to; l++) lessons.push(l);
const t0 = Date.now();
const bytes = await buildPdf(PDFLib, model, lessons, { label: lessons.length > 1 });
fs.writeFileSync(out, bytes);
console.log(`${out}: ${lessons.length} Seiten, ${(bytes.length / 1024).toFixed(0)} KB, ${Date.now() - t0} ms`);

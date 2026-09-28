import { test } from "node:test";
import assert from "node:assert/strict";
import * as PDFLib from "pdf-lib";
import { loadRenderer } from "../tools/render-page.mjs";
import { pageSVG } from "../js/mushaf.js";
import { buildPdf, buildAppJson } from "../js/export.js";

const { r, meta, page } = loadRenderer();

test("Seite 3 hat 15 Textzeilen und keine gestauchten Zeilen", () => {
  const data = page(3);
  assert.equal(data.lines.length, 15);
  const model = r.buildPage(data, meta);
  assert.ok(model.atoms.length > 800);
  for (const a of model.atoms) assert.ok(!/NaN|undefined/.test(a.d));
});

test("Allah-Ligatur wird in Lektion 17 geteilt: لل bekannt, ه (Lektion 23) nicht", () => {
  const model = r.buildPage(page(50), meta);
  const clipped = model.atoms.filter((a) => a.clip);
  assert.ok(clipped.some((a) => a.l === 23));
  assert.ok(clipped.some((a) => a.l <= 17));
});

test("SVG: bekannte Pfade schwarz, unbekannte grau, data-lesson gesetzt", () => {
  const model = r.buildPage(page(50), meta);
  const svg = pageSVG(model, 17);
  assert.match(svg, /data-lesson="23"[^>]*fill="#D5D3CE"/);
  assert.match(svg, /data-lesson="1"[^>]*fill="#141414"/);
  assert.ok(svg.startsWith("<svg"));
});

test("Zahlen stehen richtig herum (Seite 604)", () => {
  const s = r.shape("٦٠٤");
  // sichtbare Reihenfolge von links: ٦ ٠ ٤
  assert.deepEqual(s.glyphs.map((g) => g.gid), [r.font.glyph(0x666), r.font.glyph(0x660), r.font.glyph(0x664)]);
});

test("PDF mit 60 Lektionen: 60 Seiten, Umrisse nur einmal gespeichert", async () => {
  const model = r.buildPage(page(604), meta);
  const lessons = Array.from({ length: 60 }, (_, i) => i + 1);
  const bytes = await buildPdf(PDFLib, model, lessons, { label: true });
  const doc = await PDFLib.PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(), 60);
  const single = await buildPdf(PDFLib, model, [1]);
  assert.ok(bytes.length < single.length * 1.5, "60 Seiten dürfen kaum größer sein als eine");
});

test("App-JSON enthält Pfade und Wörter mit Lektionen", () => {
  const model = r.buildPage(page(1), meta);
  const j = buildAppJson(model, 10, meta);
  assert.equal(j.page, 1);
  assert.deepEqual(j.viewBox, [0, 0, 1000, 1414]);
  assert.ok(j.text.length > 5 && j.decor.length > 5);
  assert.equal(j.words[0].text, "بِسۡمِ");
  assert.equal(j.words[0].key, "1:1:1");
});

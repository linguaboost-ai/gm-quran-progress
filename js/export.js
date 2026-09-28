// Export: PDF (eine Seite oder alle Lektionen), App-Paket (JSON), PNG.
//
// PDF: Die Umrisse einer Seite werden nur einmal gespeichert (Form-XObjects,
// je Lektion eine Gruppe). Jede PDF-Seite zeichnet dieselben Gruppen und
// färbt sie je nach Lektion schwarz oder grau. 60 Lektionen kosten dadurch
// kaum mehr Platz als eine.

import { PAGE_W, PAGE_H, COLORS, groupAtoms } from "./mushaf.js";
import { PALETTE } from "./ornaments.js";

export const PDF_W = 419.53; // A5-Breite in pt
const S = PDF_W / PAGE_W;
export const PDF_H = PAGE_H * S;

const n = (v) => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
};

function rgb(hex) {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
const rgbOp = (hex, stroke = false) => rgb(hex).map((c) => n(c)).join(" ") + (stroke ? " RG" : " rg");

/** SVG-Pfad (absolut: M L H V Q C Z) in PDF-Pfadoperatoren. */
export function pathToPdf(d) {
  let out = "";
  let cx = 0, cy = 0, sx = 0, sy = 0;
  const re = /([MLHVQCZ])([^MLHVQCZ]*)/gi;
  let m;
  while ((m = re.exec(d))) {
    const cmd = m[1].toUpperCase();
    const v = m[2].trim() ? m[2].trim().split(/[\s,]+/).map(Number) : [];
    switch (cmd) {
      case "M":
        for (let i = 0; i < v.length; i += 2) {
          cx = v[i]; cy = v[i + 1];
          if (i === 0) { sx = cx; sy = cy; out += `${n(cx)} ${n(cy)} m\n`; } else out += `${n(cx)} ${n(cy)} l\n`;
        }
        break;
      case "L":
        for (let i = 0; i < v.length; i += 2) { cx = v[i]; cy = v[i + 1]; out += `${n(cx)} ${n(cy)} l\n`; }
        break;
      case "H":
        for (const x of v) { cx = x; out += `${n(cx)} ${n(cy)} l\n`; }
        break;
      case "V":
        for (const y of v) { cy = y; out += `${n(cx)} ${n(cy)} l\n`; }
        break;
      case "Q":
        for (let i = 0; i < v.length; i += 4) {
          const [qx, qy, x, y] = v.slice(i, i + 4);
          const c1x = cx + (2 / 3) * (qx - cx), c1y = cy + (2 / 3) * (qy - cy);
          const c2x = x + (2 / 3) * (qx - x), c2y = y + (2 / 3) * (qy - y);
          out += `${n(c1x)} ${n(c1y)} ${n(c2x)} ${n(c2y)} ${n(x)} ${n(y)} c\n`;
          cx = x; cy = y;
        }
        break;
      case "C":
        for (let i = 0; i < v.length; i += 6) {
          const [a, b, c, e, x, y] = v.slice(i, i + 6);
          out += `${n(a)} ${n(b)} ${n(c)} ${n(e)} ${n(x)} ${n(y)} c\n`;
          cx = x; cy = y;
        }
        break;
      case "Z":
        out += "h\n";
        cx = sx; cy = sy;
        break;
    }
  }
  return out;
}

function decorStream(model) {
  let s = "";
  for (const p of model.decor) {
    const path = pathToPdf(p.d);
    if (p.fill && p.fill !== "none") s += rgbOp(p.fill) + "\n";
    if (p.stroke) s += rgbOp(p.stroke, true) + `\n${n(p.sw || 1)} w\n${p.join === "round" ? "1 j\n" : "0 j\n"}`;
    const hasFill = p.fill && p.fill !== "none";
    const eo = p.rule === "evenodd" ? "*" : "";
    s += path + (hasFill && p.stroke ? `B${eo}\n` : hasFill ? `f${eo}\n` : "S\n");
  }
  const dec = groupAtoms(model.decorAtoms);
  s += rgbOp(model.decorTextColor || "#1d2b4f") + "\n";
  for (const [, d] of dec.plain) s += pathToPdf(d) + "f\n";
  return s;
}

function groupStreams(model) {
  // je Lektion ein Strom ohne Farbangabe (die Farbe kommt von der Seite)
  const byLesson = new Map();
  const add = (l, s) => byLesson.set(l, (byLesson.get(l) || "") + s);
  const { plain, clipped } = groupAtoms(model.atoms);
  for (const [l, d] of plain) add(l, pathToPdf(d) + "f\n");
  for (const a of clipped) {
    const x0 = Math.max(a.clip[0], -10), x1 = Math.min(a.clip[1], PAGE_W + 10);
    add(a.l, `q\n${n(x0)} -10 ${n(x1 - x0)} ${n(PAGE_H + 20)} re W n\n${pathToPdf(a.d)}f\nQ\n`);
  }
  return [...byLesson].sort((a, b) => a[0] - b[0]);
}

/**
 * Erstellt ein PDF.
 * @param {object} PDFLib   pdf-lib (Browser: window.PDFLib, Node: import)
 * @param {object} model    Seitenmodell (buildPage)
 * @param {number[]} lessons eine Seite je Lektion
 * @param {object} opts     { label: true } schreibt „Lektion n“ klein an den Rand
 * @returns {Promise<Uint8Array>}
 */
export async function buildPdf(PDFLib, model, lessons, opts = {}) {
  const { PDFDocument, StandardFonts } = PDFLib;
  const doc = await PDFDocument.create();
  const ctx = doc.context;
  const title = lessons.length === 1
    ? `Mushaf Seite ${model.page} – Lektion ${lessons[0]}`
    : `Mushaf Seite ${model.page} – Lektionen ${lessons[0]}–${lessons[lessons.length - 1]}`;
  doc.setTitle(title);
  doc.setCreator("gm-quran-progress");
  doc.setProducer("gm-quran-progress (pdf-lib)");

  const matrix = [S, 0, 0, -S, 0, PDF_H];
  const form = (content) =>
    ctx.register(ctx.flateStream(content, { Type: "XObject", Subtype: "Form", BBox: [-20, -20, PAGE_W + 20, PAGE_H + 20], Matrix: matrix }));
  const decorRef = form(decorStream(model));
  const groups = groupStreams(model).map(([l, s]) => ({ l, ref: form(s) }));
  const font = opts.label ? await doc.embedFont(StandardFonts.Helvetica) : null;
  const known = rgb(opts.known || COLORS.known), unknown = rgb(opts.unknown || COLORS.unknown);

  for (const lesson of lessons) {
    const page = doc.addPage([PDF_W, PDF_H]);
    let content = "";
    // PDFName.toString() liefert den Namen mit führendem „/“
    content += `q ${page.node.newXObject("Decor", decorRef)} Do Q\n`;
    for (const g of groups) {
      const name = page.node.newXObject("L" + g.l, g.ref);
      const c = g.l <= lesson ? known : unknown;
      content += `q ${c.map(n).join(" ")} rg ${name} Do Q\n`;
    }
    page.node.addContentStream(ctx.register(ctx.flateStream(content)));
    if (font) {
      const [r, g, b] = rgb(PALETTE.blueMid);
      page.drawText(`Lektion ${lesson}`, { x: 14, y: 12, size: 7, font, color: PDFLib.rgb(r, g, b) });
    }
  }
  return doc.save({ useObjectStreams: true });
}

/**
 * App-Paket: alles, um die Seite 1:1 nachzuzeichnen – für jede Lektion.
 * Pfade in Seiteneinheiten (viewBox 0 0 1000 1414, y nach unten).
 */
export function buildAppJson(model, lesson, meta) {
  const { plain, clipped } = groupAtoms(model.atoms);
  const dec = groupAtoms(model.decorAtoms);
  const words = [];
  let lineNo = 0;
  for (const line of model.data.lines) {
    lineNo++;
    if (line.type !== "text" && line.type !== "basmala") continue;
    for (const t of line.tokens) {
      if (t.w) words.push({ line: lineNo, key: t.k || null, text: t.w, lessons: t.lessons, knownFrom: Math.max(...t.lessons) });
    }
  }
  const s = meta.surahs[model.data.surah - 1];
  return {
    format: "gm-quran-progress/page",
    version: 1,
    page: model.page,
    juz: model.data.juz,
    surah: { number: s.n, name: s.name, arabic: s.ar },
    lesson,
    viewBox: [0, 0, PAGE_W, PAGE_H],
    colors: { known: COLORS.known, unknown: COLORS.unknown, decorText: model.decorTextColor || "#1d2b4f" },
    howTo:
      "Zuerst alle Einträge aus 'decor' zeichnen (fill/stroke wie angegeben), dann 'decorText' und danach 'text'. " +
      "Ein Text-Pfad ist bekannt (colors.known), wenn lesson <= gewählte Lektion; sonst colors.unknown. " +
      "lesson 0 = immer sichtbar. Pfade mit clipX nur zwischen x = clipX[0] und clipX[1] zeichnen. " +
      "Alle Pfade: absolute SVG-Pfadbefehle (M L H V Q C Z), Füllregel nonzero, sofern nicht angegeben.",
    decor: model.decor.map((p) => {
      const o = { d: p.d };
      if (p.fill && p.fill !== "none") o.fill = p.fill;
      if (p.stroke) { o.stroke = p.stroke; o.strokeWidth = p.sw || 1; }
      if (p.rule) o.fillRule = p.rule;
      if (p.join) o.lineJoin = p.join;
      return o;
    }),
    decorText: dec.plain.map(([, d]) => d).join(""),
    text: [
      ...plain.map(([l, d]) => ({ lesson: l, d })),
      ...clipped.map((a) => ({ lesson: a.l, d: a.d, clipX: [Math.round(Math.max(a.clip[0], -10) * 10) / 10, Math.round(Math.min(a.clip[1], PAGE_W + 10) * 10) / 10] })),
    ],
    words,
  };
}

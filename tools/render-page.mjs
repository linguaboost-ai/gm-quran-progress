// Rendert Seiten in Node (für Tests und Vorschaubilder).
// Aufruf: node tools/render-page.mjs <seite> <lektion> <ausgabe.svg>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as hb from "../js/vendor/harfbuzzjs/index.mjs";
import { MushafRenderer, pageSVG } from "../js/mushaf.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export function loadRenderer() {
  const font = fs.readFileSync(path.join(ROOT, "fonts/UthmanicHafs-v-3.0.ttf"));
  const ligs = JSON.parse(fs.readFileSync(path.join(ROOT, "data/ligatures.json"), "utf8"));
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, "data/meta.json"), "utf8"));
  const r = new MushafRenderer(hb, font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength), ligs);
  const page = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, `data/pages/${String(n).padStart(3, "0")}.json`), "utf8"));
  return { r, meta, page };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [pn = "3", lesson = "60", out = "page.svg"] = process.argv.slice(2);
  const { r, meta, page } = loadRenderer();
  const t0 = Date.now();
  const model = r.buildPage(page(+pn), meta);
  const svg = pageSVG(model, +lesson);
  fs.writeFileSync(out, svg);
  console.log(`Seite ${pn}, Lektion ${lesson}: ${model.atoms.length} Atome, ${(svg.length / 1024).toFixed(0)} KB, ${Date.now() - t0} ms`);
}

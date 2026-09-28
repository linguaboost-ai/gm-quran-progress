// Setzt eine Seite des Madani-Mushafs mit der KFGQPC-Hafs-Schrift (HarfBuzz)
// und liefert ein Seitenmodell: Glyphen-Umrisse als Pfade, jeweils mit der
// Lektion, ab der das Zeichen bekannt ist. Daraus entstehen SVG und PDF.
//
// Läuft im Browser und in Node (HarfBuzz wird von außen übergeben).

import { annotatePage, NEUTRAL } from "./curriculum.js";
import { pageDecor, PAGE_W, PAGE_H, TEXT, SPECIAL } from "./ornaments.js";

export { PAGE_W, PAGE_H };

const TATWEEL = "ـ";
const DUAL = new Set([..."بتثجحخسشصضطظعغفقكلمنهيىئ"]);
const RIGHT = new Set([..."اأإآٱدذرزوؤة"]);
const joinsLeft = (c) => DUAL.has(c);
const joinsRight = (c) => DUAL.has(c) || RIGHT.has(c);
const isMarkChar = (c) => /\p{M}/u.test(c) || c === "ۥ" || c === "ۦ";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => ARABIC_DIGITS[d]);

const fmt = (v) => {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? "0" : String(r);
};

export class MushafRenderer {
  /**
   * @param {object} hb        harfbuzzjs-Modul
   * @param {ArrayBuffer} fontBytes  UthmanicHafs-v-3.0.ttf
   * @param {object} ligatures data/ligatures.json
   */
  constructor(hb, fontBytes, ligatures) {
    this.hb = hb;
    this.face = new hb.Face(new hb.Blob(fontBytes));
    this.font = new hb.Font(this.face);
    this.upem = 2048;
    this.ligatures = ligatures;
    this.buf = new hb.Buffer();
    this.glyphCache = new Map();
    this.markCache = new Map();
    this.shapeCache = new Map();
    this.tatweelGid = this.font.glyph(0x640);
    this.spaceAdv = this.font.glyphHAdvance(this.font.glyph(0x20));
  }

  isMarkGlyph(gid) {
    let v = this.markCache.get(gid);
    if (v === undefined) {
      v = this.face.getGlyphClass(gid) === 3;
      this.markCache.set(gid, v);
    }
    return v;
  }

  /** Umriss einer Glyphe: Befehle + Beginn jeder Kontur. */
  outline(gid) {
    let o = this.glyphCache.get(gid);
    if (!o) {
      const cmds = this.font.glyphToJson(gid);
      const starts = [];
      cmds.forEach((c, i) => c.type === "M" && starts.push(i));
      o = { cmds, starts };
      this.glyphCache.set(gid, o);
    }
    return o;
  }

  /** Formt einen Text (ein Wort) mit Zeichen-genauen Clustern. */
  shape(text) {
    let r = this.shapeCache.get(text);
    if (r) return r;
    const { hb, buf } = this;
    buf.clearContents();
    // Zahlen (Seitenzahl, Hizb-Nummer) stehen von links nach rechts; die Schrift
    // zeichnet Ziffern nur im Arabisch-Modus richtig, daher umgekehrt formen.
    buf.addText(/^[٠-٩]+$/.test(text) ? [...text].reverse().join("") : text);
    buf.guessSegmentProperties();
    buf.setClusterLevel(hb.ClusterLevel.CHARACTERS);
    hb.shape(this.font, buf);
    const infos = buf.getGlyphInfos();
    const pos = buf.getGlyphPositions();
    let width = 0;
    const glyphs = infos.map((g, i) => {
      width += pos[i].xAdvance;
      return { gid: g.codepoint, cl: g.cluster, ax: pos[i].xAdvance, dx: pos[i].xOffset, dy: pos[i].yOffset };
    });
    // Zeichen, die in einer Ligatur aufgegangen sind, der Glyphe davor zuordnen:
    // Buchstaben der nächsten Grund-Glyphe, Zeichen der nächsten Glyphe.
    const byCluster = new Map();
    glyphs.forEach((g, i) => {
      g.chars = [];
      if (!byCluster.has(g.cl)) byCluster.set(g.cl, []);
      byCluster.get(g.cl).push(i);
    });
    for (let ci = 0; ci < text.length; ci++) {
      const own = byCluster.get(ci);
      if (own) {
        for (const gi of own) glyphs[gi].chars.push(ci);
        continue;
      }
      const mark = isMarkChar(text[ci]);
      let best = -1;
      glyphs.forEach((g, gi) => {
        if (g.cl < ci && (mark || !this.isMarkGlyph(g.gid)) && (best < 0 || g.cl > glyphs[best].cl)) best = gi;
      });
      if (best >= 0) glyphs[best].chars.push(ci);
    }
    for (const g of glyphs) g.chars.sort((a, b) => a - b);
    r = { text, glyphs, width };
    this.shapeCache.set(text, r);
    return r;
  }

  /**
   * Mögliche Dehnungen (Kaschida) eines Wortes: Tatweel an einer Verbindung
   * einfügen; die Schrift bildet daraus ihre gedehnten Buchstabenformen.
   * Stufen: erst 1–3 Tatweel an der letzten brauchbaren Verbindung, danach
   * zusätzlich an der vorletzten (für sehr kurze Zeilen).
   */
  stretchOptions(word) {
    const base = this.shape(word);
    const bigLigs = new Set(base.glyphs.filter((g) => this.ligatures[g.gid] && this.ligatures[g.gid].n >= 3).map((g) => g.gid));
    const bases = [];
    for (let i = 0; i < word.length; i++) if (!isMarkChar(word[i])) bases.push(i);
    const positions = [];
    for (let k = 1; k < bases.length; k++) {
      const p = word[bases[k - 1]], c = word[bases[k]];
      if (joinsLeft(p) && joinsRight(c)) positions.push(bases[k]);
    }
    positions.reverse();
    const build = (ins) => {
      let text = word;
      for (const { pos, n } of [...ins].sort((a, b) => b.pos - a.pos)) text = text.slice(0, pos) + TATWEEL.repeat(n) + text.slice(pos);
      return text;
    };
    const ok = (s, prevWidth) =>
      !s.glyphs.some((g) => g.gid === this.tatweelGid) &&
      ![...bigLigs].some((gid) => !s.glyphs.some((g) => g.gid === gid)) &&
      s.width > prevWidth;
    const levels = [];
    const fixed = [];
    let width = base.width;
    for (const pos of positions) {
      let added = 0;
      for (let n = 1; n <= 3; n++) {
        const ins = [...fixed, { pos, n }];
        const text = build(ins);
        const s = this.shape(text);
        if (!ok(s, width)) break;
        levels.push({ text, ins, width: s.width });
        width = s.width;
        added = n;
      }
      if (added) fixed.push({ pos, n: added });
      if (fixed.length >= 2) break;
    }
    return levels;
  }

  /**
   * Setzt eine Textzeile.
   * @returns {{items: object[], scaleX: number}} Wörter mit x-Position (Schrifteinheiten, von links)
   */
  layoutLine(tokens, target, { center = false, stretch = true, maxGap = 1.5 } = {}) {
    const items = tokens.map((tok) => {
      let text;
      if (tok.end !== undefined) text = "\u06DD" + toArabicDigits(tok.end);
      else if (tok.sign !== undefined) text = tok.sign;
      else text = tok.w;
      return { tok, text, shaped: this.shape(text), inserted: null };
    });
    const S0 = this.spaceAdv;
    const n = items.length;
    const sum = () => items.reduce((a, it) => a + it.shaped.width, 0);
    const spaces = Math.max(n - 1, 0);
    const natural = sum() + spaces * S0;

    if (!center && stretch && natural < target) {
      // Kaschida verteilen, bis die Wortabstände höchstens maxGap-fach sind:
      // immer das bisher am wenigsten gedehnte Wort (längere Wörter zuerst).
      const cands = items.filter((it) => it.tok.w && !it.tok.w.includes("\u06E4"));
      const opts = new Map(cands.map((it) => [it, this.stretchOptions(it.tok.w)]));
      const level = new Map(cands.map((it) => [it, 0]));
      let guard = 0;
      while (guard++ < 80) {
        const deficit = target - sum();
        if (deficit <= Math.max(spaces, 0.5) * S0 * maxGap) break;
        const next = cands
          .filter((it) => level.get(it) < opts.get(it).length)
          .sort((a, b) => level.get(a) - level.get(b) || b.shaped.width - a.shaped.width)[0];
        if (!next) break;
        const lv = level.get(next) + 1;
        const o = opts.get(next)[lv - 1];
        const gain = o.width - next.shaped.width;
        // nicht über das Ziel hinaus dehnen (Abstände sollen nicht zu eng werden)
        if (target - (sum() + gain) < spaces * S0 * 0.8) break;
        level.set(next, lv);
        next.shaped = this.shape(o.text);
        next.inserted = o.ins;
      }
    }

    let gap = S0;
    let scaleX = 1;
    const words = sum();
    if (center || spaces === 0) {
      gap = S0;
    } else {
      gap = (target - words) / spaces;
      if (gap < S0 * 0.55) {
        gap = S0 * 0.55;
        scaleX = target / (words + gap * spaces);
      }
    }
    const lineWidth = (words + gap * spaces) * scaleX;
    // Rechts beginnen (Leserichtung), Positionen von links gemessen.
    let x = center || spaces === 0 ? (target + lineWidth) / 2 : target;
    for (const it of items) {
      x -= it.shaped.width * scaleX;
      it.x = x;
      x -= gap * scaleX;
    }
    return { items, scaleX, width: lineWidth };
  }

  /** Lektion je Zeichen eines (evtl. gedehnten) Wortes. */
  charLessons(it) {
    const tok = it.tok;
    if (tok.end !== undefined || tok.sign !== undefined) return null;
    const base = tok.lessons;
    if (!it.inserted) return base;
    const at = new Map(it.inserted.map((x) => [x.pos, x.n]));
    const out = [];
    for (let i = 0; i < base.length; i++) {
      if (at.has(i)) {
        // eingefügte Tatweel gehören zum Buchstaben davor (die Verbindung)
        let prev = i - 1;
        while (prev > 0 && isMarkChar(tok.w[prev])) prev--;
        for (let k = 0; k < at.get(i); k++) out.push(base[prev] ?? base[i]);
      }
      out.push(base[i]);
    }
    return out;
  }

  /**
   * Zerlegt die gesetzten Wörter einer Zeile in Pfad-Atome mit Lektion.
   * @param {number} ox  linke Kante der Zeile (Seiteneinheiten)
   * @param {number} baseline Grundlinie (Seiteneinheiten)
   * @param {number} scale Seiteneinheiten je Schrifteinheit
   */
  lineAtoms(layout, ox, baseline, scale, atoms, lessonOverride = null) {
    const sx = scale * layout.scaleX;
    for (const it of layout.items) {
      const lessons = lessonOverride !== null ? null : this.charLessons(it);
      let pen = 0;
      for (const g of it.shaped.glyphs) {
        const tx = ox + it.x * scale + (pen + g.dx) * sx;
        const ty = baseline - g.dy * scale;
        pen += g.ax;
        const lessonOf = (ci) => {
          if (lessonOverride !== null) return lessonOverride;
          if (!lessons) return NEUTRAL;
          return lessons[ci] ?? NEUTRAL;
        };
        this.glyphAtoms(g, tx, ty, sx, scale, lessonOf, atoms);
      }
    }
  }

  glyphAtoms(g, tx, ty, sx, sy, lessonOf, atoms) {
    const o = this.outline(g.gid);
    if (!o.cmds.length) return;
    const chars = g.chars;
    const lig = chars.length > 1 ? this.ligatures[g.gid] : null;
    if (lig && lig.n === chars.length) {
      const compLesson = chars.map(lessonOf);
      // Konturen nach äußerer Kontur gruppieren (Löcher bleiben im selben Pfad)
      const groups = new Map();
      o.starts.forEach((s, ci) => {
        const outer = lig.parent ? lig.parent[ci] : ci;
        if (!groups.has(outer)) groups.set(outer, []);
        groups.get(outer).push(ci);
      });
      for (const [outer, list] of groups) {
        const d = list.map((ci) => this.contourPath(o, ci, tx, ty, sx, sy)).join("");
        const owner = lig.owner[outer];
        if (owner !== undefined && owner !== null && owner >= 0) {
          atoms.push({ l: compLesson[owner], d });
          continue;
        }
        // über mehrere Buchstaben reichende Kontur: an den Grenzen teilen
        const ranges = lig.ranges.map(([ci, x0, x1]) => ({ l: compLesson[ci], x0, x1 })).sort((a, b) => b.x1 - a.x1);
        const merged = [];
        for (const r of ranges) {
          const last = merged[merged.length - 1];
          if (last && last.l === r.l) last.x0 = r.x0;
          else merged.push({ ...r });
        }
        if (merged.length === 1) {
          atoms.push({ l: merged[0].l, d });
          continue;
        }
        merged.forEach((r, i) => {
          const x1 = i === 0 ? 1e6 : tx + r.x1 * sx;
          const x0 = i === merged.length - 1 ? -1e6 : tx + r.x0 * sx;
          atoms.push({ l: r.l, d, clip: [x0, x1] });
        });
      }
      return;
    }
    const l = chars.length ? Math.max(...chars.map(lessonOf)) : NEUTRAL;
    let d = "";
    for (let ci = 0; ci < o.starts.length; ci++) d += this.contourPath(o, ci, tx, ty, sx, sy);
    atoms.push({ l, d });
  }

  contourPath(o, ci, tx, ty, sx, sy) {
    const from = o.starts[ci];
    const to = ci + 1 < o.starts.length ? o.starts[ci + 1] : o.cmds.length;
    let d = "";
    for (let i = from; i < to; i++) {
      const c = o.cmds[i];
      const v = c.values;
      d += c.type;
      for (let k = 0; k < v.length; k += 2) {
        d += (k ? " " : "") + fmt(tx + v[k] * sx) + " " + fmt(ty - v[k + 1] * sy);
      }
    }
    return d;
  }

  /** Setzt einen kurzen Text (Kopfzeile, Surenname) als Pfade. */
  textAtoms(text, { x, baseline, size, align = "center", lesson = NEUTRAL }, atoms) {
    const scale = size / this.upem;
    const words = text.split(" ").map((w) => ({ tok: { w, lessons: null }, text: w, shaped: this.shape(w) }));
    const S0 = this.spaceAdv;
    const width = words.reduce((a, w) => a + w.shaped.width, 0) + S0 * (words.length - 1);
    // von rechts nach links setzen, Positionen von der linken Kante gemessen
    let px = width;
    for (const w of words) {
      px -= w.shaped.width;
      w.x = px;
      px -= S0;
    }
    const left = align === "center" ? x - (width / 2) * scale : align === "right" ? x - width * scale : x;
    this.lineAtoms({ items: words, scaleX: 1 }, left, baseline, scale, atoms, lesson);
    return width * scale;
  }

  /**
   * Seitenmodell für eine Seite (Format data/pages/NNN.json).
   * @returns {{page:number, atoms:{l:number,d:string,clip?:number[]}[], decor:object[]}}
   */
  buildPage(page, meta, { unit = "char" } = {}) {
    annotatePage(page);
    // „Ganze Wörter“ / „Ganze Verse“: eine Einheit ist erst bekannt, wenn alle
    // ihre Zeichen bekannt sind (Verse enden im Madani-Mushaf nie über eine Seite hinaus)
    if (unit !== "char") {
      const groups = new Map();
      let basmala = 0;
      page.lines.forEach((line, li) => {
        for (const t of line.tokens || []) {
          if (!t.w || !t.lessons) continue;
          const key = unit === "word" ? t : line.type === "basmala" ? "b" + li : t.k ? t.k.split(":").slice(0, 2).join(":") : "x" + basmala++;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(t);
        }
      });
      for (const toks of groups.values()) {
        const max = Math.max(...toks.flatMap((t) => t.lessons));
        for (const t of toks) t.lessons = t.lessons.map((l) => (l === NEUTRAL ? l : max));
      }
    }
    const atoms = [];
    const special = page.page <= 2;
    const { left, right, top, pitch } = TEXT;
    const width = right - left;
    const scale = TEXT.fontSize / this.upem;
    const target = width / scale;

    const decorAtoms = [];
    const decor = pageDecor(page, meta, {
      text: (t, opts) => this.textAtoms(t, opts, decorAtoms),
    });

    const nLines = page.lines.length;
    // Seiten 1 und 2: Zeilen im Oval, senkrecht mittig, Breite folgt der Form
    const firstY = special ? SPECIAL.cy - (nLines * pitch) / 2 : top;
    const ovalWidth = (yMid) => {
      const t = (yMid - SPECIAL.cy) / SPECIAL.ry;
      return 2 * (SPECIAL.rx * Math.sqrt(Math.max(0, 1 - t * t)) - 38);
    };
    page.lines.forEach((line, i) => {
      const y0 = firstY + i * pitch;
      const baseline = y0 + pitch * TEXT.baselineRatio;
      const avail = special ? Math.min(width, ovalWidth(y0 + pitch / 2)) : width;
      if (line.type === "surah") {
        const opts = special ? { x: PAGE_W / 2 - avail / 2, w: avail } : {};
        decor.push(...decor.surahBanner(line.surah, y0, pitch, (t, o) => this.textAtoms(t, o, decorAtoms), opts));
        return;
      }
      if (line.type === "basmala") {
        const lay = this.layoutLine(line.tokens, target, { center: true });
        this.lineAtoms(lay, left, baseline, scale, atoms);
        return;
      }
      let lineTarget = avail / scale;
      const natural = this.layoutLine(line.tokens, lineTarget, { center: true });
      // Kurze Schlusszeilen einer Sure mittig; ebenso extrem kurze Zeilen (nur S. 604)
      const center = !!(line.surahEnd && natural.width < lineTarget * 0.8) || natural.width < lineTarget * 0.5;
      // Seiten 1 und 2: mäßig dehnen und mittig setzen, so entsteht die runde Form
      if (special) lineTarget = Math.min(lineTarget, natural.width * 1.3);
      if (natural.width > lineTarget) lineTarget = natural.width;
      const lay = center ? natural : this.layoutLine(line.tokens, lineTarget, { maxGap: special ? 1.8 : 1.5 });
      const ox = PAGE_W / 2 - (lineTarget * scale) / 2;
      this.lineAtoms(lay, center ? left : ox, baseline, scale, atoms);
    });
    return { page: page.page, atoms, decor, decorAtoms, data: page };
  }
}

// ---------------------------------------------------------------- Ausgabe
export const COLORS = {
  known: "#141414",
  unknown: "#D5D3CE",
};

/** Fasst Atome gleicher Lektion zu einem Pfad zusammen (kleine Dateien, schnelles Umfärben). */
export function groupAtoms(atoms) {
  const plain = new Map();
  const clipped = [];
  for (const a of atoms) {
    if (a.clip) clipped.push(a);
    else plain.set(a.l, (plain.get(a.l) || "") + a.d);
  }
  return { plain: [...plain].sort((a, b) => a[0] - b[0]), clipped };
}

/**
 * SVG einer Seite für eine Lektion.
 * @param {object} model   aus buildPage
 * @param {number} lesson  1–60
 * @param {object} opts    { dataAttrs: true } setzt data-lesson je Gruppe (für Apps)
 */
export function pageSVG(model, lesson, opts = {}) {
  const { known = COLORS.known, unknown = COLORS.unknown } = opts;
  const colorOf = (l) => (l <= lesson ? known : unknown);
  const { plain, clipped } = groupAtoms(model.atoms);
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W} ${PAGE_H}" width="${opts.width || PAGE_W}" height="${opts.height || PAGE_H}">`);
  out.push(`<title>Mushaf Seite ${model.page} – Lektion ${lesson}</title>`);
  const clipDefs = [];
  clipped.forEach((a, i) => {
    clipDefs.push(`<clipPath id="c${i}"><rect x="${fmt(Math.max(a.clip[0], -10))}" y="0" width="${fmt(Math.min(a.clip[1], PAGE_W + 10) - Math.max(a.clip[0], -10))}" height="${PAGE_H}"/></clipPath>`);
  });
  if (clipDefs.length) out.push(`<defs>${clipDefs.join("")}</defs>`);
  for (const p of model.decor) out.push(decorToSVG(p));
  const dec = groupAtoms(model.decorAtoms);
  for (const [, d] of dec.plain) out.push(`<path d="${d}" fill="${model.decorTextColor || "#1d2b4f"}"/>`);
  out.push(`<g id="text">`);
  for (const [l, d] of plain) {
    out.push(`<path${opts.dataAttrs !== false ? ` data-lesson="${l}"` : ""} d="${d}" fill="${colorOf(l)}"/>`);
  }
  clipped.forEach((a, i) => {
    out.push(`<path${opts.dataAttrs !== false ? ` data-lesson="${a.l}"` : ""} clip-path="url(#c${i})" d="${a.d}" fill="${colorOf(a.l)}"/>`);
  });
  out.push(`</g></svg>`);
  return out.join("\n");
}

export function decorToSVG(p) {
  const attrs = [];
  attrs.push(`d="${p.d}"`);
  attrs.push(`fill="${p.fill || "none"}"`);
  if (p.stroke) attrs.push(`stroke="${p.stroke}" stroke-width="${p.sw || 1}"`);
  if (p.op !== undefined) attrs.push(`opacity="${p.op}"`);
  if (p.rule) attrs.push(`fill-rule="${p.rule}"`);
  if (p.join) attrs.push(`stroke-linejoin="${p.join}"`);
  return `<path ${attrs.join(" ")}/>`;
}

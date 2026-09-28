// Seitengestaltung im Stil des blauen Madani-Mushafs (King-Fahd-Komplex):
// cremefarbenes Papier, blauer Zierrahmen mit Goldlinien, Kopfzeile mit Juz
// und Surenname, Seitenzahl im Medaillon, Hizb-Marken am äußeren Rand und das
// blau-goldene Surenbanner.
//
// Alles wird als einfache Pfade beschrieben ({d, fill, stroke, sw}), damit
// dieselben Formen im SVG und im PDF landen.

export const PAGE_W = 1000;
export const PAGE_H = 1414; // A-Format (1 : √2), das PDF ist A5

export const TEXT = {
  left: 120,
  right: 880,
  top: 152,
  pitch: 74.5,
  fontSize: 40,
  baselineRatio: 0.64,
};

export const PALETTE = {
  paper: "#FFFCF1",
  cream: "#FFF8E6",
  blueDark: "#173F7D",
  blue: "#2F68B2",
  blueMid: "#7FA6D6",
  blueLight: "#DCE8F6",
  gold: "#C49A45",
  goldLight: "#E8D29B",
  ink: "#141414",
};

const FRAME = { x0: 66, y0: 100, x1: 934, y1: 1318, band: 30 };

// Oval der ersten beiden Seiten (Text steht darin, Zeilenbreite folgt der Form)
export const SPECIAL = { cx: 500, cy: (FRAME.y0 + FRAME.y1) / 2 + 6, rx: 352, ry: 440 };

// ---------------------------------------------------------------- Pfad-Hilfen
const f = (v) => {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? "0" : String(r);
};

export function rectPath(x, y, w, h) {
  return `M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x)}Z`;
}

export function circlePath(cx, cy, r, ccw = false) {
  // vier kubische Bögen
  const k = 0.5523 * r;
  const s = ccw ? -1 : 1;
  return (
    `M${f(cx + r)} ${f(cy)}` +
    `C${f(cx + r)} ${f(cy + s * k)} ${f(cx + k)} ${f(cy + s * r)} ${f(cx)} ${f(cy + s * r)}` +
    `C${f(cx - k)} ${f(cy + s * r)} ${f(cx - r)} ${f(cy + s * k)} ${f(cx - r)} ${f(cy)}` +
    `C${f(cx - r)} ${f(cy - s * k)} ${f(cx - k)} ${f(cy - s * r)} ${f(cx)} ${f(cy - s * r)}` +
    `C${f(cx + k)} ${f(cy - s * r)} ${f(cx + r)} ${f(cy - s * k)} ${f(cx + r)} ${f(cy)}Z`
  );
}

export function ellipsePath(cx, cy, rx, ry) {
  const kx = 0.5523 * rx, ky = 0.5523 * ry;
  return (
    `M${f(cx + rx)} ${f(cy)}` +
    `C${f(cx + rx)} ${f(cy + ky)} ${f(cx + kx)} ${f(cy + ry)} ${f(cx)} ${f(cy + ry)}` +
    `C${f(cx - kx)} ${f(cy + ry)} ${f(cx - rx)} ${f(cy + ky)} ${f(cx - rx)} ${f(cy)}` +
    `C${f(cx - rx)} ${f(cy - ky)} ${f(cx - kx)} ${f(cy - ry)} ${f(cx)} ${f(cy - ry)}` +
    `C${f(cx + kx)} ${f(cy - ry)} ${f(cx + rx)} ${f(cy - ky)} ${f(cx + rx)} ${f(cy)}Z`
  );
}

/** Stern mit n Zacken (zwei Radien). */
export function starPath(cx, cy, n, r1, r2, rot = 0) {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (Math.PI * i) / n;
    const r = i % 2 ? r2 : r1;
    d += (i ? "L" : "M") + f(cx + r * Math.sin(a)) + " " + f(cy - r * Math.cos(a));
  }
  return d + "Z";
}

/** Rosette: Kreis aus n kleinen Kreisen. */
function rosettePath(cx, cy, n, R, r) {
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    d += circlePath(cx + R * Math.cos(a), cy + R * Math.sin(a), r);
  }
  return d;
}

/**
 * Wandelt einen absoluten Pfad (M L H V Q C Z) mit einer Punktfunktion um.
 * Wird für das Banner und für den PDF-Export verwendet.
 */
export function mapPath(d, fn) {
  let out = "";
  let cx = 0, cy = 0;
  const re = /([MLHVQCZ])([^MLHVQCZ]*)/gi;
  let m;
  while ((m = re.exec(d))) {
    const cmd = m[1].toUpperCase();
    const nums = m[2].trim() ? m[2].trim().split(/[\s,]+/).map(Number) : [];
    if (cmd === "Z") { out += "Z"; continue; }
    if (cmd === "H") {
      for (const x of nums) { cx = x; const [a, b] = fn(cx, cy); out += `L${f(a)} ${f(b)}`; }
      continue;
    }
    if (cmd === "V") {
      for (const y of nums) { cy = y; const [a, b] = fn(cx, cy); out += `L${f(a)} ${f(b)}`; }
      continue;
    }
    const step = cmd === "Q" ? 4 : cmd === "C" ? 6 : 2;
    for (let i = 0; i < nums.length; i += step) {
      const seg = nums.slice(i, i + step);
      const pts = [];
      for (let k = 0; k < seg.length; k += 2) {
        const [a, b] = fn(seg[k], seg[k + 1]);
        pts.push(f(a) + " " + f(b));
      }
      cx = seg[seg.length - 2];
      cy = seg[seg.length - 1];
      out += (i && cmd === "M" ? "L" : cmd) + pts.join(" ");
    }
  }
  return out;
}

// ---------------------------------------------------------------- Texte
const JUZ_AR = [
  "الأَوَّلُ", "الثَّانِي", "الثَّالِثُ", "الرَّابِعُ", "الخَامِسُ", "السَّادِسُ", "السَّابِعُ", "الثَّامِنُ",
  "التَّاسِعُ", "العَاشِرُ", "الحَادِي عَشَرَ", "الثَّانِي عَشَرَ", "الثَّالِثَ عَشَرَ", "الرَّابِعَ عَشَرَ",
  "الخَامِسَ عَشَرَ", "السَّادِسَ عَشَرَ", "السَّابِعَ عَشَرَ", "الثَّامِنَ عَشَرَ", "التَّاسِعَ عَشَرَ",
  "العِشۡرُونَ", "الحَادِي وَالعِشۡرُونَ", "الثَّانِي وَالعِشۡرُونَ", "الثَّالِثُ وَالعِشۡرُونَ",
  "الرَّابِعُ وَالعِشۡرُونَ", "الخَامِسُ وَالعِشۡرُونَ", "السَّادِسُ وَالعِشۡرُونَ", "السَّابِعُ وَالعِشۡرُونَ",
  "الثَّامِنُ وَالعِشۡرُونَ", "التَّاسِعُ وَالعِشۡرُونَ", "الثَّلَاثُونَ",
];
const DIGITS = "٠١٢٣٤٥٦٧٨٩";
const ar = (n) => String(n).replace(/\d/g, (d) => DIGITS[d]);

function quarterLabel(q) {
  const hizb = Math.ceil(q / 4);
  const part = (q - 1) % 4;
  if (part === 0 && (hizb - 1) % 2 === 0) return ["الجُزۡءُ", ar((hizb - 1) / 2 + 1)];
  if (part === 0) return ["الحِزۡبُ", ar(hizb)];
  return [["", "رُبُعُ الحِزۡبِ", "نِصۡفُ الحِزۡبِ", "ثَلَاثَةُ أَرۡبَاعِ"][part], part === 3 ? "الحِزۡبِ " + ar(hizb) : ar(hizb)];
}

// ---------------------------------------------------------------- Rahmen
function bandMotif(x0, y0, x1, y1, prims) {
  // Flechtband: zwei verschlungene Bänder (Guilloche) mit Blüten in den Schlaufen
  const P = PALETTE;
  const horizontal = x1 - x0 > y1 - y0;
  const len = horizontal ? x1 - x0 : y1 - y0;
  const w = horizontal ? y1 - y0 : x1 - x0;
  const amp = w * 0.3;
  const count = Math.max(2, Math.round(len / (w * 1.25)));
  const period = len / count;
  const pt = (t, v) => (horizontal ? [x0 + t, (y0 + y1) / 2 + v] : [(x0 + x1) / 2 + v, y0 + t]);
  const curve = (phase) => {
    let d = "";
    const steps = count * 16;
    for (let i = 0; i <= steps; i++) {
      const t = (len * i) / steps;
      const [px, py] = pt(t, amp * Math.sin((2 * Math.PI * t) / period + phase));
      d += (i ? "L" : "M") + f(px) + " " + f(py);
    }
    return d;
  };
  const a = curve(0), b = curve(Math.PI);
  prims.push({ d: a + b, stroke: P.blueDark, sw: w * 0.2, join: "round" });
  prims.push({ d: a + b, stroke: P.blueLight, sw: w * 0.08, join: "round" });
  let flowers = "", centers = "", buds = "";
  for (let i = 0; i < count * 2; i++) {
    const t = (i + 0.5) * (period / 2);
    const [cx, cy] = pt(t, 0);
    flowers += starPath(cx, cy, 4, w * 0.2, w * 0.07, i % 2 ? 0 : Math.PI / 4);
    centers += circlePath(cx, cy, w * 0.045);
    // kleine Knospen über/unter den Kreuzungen
    const tc = i * (period / 2);
    for (const side of [-1, 1]) {
      const [bx, by] = pt(tc, side * w * 0.36);
      buds += circlePath(bx, by, w * 0.05);
    }
  }
  prims.push({ d: flowers, fill: P.blue });
  prims.push({ d: centers, fill: P.gold });
  prims.push({ d: buds, fill: P.gold });
}

function cornerRosette(cx, cy, s, prims) {
  const P = PALETTE;
  prims.push({ d: rectPath(cx - s / 2, cy - s / 2, s, s), fill: P.blueDark });
  prims.push({ d: starPath(cx, cy, 8, s * 0.46, s * 0.3), fill: P.gold });
  prims.push({ d: starPath(cx, cy, 8, s * 0.36, s * 0.22, Math.PI / 8), fill: P.blue });
  prims.push({ d: circlePath(cx, cy, s * 0.13), fill: P.cream });
}

function frame(prims, { special = false } = {}) {
  const P = PALETTE;
  const { x0, y0, x1, y1, band } = FRAME;
  const ix0 = x0 + band, iy0 = y0 + band, ix1 = x1 - band, iy1 = y1 - band;
  // äußere Doppellinie
  prims.push({ d: rectPath(x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 12), stroke: P.blueDark, sw: 1.2 });
  prims.push({ d: rectPath(x0 - 2.5, y0 - 2.5, x1 - x0 + 5, y1 - y0 + 5), stroke: P.gold, sw: 1.6 });
  // Band
  prims.push({ d: rectPath(x0, y0, x1 - x0, band) + rectPath(x0, iy1, x1 - x0, band) + rectPath(x0, iy0, band, iy1 - iy0) + rectPath(ix1, iy0, band, iy1 - iy0), fill: P.blueLight });
  bandMotif(ix0, y0, ix1, iy0, prims);
  bandMotif(ix0, iy1, ix1, y1, prims);
  bandMotif(x0, iy0, ix0, iy1, prims);
  bandMotif(ix1, iy0, x1, iy1, prims);
  prims.push({ d: rectPath(x0, y0, x1 - x0, y1 - y0) + rectPath(ix0, iy0, ix1 - ix0, iy1 - iy0), stroke: P.blueDark, sw: 1.8 });
  for (const [cx, cy] of [[x0 + band / 2, y0 + band / 2], [x1 - band / 2, y0 + band / 2], [x0 + band / 2, y1 - band / 2], [x1 - band / 2, y1 - band / 2]]) {
    cornerRosette(cx, cy, band, prims);
  }
  // innere Linien: Gold und Blau
  prims.push({ d: rectPath(ix0 + 3, iy0 + 3, ix1 - ix0 - 6, iy1 - iy0 - 6), stroke: P.gold, sw: 1.4 });
  prims.push({ d: rectPath(ix0 + 6.5, iy0 + 6.5, ix1 - ix0 - 13, iy1 - iy0 - 13), stroke: P.blueDark, sw: 0.8 });
  if (special) specialFrame(prims, { ix0, iy0, ix1, iy1 });
}

// Seiten 1 und 2: Text in einem ovalen, blau-golden gerahmten Feld
function specialFrame(prims, { ix0, iy0, ix1, iy1 }) {
  const P = PALETTE;
  const { cx, cy, rx, ry } = SPECIAL;
  const pad = 10;
  const box = rectPath(ix0 + pad, iy0 + pad, ix1 - ix0 - 2 * pad, iy1 - iy0 - 2 * pad);
  // Fläche um das Oval herum hellblau mit Rosetten
  prims.push({ d: box + ellipsePath(cx, cy, rx + 16, ry + 16), fill: P.blueLight, rule: "evenodd" });
  // gebogte Rosetten in den Zwickeln
  const pts = [[ix0 + 74, iy0 + 84], [ix1 - 74, iy0 + 84], [ix0 + 74, iy1 - 84], [ix1 - 74, iy1 - 84], [cx, iy0 + 46], [cx, iy1 - 46], [ix0 + 42, cy], [ix1 - 42, cy]];
  let lobes = "", petals = "", hearts = "", rings = "";
  for (const [x, y] of pts) {
    const R = 24;
    lobes += circlePath(x, y, R);
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * i) / 6;
      lobes += circlePath(x + R * Math.cos(a), y + R * Math.sin(a), 7);
    }
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * i) / 4 + Math.PI / 8;
      petals += leafPath(x + 4 * Math.cos(a), y + 4 * Math.sin(a), x + 21 * Math.cos(a), y + 21 * Math.sin(a), 4.6);
    }
    hearts += circlePath(x, y, 5.5);
    rings += circlePath(x, y, 36);
  }
  prims.push({ d: rings, stroke: P.blueMid, sw: 1 });
  prims.push({ d: lobes, fill: P.cream, stroke: P.blue, sw: 1.2 });
  prims.push({ d: petals, fill: P.blue });
  prims.push({ d: hearts, fill: P.gold });
  prims.push({ d: box, stroke: P.gold, sw: 1.4 });
  // ovales Band
  prims.push({ d: ellipsePath(cx, cy, rx + 16, ry + 16) + ellipsePath(cx, cy, rx, ry), fill: P.blue, rule: "evenodd" });
  let beads = "";
  const n = 96;
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    beads += circlePath(cx + (rx + 8) * Math.cos(a), cy + (ry + 8) * Math.sin(a), 3.2);
  }
  prims.push({ d: beads, fill: P.goldLight });
  prims.push({ d: ellipsePath(cx, cy, rx + 16, ry + 16), stroke: P.gold, sw: 1.6 });
  prims.push({ d: ellipsePath(cx, cy, rx, ry), stroke: P.gold, sw: 1.6 });
  prims.push({ d: ellipsePath(cx, cy, rx - 3, ry - 3), fill: P.paper });
}

// ---------------------------------------------------------------- Seitenteile
function pageNumber(n, prims, text) {
  const P = PALETTE;
  const cx = PAGE_W / 2, cy = FRAME.y1 + 44;
  prims.push({ d: rosettePath(cx, cy, 12, 22, 8), fill: P.blueLight, stroke: P.blue, sw: 1 });
  prims.push({ d: circlePath(cx, cy, 20), fill: P.cream, stroke: P.gold, sw: 1.3 });
  text(ar(n), { x: cx, baseline: cy + 8, size: 30, align: "center" });
}

function header(page, meta, text) {
  const s = meta.surahs[page.surah - 1];
  const y = FRAME.y0 - 26;
  text("الجُزۡءُ " + JUZ_AR[page.juz - 1], { x: FRAME.x1 - 8, baseline: y, size: 30, align: "right" });
  text("سُورَةُ " + s.ar, { x: FRAME.x0 + 8, baseline: y, size: 30, align: "left" });
}

function hizbMarks(page, prims, text) {
  const P = PALETTE;
  const right = page.page % 2 === 1; // rechte Seite: äußerer Rand rechts
  const cx = right ? FRAME.x1 + 4 : FRAME.x0 - 4;
  for (const { q, line } of page.quarters || []) {
    if (q === 1) continue;
    const cy = TEXT.top + (line + 0.5) * TEXT.pitch;
    prims.push({ d: starPath(cx, cy, 12, 44, 36), fill: P.blueLight, stroke: P.blue, sw: 1.1 });
    prims.push({ d: circlePath(cx, cy, 33), fill: P.cream, stroke: P.gold, sw: 1.2 });
    const [a, b] = quarterLabel(q);
    text(a, { x: cx, baseline: cy - 3, size: a.length > 12 ? 13 : 16, align: "center" });
    text(b, { x: cx, baseline: cy + 17, size: b.length > 4 ? 13 : 16, align: "center" });
  }
}

/** Blatt zwischen zwei Punkten (für Rosetten und Ranken). */
function leafPath(x1, y1, x2, y2, w) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * w, ny = (dx / len) * w;
  const a = [x1 + dx / 3, y1 + dy / 3], b = [x1 + (2 * dx) / 3, y1 + (2 * dy) / 3];
  return (
    `M${f(x1)} ${f(y1)}` +
    `C${f(a[0] + nx)} ${f(a[1] + ny)} ${f(b[0] + nx)} ${f(b[1] + ny)} ${f(x2)} ${f(y2)}` +
    `C${f(b[0] - nx)} ${f(b[1] - ny)} ${f(a[0] - nx)} ${f(a[1] - ny)} ${f(x1)} ${f(y1)}Z`
  );
}

// Surenbanner in Einheiten 1000 × 123 (eigener Entwurf im Stil des Madani-Mushafs):
// Mittelkartusche mit geschwungenen Enden, zwei Rundmedaillons, Arabesken-Felder.
const BW = 1000, BH = 123, BC = BH / 2;
function cartouchePath(k = 1) {
  const cx = BW / 2;
  const X = (x) => cx + (x - cx) * k;
  const Y = (y) => BC + (y - BC) * (k === 1 ? 1 : 0.84);
  let d = `M${f(X(300))} ${f(Y(14))}H${f(X(700))}`;
  d += `C${f(X(716))} ${f(Y(14))} ${f(X(722))} ${f(Y(26))} ${f(X(728))} ${f(Y(30))}`;
  d += `C${f(X(746))} ${f(Y(40))} ${f(X(746))} ${f(Y(83))} ${f(X(728))} ${f(Y(93))}`;
  d += `C${f(X(722))} ${f(Y(97))} ${f(X(716))} ${f(Y(109))} ${f(X(700))} ${f(Y(109))}`;
  d += `H${f(X(300))}`;
  d += `C${f(X(284))} ${f(Y(109))} ${f(X(278))} ${f(Y(97))} ${f(X(272))} ${f(Y(93))}`;
  d += `C${f(X(254))} ${f(Y(83))} ${f(X(254))} ${f(Y(40))} ${f(X(272))} ${f(Y(30))}`;
  d += `C${f(X(278))} ${f(Y(26))} ${f(X(284))} ${f(Y(14))} ${f(X(300))} ${f(Y(14))}Z`;
  return d;
}

function bannerShapes() {
  const P = PALETTE;
  const out = [];
  out.push({ d: rectPath(0, 0, BW, BH), fill: P.blueLight });
  // Arabesken-Felder an beiden Enden
  for (const mirror of [false, true]) {
    const X = (x) => (mirror ? BW - x : x);
    const field = rectPath(Math.min(X(10), X(150)), 10, 140, BH - 20);
    out.push({ d: field, fill: P.blue });
    const cx = X(80), cy = BC;
    // verschlungene Ranken (S-Bögen) über das Feld
    let vines = "";
    for (const sgn of [-1, 1]) {
      vines += `M${f(X(14))} ${f(cy + sgn * 44)}C${f(X(48))} ${f(cy + sgn * 44)} ${f(X(52))} ${f(cy - sgn * 30)} ${f(cx)} ${f(cy - sgn * 30)}C${f(X(108))} ${f(cy - sgn * 30)} ${f(X(112))} ${f(cy + sgn * 44)} ${f(X(146))} ${f(cy + sgn * 44)}`;
    }
    out.push({ d: vines, stroke: P.blueMid, sw: 3.2 });
    out.push({ d: vines, stroke: P.blueDark, sw: 1 });
    // gebogtes Medaillon
    let lobes = circlePath(cx, cy, 27);
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * i) / 6;
      lobes += circlePath(cx + 27 * Math.cos(a), cy + 27 * Math.sin(a), 7.5);
    }
    out.push({ d: lobes, fill: P.cream });
    let petals = "", corner = "", dots = "";
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * i) / 4 + Math.PI / 8;
      petals += leafPath(cx + 5 * Math.cos(a), cy + 5 * Math.sin(a), cx + 24 * Math.cos(a), cy + 24 * Math.sin(a), 5);
    }
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      corner += leafPath(cx + sx * 44, cy + sy * 20, cx + sx * 64, cy + sy * 44, 5.5);
      corner += leafPath(cx + sx * 46, cy + sy * 12, cx + sx * 66, cy + sy * 4, 4);
      dots += circlePath(cx + sx * 40, cy + sy * 40, 2.4);
    }
    out.push({ d: corner, fill: P.cream });
    out.push({ d: petals, fill: P.blue });
    out.push({ d: circlePath(cx, cy, 6), fill: P.gold });
    out.push({ d: circlePath(cx, cy, 2.4), fill: P.blueDark });
    out.push({ d: dots, fill: P.goldLight });
    out.push({ d: field, stroke: P.blueDark, sw: 1.6 });
    // Ranken zwischen Feld und Medaillon
    const vine = leafPath(X(150), BC, X(166), BC - 30, 5) + leafPath(X(150), BC, X(166), BC + 30, 5) + leafPath(X(248), BC, X(266), BC - 34, 5) + leafPath(X(248), BC, X(266), BC + 34, 5);
    out.push({ d: vine, fill: P.blue });
  }
  // Rundmedaillons
  for (const x of [206, BW - 206]) {
    out.push({ d: circlePath(x, BC, 45), fill: P.cream, stroke: P.blueDark, sw: 2.6 });
    out.push({ d: circlePath(x, BC, 39), stroke: P.gold, sw: 1.3 });
    out.push({ d: starPath(x, BC, 8, 25, 14), fill: P.blueMid });
    out.push({ d: starPath(x, BC, 8, 14, 8, Math.PI / 8), fill: P.blue });
    out.push({ d: circlePath(x, BC, 5), fill: P.gold });
  }
  // Mittelkartusche
  out.push({ d: leafPath(740, BC, 772, BC, 7) + leafPath(260, BC, 228, BC, 7), fill: P.blue });
  out.push({ d: cartouchePath(), fill: P.cream, stroke: P.blueDark, sw: 2.8 });
  out.push({ d: cartouchePath(0.975), stroke: P.gold, sw: 1.3 });
  // Rahmen
  out.push({ d: rectPath(1.8, 1.8, BW - 3.6, BH - 3.6), stroke: P.blueDark, sw: 3.6 });
  out.push({ d: rectPath(6.5, 6.5, BW - 13, BH - 13), stroke: P.gold, sw: 1.2 });
  return out;
}
let BANNER_CACHE = null;

/** Surenbanner über der ganzen Zeilenbreite. */
function surahBanner(meta, surah, y0, pitch, text, opts = {}) {
  const x = opts.x ?? TEXT.left - 6, w = opts.w ?? TEXT.right - TEXT.left + 12;
  const h = pitch * 0.94;
  const y = y0 + (pitch - h) / 2;
  const sx = w / BW, sy = h / BH;
  const tf = (px, py) => [x + px * sx, y + py * sy];
  BANNER_CACHE ||= bannerShapes();
  const prims = BANNER_CACHE.map((p) => ({ ...p, d: mapPath(p.d, tf), sw: p.sw ? p.sw * Math.min(1, sy * 1.6) : p.sw }));
  prims.push({ d: rectPath(x - 2, y - 2, w + 4, h + 4), stroke: PALETTE.gold, sw: 1.2 });
  const s = meta.surahs[surah - 1];
  text("سُورَةُ " + s.ar, { x: x + w / 2, baseline: y + h * 0.66, size: Math.min(34, h * 0.5), align: "center" });
  return prims;
}

/**
 * Alle Zierteile einer Seite.
 * @param {object} page  Seitendaten
 * @param {object} meta  data/meta.json
 * @param {{text: Function}} helpers  setzt arabischen Text als Pfade
 */
export function pageDecor(page, meta, { text }) {
  const prims = [];
  prims.push({ d: rectPath(0, 0, PAGE_W, PAGE_H), fill: PALETTE.paper });
  frame(prims, { special: page.page <= 2 });
  header(page, meta, text);
  pageNumber(page.page, prims, text);
  hizbMarks(page, prims, text);
  prims.surahBanner = (surah, y0, pitch, t, opts) => surahBanner(meta, surah, y0, pitch, t, opts);
  return prims;
}

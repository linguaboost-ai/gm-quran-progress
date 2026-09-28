#!/usr/bin/env python3
"""Zerlegt die Ligaturen der KFGQPC-Hafs-Schrift in ihre Bestandteile.

Die Schrift setzt manche Buchstabenfolgen als eine einzige Glyphe (z. B. „Allah",
„Bismi", Buchstabe + Iqlab-Mim). Damit die Seite jedes Zeichen einzeln grau
oder schwarz zeigen kann, halten wir für jede Ligatur fest, welche Umrisse
(Konturen) der Glyphe zu welchem Bestandteil gehören.

Vorgehen je Ligatur:
  1. Bestandteile aus der GSUB-Tabelle lesen (rekursiv, falls ein Bestandteil
     selbst eine Ligatur ist).
  2. Konturen der Bestandteile in der Ligatur wiederfinden (gleiche Form,
     nur verschoben) - so werden Vokalzeichen und Punkte exakt zugeordnet.
  3. Übrige Konturen (der verbundene Buchstabenkörper) nach waagerechter
     Position den Grundbuchstaben zuordnen; Konturen, die über mehrere
     Buchstaben reichen, werden an den berechneten Grenzen geteilt.

Die Schriftdatei selbst bleibt unverändert; wir speichern nur Indizes und
Grenzwerte. Ausgabe: data/ligatures.json (Schlüssel = Glyphen-ID).

Aufruf: python3 tools/build_ligatures.py
"""
import json
import os
import sys

from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import DecomposingRecordingPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, "fonts", "UthmanicHafs-v-3.0.ttf")
OUT = os.path.join(ROOT, "data", "ligatures.json")

tt = TTFont(FONT)
glyph_order = tt.getGlyphOrder()
gid_of = {name: i for i, name in enumerate(glyph_order)}
glyph_set = tt.getGlyphSet()
hmtx = tt["hmtx"]
gdef = tt["GDEF"].table.GlyphClassDef.classDefs if tt["GDEF"].table.GlyphClassDef else {}


def is_mark(name):
    return gdef.get(name) == 3


def contours(name):
    """Konturen einer Glyphe als Punktlisten, in der Reihenfolge, in der
    HarfBuzz sie zeichnet (eine Kontur je moveTo)."""
    pen = DecomposingRecordingPen(glyph_set)
    glyph_set[name].draw(pen)
    result, cur = [], None
    for op, args in pen.value:
        if op == "moveTo":
            cur = [args[0]]
            result.append(cur)
        elif op in ("lineTo", "curveTo", "qCurveTo"):
            cur.extend(a for a in args if a is not None)
        elif op in ("closePath", "endPath"):
            cur = None
    return result


def bbox(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


# ---------------------------------------------------------------- GSUB lesen
gsub = tt["GSUB"].table
rules = {}  # ligatur -> [Bestandteile, ...]
for lookup in gsub.LookupList.Lookup:
    for st in lookup.SubTable:
        if st.LookupType == 7:
            st = st.ExtSubTable
        if st.LookupType != 4:
            continue
        for first, ligs in st.ligatures.items():
            for lig in ligs:
                rules.setdefault(lig.LigGlyph, []).append([first] + list(lig.Component))


def flatten(comps, depth=0):
    """Bestandteile, die selbst Ligaturen sind, in ihre Teile auflösen."""
    out = []
    for c in comps:
        if c in rules and depth < 4 and c not in comps[:0]:
            out.extend(flatten(rules[c][0], depth + 1))
        else:
            out.append(c)
    return out


def match_component(lig_contours, taken, comp_name):
    """Sucht alle Konturen des Bestandteils in der Ligatur (gleiche Form,
    beliebig verschoben). Gibt die Indizes zurück oder None."""
    comp = contours(comp_name)
    if not comp:
        return None
    first = comp[0]
    for li, lc in enumerate(lig_contours):
        if li in taken or len(lc) != len(first):
            continue
        dx = lc[0][0] - first[0][0]
        dy = lc[0][1] - first[0][1]
        if not all(abs(a[0] + dx - b[0]) <= 3 and abs(a[1] + dy - b[1]) <= 3 for a, b in zip(first, lc)):
            continue
        found = [li]
        ok = True
        for cc in comp[1:]:
            hit = None
            for lj, lc2 in enumerate(lig_contours):
                if lj in taken or lj in found or len(lc2) != len(cc):
                    continue
                if all(abs(a[0] + dx - b[0]) <= 3 and abs(a[1] + dy - b[1]) <= 3 for a, b in zip(cc, lc2)):
                    hit = lj
                    break
            if hit is None:
                ok = False
                break
            found.append(hit)
        if ok:
            return found
    return None


def signed_area(points):
    a = 0.0
    for (x0, y0), (x1, y1) in zip(points, points[1:] + points[:1]):
        a += x0 * y1 - x1 * y0
    return a / 2


def inside(inner, outer):
    return inner[0] >= outer[0] - 1 and inner[1] >= outer[1] - 1 and inner[2] <= outer[2] + 1 and inner[3] <= outer[3] + 1


def groups_of(cs):
    """Fasst jede äußere Kontur mit ihren Löchern (Gegenrichtung, innen
    liegend) zusammen. Liefert für jede Kontur den Index der äußeren."""
    boxes = [bbox(c) for c in cs]
    areas = [signed_area(c) for c in cs]
    parent = list(range(len(cs)))
    for i in range(len(cs)):
        best = None
        for j in range(len(cs)):
            if i == j or areas[i] * areas[j] >= 0:
                continue
            if abs(areas[j]) > abs(areas[i]) and inside(boxes[i], boxes[j]):
                if best is None or abs(areas[j]) < abs(areas[best]):
                    best = j
        if best is not None:
            parent[i] = best
    return parent


def size_score(box, ref):
    import math
    w = max(box[2] - box[0], 1); h = max(box[3] - box[1], 1)
    rw = max(ref[2] - ref[0], 1); rh = max(ref[3] - ref[1], 1)
    return abs(math.log(w / rw)) + abs(math.log(h / rh))


def analyse(lig, comps):
    lig_c = contours(lig)
    if not lig_c:
        return None
    n = len(comps)
    parent = groups_of(lig_c)
    outers = [i for i in range(len(lig_c)) if parent[i] == i]
    owner = [None] * len(lig_c)
    taken = set()
    # 1) Formgleiche Konturen zuordnen (Zeichen zuerst, dann Grundbuchstaben).
    order = sorted(range(n), key=lambda i: 0 if is_mark(comps[i]) else 1)
    for i in order:
        hit = match_component(lig_c, taken, comps[i])
        if hit:
            for h in hit:
                owner[h] = i
                taken.add(h)
    # 2) Waagerechte Bereiche der Grundbuchstaben (von rechts nach links).
    bases = [i for i in range(n) if not is_mark(comps[i])]
    marks = [i for i in range(n) if is_mark(comps[i])]
    adv = hmtx[lig][0]
    all_pts = [p for c in lig_c for p in c]
    x_min, _, x_max, _ = bbox(all_pts)
    right = max(adv, x_max)
    left = min(0, x_min)
    ranges = {}
    if bases:
        widths = [max(hmtx[comps[i]][0], 1) for i in bases]
        total = sum(widths)
        x = right
        for i, w in zip(bases, widths):
            x0 = x - (right - left) * w / total
            ranges[i] = (x0, x)
            x = x0
    boxes = [bbox(c) for c in lig_c]
    # 3) Zeichen (Vokale usw.) über Größe und Lage zuordnen: kleine Konturen im
    #    Bereich ihres Grundbuchstabens, deren Maße dem Zeichen ähneln.
    def base_of(m):
        prev = [b for b in bases if b < m]
        return prev[-1] if prev else (bases[0] if bases else None)
    cands = []
    for m in marks:
        if any(owner[k] == m for k in range(len(lig_c))):
            continue
        ref = bbox([p for c in contours(comps[m]) for p in c]) if contours(comps[m]) else None
        if ref is None:
            continue
        b = base_of(m)
        for ci in outers:
            if owner[ci] is not None:
                continue
            bx = boxes[ci]
            if (bx[2] - bx[0]) > 900 or (bx[3] - bx[1]) > 900:
                continue
            if b is not None:
                r0, r1 = ranges[b]
                pad = (r1 - r0) * 0.35 + 120
                cx = (bx[0] + bx[2]) / 2
                if not (r0 - pad <= cx <= r1 + pad):
                    continue
            sc = size_score(bx, ref)
            if sc < 0.9:
                cands.append((sc, m, ci))
    cands.sort()
    used_m = set()
    for sc, m, ci in cands:
        if m in used_m or owner[ci] is not None:
            continue
        owner[ci] = m
        used_m.add(m)
    # 4) Restliche äußere Konturen: ganz in einem Bereich -> dieser Buchstabe,
    #    sonst an den Grenzen teilen (-1).
    for ci in outers:
        if owner[ci] is not None:
            continue
        if not ranges:
            owner[ci] = marks[0] if marks else 0
            continue
        bx0, _, bx1, _ = boxes[ci]
        wid = max(bx1 - bx0, 1)
        best, best_share = None, 0
        for i, (r0, r1) in ranges.items():
            share = max(0, min(bx1, r1) - max(bx0, r0)) / wid
            if share > best_share:
                best, best_share = i, share
        owner[ci] = best if best_share >= 0.85 else -1
    # Löcher gehören zu ihrer äußeren Kontur.
    for ci in range(len(lig_c)):
        if parent[ci] != ci:
            owner[ci] = owner[parent[ci]]
    return {
        "n": n,
        "marks": marks,
        "owner": owner,
        "parent": parent,
        "ranges": [[i, round(ranges[i][0]), round(ranges[i][1])] for i in bases],
    }


result = {}
for lig, variants in rules.items():
    comps = flatten(variants[0])
    info = analyse(lig, comps)
    if info is None:
        continue
    # Varianten mit anderer Bestandteil-Anzahl merken (z. B. andere Schreibung).
    other_n = sorted({len(flatten(v)) for v in variants} - {info["n"]})
    if other_n:
        info["alt_n"] = other_n
    info["name"] = lig
    result[str(gid_of[lig])] = info

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
print(f"{len(result)} Ligaturen -> {os.path.relpath(OUT, ROOT)}", file=sys.stderr)

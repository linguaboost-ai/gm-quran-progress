// Oberfläche: Stelle (Sure/Vers oder Seite) und Lektion wählen, Seite zeigen,
// Downloads erzeugen.

import * as hb from "./vendor/harfbuzzjs/index.mjs";
import { MushafRenderer, pageSVG, COLORS } from "./mushaf.js";
import { parseCurriculum, displayItem, LAST_LESSON, NEUTRAL } from "./curriculum.js";
import { buildPdf, buildAppJson } from "./export.js";

const $ = (id) => document.getElementById(id);
const pad3 = (n) => String(n).padStart(3, "0");

const state = { wholeWords: false, page: 1, lesson: 1, mode: "verse", surah: 1, ayah: 1 };
let renderer, meta, lessons;
const models = new Map();

// ---------------------------------------------------------------- Laden
async function loadAll() {
  const [font, ligatures, metaJson, csv] = await Promise.all([
    fetch("fonts/UthmanicHafs-v-3.0.ttf").then((r) => r.arrayBuffer()),
    fetch("data/ligatures.json").then((r) => r.json()),
    fetch("data/meta.json").then((r) => r.json()),
    fetch("curriculum.csv").then((r) => r.text()),
  ]);
  renderer = new MushafRenderer(hb, font, ligatures);
  meta = metaJson;
  lessons = parseCurriculum(csv);
}

async function getModel(page) {
  const key = `${page}:${state.wholeWords ? "w" : "z"}`;
  if (models.has(key)) return models.get(key);
  const data = await fetch(`data/pages/${pad3(page)}.json`).then((r) => r.json());
  const model = renderer.buildPage(data, meta, { wholeWords: state.wholeWords });
  models.set(key, model);
  if (models.size > 12) models.delete(models.keys().next().value);
  return model;
}

// ---------------------------------------------------------------- Anzeige
let current = null;
let renderToken = 0;

async function showPage() {
  const token = ++renderToken;
  const host = $("page");
  host.setAttribute("aria-busy", "true");
  const model = await getModel(state.page);
  if (token !== renderToken) return;
  current = model;
  host.innerHTML = pageSVG(model, state.lesson, { width: "100%", height: "100%" });
  host.setAttribute("aria-busy", "false");
  host.querySelector("svg").setAttribute("role", "img");
  updatePageInfo();
  applyLesson();
}

function applyLesson() {
  const L = state.lesson;
  if (current) {
    for (const p of $("page").querySelectorAll("path[data-lesson]")) {
      p.setAttribute("fill", +p.dataset.lesson <= L ? COLORS.known : COLORS.unknown);
    }
    const title = $("page").querySelector("svg title");
    if (title) title.textContent = `Mushaf Seite ${current.page} – Lektion ${L}`;
    // Anteil bekannter Zeichen auf der Seite
    let all = 0, known = 0;
    for (const line of current.data.lines) {
      for (const t of line.tokens || []) {
        if (!t.lessons || !t.w) continue;
        for (const l of t.lessons) {
          if (l === NEUTRAL) continue;
          all++;
          if (l <= L) known++;
        }
      }
    }
    const pct = all ? Math.round((known / all) * 100) : 0;
    $("knownBar").style.width = pct + "%";
    $("knownText").textContent = `${pct} % der Buchstaben und Zeichen dieser Seite sind bekannt`;
  }
  $("lessonNo").textContent = L;
  $("lessonRange").value = L;
  for (const el of document.querySelectorAll(".cur-lesson")) el.textContent = L;
  for (const el of $("lessonList").children) {
    const n = +el.dataset.lesson;
    el.classList.toggle("current", n === L);
    el.classList.toggle("done", n < L);
    el.setAttribute("aria-selected", n === L ? "true" : "false");
  }
  writeHash();
}

function updatePageInfo() {
  const d = current.data;
  const s = meta.surahs[d.surah - 1];
  $("pageTitle").textContent = `Seite ${d.page}`;
  $("pageSub").innerHTML = `Sure ${s.n} · ${s.name} · Juz ${d.juz}`;
  $("pageInput").value = d.page;
  $("pageNextNo").textContent = Math.min(604, d.page + 1);
  $("pagePrevNo").textContent = Math.max(1, d.page - 1);
  $("pageNext").disabled = d.page >= 604;
  $("pagePrev").disabled = d.page <= 1;
  // Sure/Vers-Felder auf den ersten Vers der Seite setzen, wenn die Seite
  // nicht über Sure/Vers gewählt wurde
  const inPage = (sn, an) => meta.surahs[sn - 1].pages[an - 1] === d.page;
  if (!inPage(state.surah, state.ayah)) {
    const first = d.lines.flatMap((l) => l.tokens || []).find((t) => t.k && t.k.split(":").length === 3);
    if (first) {
      const [sn, an] = first.k.split(":").map(Number);
      state.surah = sn;
      state.ayah = an;
    }
  }
  $("surahSelect").value = state.surah;
  $("ayahInput").max = meta.surahs[state.surah - 1].ayahs;
  $("ayahInput").value = state.ayah;
  $("verseHint").textContent = `Sure ${state.surah}, Vers ${state.ayah} steht auf Seite ${meta.surahs[state.surah - 1].pages[state.ayah - 1]}.`;
  writeHash();
}

// ---------------------------------------------------------------- Zustand in der Adresse
function writeHash() {
  const h = state.mode === "verse"
    ? `#sure=${state.surah}&vers=${state.ayah}&lektion=${state.lesson}`
    : `#seite=${state.page}&lektion=${state.lesson}`;
  if (location.hash !== h) history.replaceState(null, "", h);
}

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const page = +p.get("seite");
  const lesson = +p.get("lektion");
  const sure = +p.get("sure");
  const vers = +p.get("vers");
  if (sure >= 1 && sure <= 114) {
    state.surah = sure;
    state.ayah = Math.min(Math.max(vers || 1, 1), meta.surahs[sure - 1].ayahs);
    state.page = meta.surahs[sure - 1].pages[state.ayah - 1];
  } else if (page >= 1 && page <= 604) state.page = page;
  if (lesson >= 1 && lesson <= LAST_LESSON) state.lesson = lesson;
}

// ---------------------------------------------------------------- Bedienung
function setLesson(l) {
  state.lesson = Math.min(Math.max(l, 1), LAST_LESSON);
  applyLesson();
}

function setPage(p) {
  const n = Math.min(Math.max(Math.round(p) || 1, 1), 604);
  if (n === state.page && current) return;
  state.page = n;
  showPage();
}

function setVerse(s, a) {
  state.surah = Math.min(Math.max(s, 1), 114);
  const max = meta.surahs[state.surah - 1].ayahs;
  state.ayah = Math.min(Math.max(a || 1, 1), max);
  const page = meta.surahs[state.surah - 1].pages[state.ayah - 1];
  if (page !== state.page) {
    state.page = page;
    showPage();
  } else updatePageInfo();
}

function setMode(mode) {
  state.mode = mode;
  $("modeVerse").classList.toggle("on", mode === "verse");
  $("modePage").classList.toggle("on", mode === "page");
  $("modeVerse").setAttribute("aria-selected", mode === "verse");
  $("modePage").setAttribute("aria-selected", mode === "page");
  $("verseFields").hidden = mode !== "verse";
  $("pageFields").hidden = mode !== "page";
  writeHash();
}

function buildLessonList() {
  const list = $("lessonList");
  list.innerHTML = "";
  for (const l of lessons) {
    const b = document.createElement("button");
    b.className = "side-lesson";
    b.dataset.lesson = l.n;
    b.setAttribute("role", "option");
    const items = l.items
      .map((it) => (/[؀-ۿ]/.test(it) && !/[a-zA-Z]/.test(it)
        ? `<bdi class="ar-inline item" lang="ar" dir="rtl">${displayItem(it)}</bdi>`
        : `<span class="item">${it.replace(/[؀-ۿࣰ-ࣲ]+/g, (m) => `<bdi class="ar-inline" lang="ar" dir="rtl">${m}</bdi>`)}</span>`))
      .join(" ");
    b.innerHTML = `<span class="num-badge">${l.n}</span><span class="side-lesson-text"><span class="side-lesson-title">Lektion ${l.n}</span><span class="side-lesson-sub">${items}</span></span>`;
    b.addEventListener("click", () => setLesson(l.n));
    list.appendChild(b);
  }
}

function buildSurahSelect() {
  const sel = $("surahSelect");
  sel.innerHTML = meta.surahs.map((s) => `<option value="${s.n}">${s.n} · ${s.name}</option>`).join("");
}

// ---------------------------------------------------------------- Downloads
function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}

let pdfLibPromise;
function loadPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  pdfLibPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "js/vendor/pdf-lib.min.js";
    s.onload = () => resolve(window.PDFLib);
    s.onerror = () => reject(new Error("pdf-lib konnte nicht geladen werden"));
    document.head.appendChild(s);
  });
  return pdfLibPromise;
}

async function withBusy(btn, label, fn) {
  const status = $("dlStatus");
  btn.setAttribute("aria-busy", "true");
  btn.disabled = true;
  status.classList.remove("error");
  status.textContent = label;
  try {
    await new Promise((r) => setTimeout(r, 20));
    await fn();
    status.textContent = "Fertig.";
    setTimeout(() => { if (status.textContent === "Fertig.") status.textContent = ""; }, 2500);
  } catch (e) {
    console.error(e);
    status.classList.add("error");
    status.textContent = "Fehler: " + e.message;
  } finally {
    btn.removeAttribute("aria-busy");
    btn.disabled = false;
  }
}

const baseName = () => `mushaf-seite-${pad3(state.page)}`;

async function pdf(lessonList, name, btn) {
  await withBusy(btn, "PDF wird erstellt …", async () => {
    const PDFLib = await loadPdfLib();
    const bytes = await buildPdf(PDFLib, current, lessonList, { label: $("labelToggle").checked });
    download(new Blob([bytes], { type: "application/pdf" }), name);
  });
}

function svgBlob(lesson) {
  const svg = pageSVG(current, lesson, { width: 1000, height: 1414 });
  return new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', svg], { type: "image/svg+xml" });
}

async function png(btn) {
  await withBusy(btn, "PNG wird erstellt …", async () => {
    const url = URL.createObjectURL(svgBlob(state.lesson));
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("SVG konnte nicht gezeichnet werden")); img.src = url; });
    const W = 2000, H = Math.round(2000 * 1.414);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    canvas.getContext("2d").drawImage(img, 0, 0, W, H);
    URL.revokeObjectURL(url);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
    download(blob, `${baseName()}-lektion-${state.lesson}.png`);
  });
}

// ---------------------------------------------------------------- Start
async function main() {
  try {
    await loadAll();
  } catch (e) {
    $("page").innerHTML = `<div class="loading"><p class="error">Laden fehlgeschlagen: ${e.message}</p><p class="muted">Die Seite muss über einen Webserver geöffnet werden (nicht per Doppelklick).</p></div>`;
    return;
  }
  document.querySelector(".swatch.known").style.background = COLORS.known;
  document.querySelector(".swatch.unknown").style.background = COLORS.unknown;
  buildLessonList();
  buildSurahSelect();
  readHash();
  setMode(location.hash.includes("seite=") && !location.hash.includes("sure=") ? "page" : "verse");

  $("lessonRange").addEventListener("input", (e) => setLesson(+e.target.value));
  $("lessonPrev").addEventListener("click", () => setLesson(state.lesson - 1));
  $("lessonNext").addEventListener("click", () => setLesson(state.lesson + 1));
  $("pageNext").addEventListener("click", () => setPage(state.page + 1));
  $("pagePrev").addEventListener("click", () => setPage(state.page - 1));
  $("pageInput").addEventListener("change", (e) => setPage(+e.target.value));
  $("surahSelect").addEventListener("change", (e) => setVerse(+e.target.value, 1));
  $("ayahInput").addEventListener("change", (e) => setVerse(state.surah, +e.target.value));
  $("modeVerse").addEventListener("click", () => setMode("verse"));
  $("modePage").addEventListener("click", () => setMode("page"));
  $("dlAll").addEventListener("click", (e) => {
    const all = Array.from({ length: LAST_LESSON }, (_, i) => i + 1);
    pdf(all, `${baseName()}-lektionen-1-60.pdf`, e.currentTarget);
  });
  $("dlPdf").addEventListener("click", (e) => pdf([state.lesson], `${baseName()}-lektion-${state.lesson}.pdf`, e.currentTarget));
  $("dlSvg").addEventListener("click", () => download(svgBlob(state.lesson), `${baseName()}-lektion-${state.lesson}.svg`));
  $("dlPng").addEventListener("click", (e) => png(e.currentTarget));
  $("dlJson").addEventListener("click", () => {
    const json = JSON.stringify(buildAppJson(current, state.lesson, meta));
    download(new Blob([json], { type: "application/json" }), `${baseName()}.json`);
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, select, textarea")) return;
    if (e.key === "ArrowLeft") setPage(state.page + 1); // Mushaf: links = weiter
    if (e.key === "ArrowRight") setPage(state.page - 1);
    if (e.key === "ArrowUp" || e.key === "+") { e.preventDefault(); setLesson(state.lesson + 1); }
    if (e.key === "ArrowDown" || e.key === "-") { e.preventDefault(); setLesson(state.lesson - 1); }
  });
  $("wholeWordsToggle").addEventListener("change", (e) => {
    state.wholeWords = e.target.checked;
    showPage();
  });
  window.addEventListener("hashchange", () => {
    const before = state.page;
    readHash();
    if (state.page !== before) showPage();
    else applyLesson();
  });
  await showPage();
  // nur die Liste scrollen, nicht das ganze Fenster (Handy)
  const list = $("lessonList");
  const cur = list.querySelector(".side-lesson.current");
  if (cur && list.scrollHeight > list.clientHeight + 4) list.scrollTop = cur.offsetTop - list.offsetTop - list.clientHeight / 2;
}

main();

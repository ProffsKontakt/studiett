import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import * as canvas from "./canvas.js";
import * as timeedit from "./timeedit.js";

const here = dirname(fileURLToPath(import.meta.url));
const MINUTE = 60 * 1000;

// Slår ihop flera adaptrars delresultat till en NormalizedBundle. Första förekomsten vinner.
export function merge(base, ...parts) {
  const out = { ...base, courses: [...(base.courses ?? [])], events: [...(base.events ?? [])],
    assignments: [...(base.assignments ?? [])], examRegistrations: [...(base.examRegistrations ?? [])] };
  for (const p of parts) {
    if (p.program && !out.program) out.program = p.program;
    for (const k of ["courses", "events", "assignments", "examRegistrations"]) {
      for (const item of p[k] ?? []) {
        const key = item.id ?? `${item.code ?? item.course}:${item.module ?? ""}`;
        if (!out[k].some(x => (x.id ?? `${x.code ?? x.course}:${x.module ?? ""}`) === key)) out[k].push(item);
      }
    }
  }
  return out;
}

// Kopplingar kommer i första hand från studentens webbläsare (skickas med varje anrop,
// lagras aldrig här), i andra hand från .env. Finns ingen av dem körs mockprofilen.
export function liveConfig(env = process.env, connections = null) {
  const c = connections && typeof connections === "object" ? connections : {};
  const sources = [];
  const canvasConn = c.canvas?.token ? c.canvas : env.CANVAS_TOKEN ? { baseUrl: env.CANVAS_BASE_URL ?? "https://canvas.kth.se", token: env.CANVAS_TOKEN } : null;
  if (canvasConn) sources.push({ name: "canvas", fetch: () => canvas.fetchAll(canvasConn) });
  const timeeditUrl = c.timeedit?.icalUrl || env.TIMEEDIT_ICAL_URL;
  if (timeeditUrl) sources.push({ name: "timeedit", fetch: () => timeedit.fetchAll({ icalUrl: timeeditUrl, source: "timeedit" }) });
  if (c.kronox?.icalUrl) sources.push({ name: "kronox", fetch: () => timeedit.fetchAll({ icalUrl: c.kronox.icalUrl, source: "kronox" }) });
  if (c.ical?.icalUrl) sources.push({ name: "ical", fetch: () => timeedit.fetchAll({ icalUrl: c.ical.icalUrl, source: "ical" }) });
  return sources;
}

function cacheKey(student, connections) {
  const h = createHash("sha256").update(JSON.stringify(connections ?? null)).digest("hex").slice(0, 16);
  return `live:${student}:${h}`;
}

const cache = new Map(); // key -> { at, bundle }

// overlay = Ladok-data som studenten importerat från intyg (skickas med från klienten,
// lagras aldrig på servern). Den ersätter program och kurser från mock/LADOK_MOCK.
export async function loadBundle(student = process.env.STUDENT ?? "viktor", env = process.env, overlay = null) {
  const connections = overlay?.connections ?? null;
  const sources = liveConfig(env, connections);
  let bundle = sources.length === 0 ? await loadMock(student) : await loadLive(student, env, sources, connections);
  const profile = connections?.profile;
  if (profile && typeof profile === "object") {
    bundle = { ...bundle, student: { ...bundle.student, name: String(profile.name || bundle.student.name || ""), institution: String(profile.institution || bundle.student.institution || "") } };
  }
  return overlay?.ladok ? applyOverlay(bundle, overlay.ladok) : bundle;
}

async function loadLive(student, env, sources, connections) {
  const ttl = Number(env.CACHE_TTL_MIN ?? 10) * MINUTE;
  const key = cacheKey(student, connections);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return { ...hit.bundle, cached: true };

  const results = await Promise.allSettled(sources.map(s => s.fetch()));
  const status = {};
  const parts = [];
  results.forEach((r, i) => {
    const name = sources[i].name;
    if (r.status === "fulfilled") { status[name] = "ok"; parts.push(r.value); }
    else {
      // Felmeddelanden från adaptrarna innehåller status och sökväg, aldrig token eller länk.
      const cause = r.reason?.cause?.code ? ` (${r.reason.cause.code})` : "";
      status[name] = String(r.reason?.message ?? r.reason) + cause;
      console.error(`[${name}] ${status[name]}`);
    }
  });

  // Ladok saknar API. Tills dess kan program, kurser och tentafönster underhållas för hand
  // i en mockprofil och läggas ovanpå de riktiga källorna (LADOK_MOCK=viktor).
  if (env.LADOK_MOCK) {
    const mock = await loadMock(env.LADOK_MOCK);
    parts.push({ program: mock.program, courses: mock.courses, examRegistrations: mock.examRegistrations });
    status.ladok = `mock:${env.LADOK_MOCK}`;
  } else {
    status.ladok = "saknas";
  }

  const base = {
    fetchedAt: new Date().toISOString(),
    student: { id: student, name: connections?.profile?.name ?? env.STUDENT_NAME ?? "", institution: connections?.profile?.institution ?? env.INSTITUTION ?? "KTH" },
    courses: [], events: [], assignments: [], examRegistrations: [],
  };
  const bundle = { ...merge(base, ...parts), sources: status };
  // Cacha bara hela svar. Ett misslyckat anrop ska försökas igen vid nästa sidladdning.
  if (results.every(r => r.status === "fulfilled")) cache.set(key, { at: Date.now(), bundle });
  return bundle;
}

function applyOverlay(bundle, overlay) {
  const courses = Array.isArray(overlay.courses) ? overlay.courses : [];
  const exams = Array.isArray(overlay.examRegistrations) && overlay.examRegistrations.length ? overlay.examRegistrations : bundle.examRegistrations;
  // Intyget ersätter all Ladok-härledd kursdata (mock och LADOK_MOCK). Kurser från riktiga
  // adaptrar (Canvas, märkta med source) behålls så att deadlines fortfarande hör till en kurs.
  const live = bundle.courses.filter(c => c.source && c.source !== "ladok");
  const merged = merge({ ...bundle, program: overlay.program ?? bundle.program, courses: [], examRegistrations: exams }, { courses }, { courses: live });
  const n = Array.isArray(overlay.intyg) ? overlay.intyg.length : 0;
  return { ...merged, sources: { ...bundle.sources, ladok: `intyg:${n}` } };
}

async function loadMock(student) {
  const file = join(here, "..", "data", `${student}.json`);
  const bundle = JSON.parse(await readFile(file, "utf8"));
  bundle.fetchedAt = new Date().toISOString();
  bundle.sources = { canvas: `mock:${student}`, timeedit: `mock:${student}`, ladok: `mock:${student}` };
  return shiftToToday(bundle);
}

// Mockprofilerna har ett "anchor"-datum. Vi flyttar alla tidsstämplar så att anchor = idag,
// så att demon ser levande ut oavsett vilken dag den körs. Tas bort med riktiga adaptrar.
function shiftToToday(bundle) {
  if (!bundle.anchor) return bundle;
  const anchor = new Date(bundle.anchor);
  const today = new Date(); today.setHours(anchor.getHours(), anchor.getMinutes(), 0, 0);
  const delta = today - anchor;
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
  const walk = v => {
    if (typeof v === "string" && iso.test(v)) return new Date(new Date(v).getTime() + delta).toISOString();
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "anchor" || k === "fetchedAt" ? x : walk(x)]));
    return v;
  };
  return walk(bundle);
}

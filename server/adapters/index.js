import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// Slår ihop flera adaptrars delresultat till en NormalizedBundle.
export function merge(base, ...parts) {
  const out = { ...base, courses: [...(base.courses ?? [])], events: [...(base.events ?? [])],
    assignments: [...(base.assignments ?? [])], examRegistrations: [...(base.examRegistrations ?? [])] };
  for (const p of parts) {
    for (const k of ["courses", "events", "assignments", "examRegistrations"]) {
      for (const item of p[k] ?? []) {
        const key = item.id ?? `${item.code ?? item.course}:${item.module ?? ""}`;
        if (!out[k].some(x => (x.id ?? `${x.code ?? x.course}:${x.module ?? ""}`) === key)) out[k].push(item);
      }
    }
  }
  return out;
}

export async function loadBundle(student = process.env.STUDENT ?? "viktor") {
  // MVP: mockprofil från disk. När adaptrarna är klara byts detta mot riktiga anrop + merge().
  const file = join(here, "..", "data", `${student}.json`);
  const bundle = JSON.parse(await readFile(file, "utf8"));
  bundle.fetchedAt = new Date().toISOString();
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

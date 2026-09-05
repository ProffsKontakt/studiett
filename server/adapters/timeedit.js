// iCal-adapter för scheman. TimeEdit och KronoX ger båda en prenumerationslänk (webcal/ics)
// som studenten hämtar själv under "Prenumerera". Samma parser tar också vilken annan
// kalender som helst som exporterar iCal (Moodle, Itslearning, SchoolSoft, Vklass, Outlook, Google).
// Ingen inloggning behövs; länken är hemligheten.
// KTH: https://cloud.timeedit.net/kth/web/student/   KronoX: https://kronox.se/
import { publicHttpsUrl, fetchText, NetError } from "../net.js";

const TYPE_MAP = [
  [/tenta|exam|kontrollskrivning|KS/i, "exam"],
  [/lab/i, "lab"],
  [/övning|exercise|räknestuga/i, "exercise"],
  [/seminar/i, "seminar"],
  [/föreläsning|lecture/i, "lecture"],
];

function icalDate(v) {
  // 20260904T101500Z or 20260904T101500 (floating; TimeEdit anger TZID) or 20260904
  const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z?)/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00", z] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}`;
  return z ? `${iso}Z` : fromStockholm(iso);
}

// Tolkar en lokal tid i Europe/Stockholm (TimeEdit anger TZID) utan beroenden.
// Gissar UTC, mäter avvikelsen med Intl och korrigerar. Klarar sommar- och vintertid.
const stockholm = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
function fromStockholm(localIso) {
  const guess = new Date(`${localIso}Z`);
  const parts = Object.fromEntries(stockholm.formatToParts(guess).map(p => [p.type, p.value]));
  const seen = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess.getTime() - (seen - guess.getTime())).toISOString();
}

function unfold(text) {
  return text.replace(/\r?\n[ \t]/g, "");
}

export function parseIcal(text, source = "timeedit") {
  const events = [];
  const blocks = unfold(text).split("BEGIN:VEVENT").slice(1);
  for (const b of blocks) {
    const get = key => {
      const m = b.match(new RegExp(`^${key}[^:\\n]*:(.*)$`, "m"));
      return m ? m[1].trim().replace(/\\,/g, ",").replace(/\\n/g, " ") : "";
    };
    const summary = get("SUMMARY");
    const codeMatch = summary.match(/\b([A-Z]{2}\d{4}[A-Z]?)\b/);
    const type = TYPE_MAP.find(([re]) => re.test(summary))?.[1] ?? "other";
    const start = icalDate(get("DTSTART"));
    if (!start) continue;
    events.push({
      id: `${source}:${get("UID") || start}`,
      source,
      course: codeMatch?.[1],
      type,
      title: summary,
      start,
      end: icalDate(get("DTEND")) ?? start,
      location: get("LOCATION") || undefined,
      mandatory: /oblig/i.test(summary + get("DESCRIPTION")),
    });
  }
  return events;
}

const NAMES = { timeedit: "TimeEdit", kronox: "KronoX", ical: "Kalendern" };

async function fetchCalendar(icalUrl, source) {
  const url = publicHttpsUrl(icalUrl);
  const r = await fetchText(url, { headers: { accept: "text/calendar, */*" } });
  const name = NAMES[source] ?? "Kalendern";
  if (r.status !== 200) throw new NetError(r.status === 404 ? 404 : 502, `${name} svarade ${r.status}.`);
  if (!/BEGIN:VCALENDAR/.test(r.text)) throw new NetError(422, `${name} svarade, men inte med en kalender. Kontrollera att det är prenumerationslänken (.ics), inte sidan.`);
  return r.text;
}

export async function fetchAll({ icalUrl, source = "timeedit" }) {
  return { events: parseIcal(await fetchCalendar(icalUrl, source), source) };
}

// Kvitto vid koppling: hur många händelser länken ger, och när nästa är.
export async function verify({ icalUrl, source = "timeedit" }) {
  const events = parseIcal(await fetchCalendar(icalUrl, source), source);
  const now = Date.now();
  const upcoming = events.filter(e => new Date(e.start).getTime() >= now).sort((a, b) => a.start.localeCompare(b.start));
  return { ok: true, events: events.length, upcoming: upcoming.length, next: upcoming[0]?.start ?? null, courses: [...new Set(events.map(e => e.course).filter(Boolean))] };
}

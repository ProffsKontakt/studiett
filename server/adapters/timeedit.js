// TimeEdit adapter. Studenten hämtar sin iCal-prenumerationslänk i TimeEdit
// (Prenumerera → kopiera länk). Vi hämtar och parsar. Ingen inloggning behövs.
// KTH: https://cloud.timeedit.net/kth/web/student/

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

export function parseIcal(text) {
  const events = [];
  const blocks = unfold(text).split("BEGIN:VEVENT").slice(1);
  for (const b of blocks) {
    const get = key => {
      const m = b.match(new RegExp(`^${key}[^:\\n]*:(.*)$`, "m"));
      return m ? m[1].trim().replace(/\\,/g, ",").replace(/\\n/g, " ") : "";
    };
    const summary = get("SUMMARY");
    const codeMatch = summary.match(/\b([A-Z]{2}\d{4})\b/);
    const type = TYPE_MAP.find(([re]) => re.test(summary))?.[1] ?? "other";
    events.push({
      id: `timeedit:${get("UID")}`,
      source: "timeedit",
      course: codeMatch?.[1],
      type,
      title: summary,
      start: icalDate(get("DTSTART")),
      end: icalDate(get("DTEND")),
      location: get("LOCATION") || undefined,
      mandatory: /oblig/i.test(summary + get("DESCRIPTION")),
    });
  }
  return events;
}

export async function fetchAll({ icalUrl }) {
  const res = await fetch(icalUrl);
  if (!res.ok) throw new Error(`TimeEdit ${res.status}`);
  return { events: parseIcal(await res.text()) };
}

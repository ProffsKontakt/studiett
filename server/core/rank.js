// Rangordningen är produkten. Allt här ska gå att förklara i en mening för studenten.
//
// score = consequence * urgency
//
// consequence: vad det kostar att missa, 0..100.
// urgency:     hur nära i tid, 0..1, med brant stigning sista 48 h.

const HOUR = 3600 * 1000;
const WINDOW_DAYS = 7;

// Konsekvensvikter. Justeras mot verkligt beteende, inte magkänsla.
const CONSEQUENCE = {
  exam_registration_closing: 100, // missad anmälan = hel tentaomgång borta
  exam: 95,
  mandatory_event: 70,            // obligatoriskt moment, ofta hp-bärande
  graded_assignment: 60,
  lab: 50,
  assignment: 35,
  seminar: 30,
  exercise: 20,
  lecture: 15,
  other: 10,
};

function urgency(deadlineIso, now) {
  const hours = (new Date(deadlineIso) - now) / HOUR;
  if (hours < 0) return 0;                       // passerat, visas inte
  if (hours <= 24) return 1;
  if (hours <= 48) return 0.85;
  if (hours <= 24 * WINDOW_DAYS) return 0.7 - (hours / (24 * WINDOW_DAYS)) * 0.4;
  return 0;
}

function explain(kind, item, hoursLeft) {
  const when = hoursLeft <= 24 ? "idag" : hoursLeft <= 48 ? "imorgon" : `om ${Math.round(hoursLeft / 24)} dagar`;
  switch (kind) {
    case "exam_registration_closing":
      return `Anmälan stänger ${when}. Du är inte anmäld. Missar du den väntar du till nästa omgång.`;
    case "exam":
      return `Tenta ${when}. ${item.hp ? item.hp + " hp" : ""}`.trim();
    case "mandatory_event":
      return `Obligatoriskt moment ${when}.`;
    case "graded_assignment":
      return `Betygsgrundande inlämning ${when}.`;
    default:
      return `${when.charAt(0).toUpperCase() + when.slice(1)}.`;
  }
}

export function rank(bundle, now = new Date()) {
  const items = [];

  for (const r of bundle.examRegistrations) {
    if (r.registered) continue;
    const kind = "exam_registration_closing";
    const u = urgency(r.registrationCloses, now);
    if (u === 0) continue;
    items.push({
      kind,
      course: r.course,
      title: `Anmäl dig till ${r.course} ${r.module}`,
      at: r.registrationCloses,
      url: r.url,
      score: CONSEQUENCE[kind] * u,
      why: explain(kind, r, (new Date(r.registrationCloses) - now) / HOUR),
    });
  }

  for (const e of bundle.events) {
    const kind = e.type === "exam" ? "exam" : e.mandatory ? "mandatory_event" : e.type;
    const u = urgency(e.start, now);
    if (u === 0) continue;
    items.push({
      kind,
      course: e.course,
      title: e.title,
      at: e.start,
      end: e.end,
      location: e.location,
      url: e.url,
      score: (CONSEQUENCE[kind] ?? CONSEQUENCE.other) * u,
      why: explain(kind, e, (new Date(e.start) - now) / HOUR),
    });
  }

  for (const a of bundle.assignments) {
    if (a.submitted) continue;
    const kind = a.graded ? "graded_assignment" : "assignment";
    const u = urgency(a.due, now);
    if (u === 0) continue;
    items.push({
      kind,
      course: a.course,
      title: a.title,
      at: a.due,
      url: a.url,
      score: CONSEQUENCE[kind] * u,
      why: explain(kind, a, (new Date(a.due) - now) / HOUR),
    });
  }

  items.sort((a, b) => b.score - a.score || new Date(a.at) - new Date(b.at));
  return { generatedAt: now.toISOString(), top: items[0] ?? null, items: items.slice(1) };
}

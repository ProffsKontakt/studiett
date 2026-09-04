// Canvas LMS adapter. Kräver personlig access token (Konto → Inställningar → Ny åtkomsttoken).
// Körs på servern: Canvas svarar inte med CORS-headers för tokenanrop från webbläsare.
// Docs: https://canvas.instructure.com/doc/api/
//
// KTH: https://canvas.kth.se

async function get(base, token, path) {
  const res = await fetch(`${base}/api/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Canvas ${res.status} ${path}`);
  return res.json();
}

export async function fetchAll({ baseUrl, token }) {
  const courses = await get(baseUrl, token, "/courses?enrollment_state=active&per_page=50");
  const assignments = [];
  const events = [];

  for (const c of courses) {
    const code = (c.course_code ?? "").split(/\s/)[0]; // "SF1624 HT26" -> "SF1624"
    const as = await get(baseUrl, token, `/courses/${c.id}/assignments?per_page=100&include[]=submission`);
    for (const a of as) {
      if (!a.due_at) continue;
      assignments.push({
        id: `canvas:${a.id}`,
        source: "canvas",
        course: code,
        title: a.name,
        due: a.due_at,
        submitted: Boolean(a.submission?.submitted_at),
        graded: (a.points_possible ?? 0) > 0 && !a.omit_from_final_grade,
        url: a.html_url,
      });
    }
    const evs = await get(baseUrl, token, `/calendar_events?context_codes[]=course_${c.id}&per_page=100&all_events=true`);
    for (const e of evs) {
      if (!e.start_at) continue;
      events.push({
        id: `canvas:${e.id}`,
        source: "canvas",
        course: code,
        type: "other",
        title: e.title,
        start: e.start_at,
        end: e.end_at ?? e.start_at,
        location: e.location_name,
        url: e.html_url,
      });
    }
  }

  return {
    courses: courses.map(c => ({
      source: "canvas",
      code: (c.course_code ?? "").split(/\s/)[0],
      name: c.name,
      hp: 0,              // Canvas vet inte hp. Ladok fyller i.
      term: "",
      status: "registered",
    })),
    assignments,
    events,
  };
}

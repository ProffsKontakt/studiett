// Studiett klient. Ingen produktlogik här: allt rangordnas och räknas på servern (server/core).
// Klienten översätter JSON till fyra vyer och en verktygsrad: tre funktioner, Kopplingar och
// uppdatera/notiser/utseende/logga ut i toppraden.

const view = document.getElementById("view");
const tabs = [...document.querySelectorAll(".tab")];

const fmtTime = iso => new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
const fmtDay = iso => new Date(iso).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
const fmtShort = iso => new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
const fmtLong = iso => new Date(iso).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const isToday = iso => new Date(iso).toDateString() === new Date().toDateString();
const isTomorrow = iso => { const d = new Date(); d.setDate(d.getDate() + 1); return new Date(iso).toDateString() === d.toDateString(); };

/* ---------- Ladok-data i webbläsaren ---------- */
// Importerade intyg sparas bara här, i studentens egen webbläsare, och skickas med
// varje anrop. Servern lagrar dem aldrig. Ta bort = borta.
const LADOK_KEY = "studiett.ladok";
function ladokGet() { try { return JSON.parse(localStorage.getItem(LADOK_KEY) || "null"); } catch { return null; } }
function ladokSet(v) { try { if (v) localStorage.setItem(LADOK_KEY, JSON.stringify(v)); else localStorage.removeItem(LADOK_KEY); } catch {} }

/* ---------- Kopplingar i webbläsaren ---------- */
// Token och länkar sparas bara här, i studentens egen webbläsare, och skickas med varje
// anrop. Servern lagrar dem aldrig. Koppla bort = borta.
const CONN_KEY = "studiett.connections";
function connGet() { try { return JSON.parse(localStorage.getItem(CONN_KEY) || "null") ?? {}; } catch { return {}; } }
function connSet(v) { try { if (v && Object.keys(v).length) localStorage.setItem(CONN_KEY, JSON.stringify(v)); else localStorage.removeItem(CONN_KEY); } catch {} }
function connPayload() {
  const c = connGet();
  const out = {};
  if (c.canvas?.token) out.canvas = { baseUrl: c.canvas.baseUrl, token: c.canvas.token };
  for (const k of ["timeedit", "kronox", "ical"]) if (c[k]?.icalUrl) out[k] = { icalUrl: c[k].icalUrl };
  if (c.canvas?.name) out.profile = { name: c.canvas.name, institution: c.canvas.institution };
  return Object.keys(out).length ? out : null;
}

async function load(path) {
  const ladok = ladokGet();
  const connections = connPayload();
  let res;
  try {
    res = ladok || connections
      ? await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ladok, connections }) })
      : await fetch(path);
  } catch {
    throw new Error("Ingen anslutning.");
  }
  if (!res.ok) throw new Error(`Servern svarade ${res.status}.`);
  return res.json();
}

// Slår ihop ett nytt intyg med tidigare importerade. Samma regler som server/adapters/ladok.js mergeLadok,
// men körs här eftersom datan bor i webbläsaren. Status: completed > registered > rest.
function mergeIntyg(existing, incoming) {
  const rank = { completed: 3, registered: 2, rest: 1 };
  const byCode = new Map();
  for (const c of [...(existing?.courses ?? []), ...(incoming.courses ?? [])]) {
    const prev = byCode.get(c.code);
    if (!prev) { byCode.set(c.code, { ...c, modules: (c.modules ?? []).map(m => ({ ...m })) }); continue; }
    const mods = new Map(prev.modules.map(m => [m.code, m]));
    for (const m of c.modules ?? []) {
      const pm = mods.get(m.code);
      if (!pm) mods.set(m.code, { ...m });
      else Object.assign(pm, { passed: pm.passed || m.passed, grade: m.grade ?? pm.grade, date: m.date ?? pm.date, hp: m.hp || pm.hp });
    }
    byCode.set(c.code, { code: c.code, name: c.name || prev.name, hp: c.hp || prev.hp, term: c.term || prev.term,
      status: rank[c.status] >= rank[prev.status] ? c.status : prev.status, modules: [...mods.values()] });
  }
  const p = incoming.program, q = existing?.program;
  const program = !p ? q : !q ? p : { name: p.name || q.name, totalHp: p.totalHp || q.totalHp, startTerm: p.startTerm || q.startTerm, nominalTerms: p.nominalTerms || q.nominalTerms };
  return { program, courses: [...byCode.values()], examRegistrations: existing?.examRegistrations ?? [], intyg: [...(existing?.intyg ?? []), ...(incoming.intyg ?? [])] };
}

const KIND_NAME = { resultatintyg: "Resultatintyg", nationellt_resultatintyg: "Nationellt resultatintyg", registreringsintyg: "Registreringsintyg", forvantat_deltagande: "Intyg över förväntat deltagande", annat: "Intyg" };

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] ?? "");
    fr.onerror = () => reject(new Error("Filen kunde inte läsas."));
    fr.readAsDataURL(file);
  });
}

async function importIntygFile(file, statusEl, button) {
  if (file.type && file.type !== "application/pdf") { statusEl.textContent = "Välj en PDF från Ladok."; statusEl.className = "status is-danger"; return; }
  button.disabled = true;
  statusEl.className = "status";
  statusEl.setAttribute("aria-busy", "true");
  statusEl.textContent = "Läser intyget. Det tar upp till en minut.";
  try {
    const pdf = await fileToBase64(file);
    const res = await fetch("/api/ladok-import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pdf }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Servern svarade ${res.status}.`);
    ladokSet(mergeIntyg(ladokGet(), data));
    const hp = data.courses.flatMap(c => c.modules).filter(m => m.passed).reduce((s, m) => s + (m.hp || 0), 0);
    statusEl.textContent = `${KIND_NAME[data.kind] ?? "Intyg"} importerat: ${data.courses.length} kurser${hp ? `, ${hp} hp godkända` : ""}.${data.warnings.length ? " " + data.warnings.join(" ") : ""}`;
    await renderConnections(statusEl.textContent);
  } catch (e) {
    statusEl.className = "status is-danger";
    statusEl.textContent = `Intyget kunde inte läsas. ${e.message}`;
    button.disabled = false;
  } finally {
    statusEl.removeAttribute("aria-busy");
  }
}

function renderLadokPanel(message) {
  const ladok = ladokGet();
  const intyg = ladok?.intyg ?? [];
  const last = intyg[intyg.length - 1];
  const hasResult = intyg.some(i => i.kind === "resultatintyg" || i.kind === "nationellt_resultatintyg");
  const hasReg = intyg.some(i => i.kind === "registreringsintyg");
  let hint;
  if (!intyg.length) hint = "Ladda upp resultat- och registreringsintyg från Ladok. De sparas bara i din webbläsare.";
  else if (!hasReg) hint = "Lägg till ditt registreringsintyg också, så syns vilka kurser du läser nu och vilka som är rester.";
  else if (!hasResult) hint = "Lägg till ditt resultatintyg också, så räknas tagna hp.";
  else hint = "";
  return `
    <h3 class="group-title">Ladok</h3>
    <div class="group">
      <div class="row row-stacked">
        <div class="time"><strong>${intyg.length}</strong>intyg</div>
        <div class="main">
          <div class="title">${intyg.length ? esc(KIND_NAME[last.kind] ?? "Intyg") + " importerat " + (last.importedAt ? cap(fmtDay(last.importedAt)) : "") : "Inget intyg importerat"}</div>
          ${hint ? `<div class="sub">${esc(hint)}</div>` : ""}
          <p class="status ${message?.startsWith("Intyget kunde inte") ? "is-danger" : ""}" id="ladok-status" role="status">${esc(message ?? "")}</p>
          <div class="actions">
            <button class="action" id="ladok-pick" type="button">${intyg.length ? "Lägg till intyg" : "Ladda upp intyg"}</button>
            ${intyg.length ? `<button class="button-text" id="ladok-clear" type="button">Ta bort Ladok-data</button>` : ""}
          </div>
          <input type="file" id="ladok-file" class="visually-hidden" accept="application/pdf" aria-label="Välj intyg från Ladok (PDF)">
        </div>
      </div>
    </div>
    <p class="footnote">Ladok: intyg som PDF. Intygen finns i Ladok för studenter under Intyg. Tentaanmälan syns inte i intyg.</p>`;
}

function wireLadokPanel() {
  const pick = document.getElementById("ladok-pick");
  const file = document.getElementById("ladok-file");
  const clear = document.getElementById("ladok-clear");
  const status = document.getElementById("ladok-status");
  if (!pick || !file) return;
  pick.addEventListener("click", () => file.click());
  file.addEventListener("change", () => { if (file.files[0]) importIntygFile(file.files[0], status, pick); });
  if (clear) clear.addEventListener("click", async () => { ladokSet(null); await renderConnections("Ladok-data borttagna."); });
}

/* ---------- Källor ---------- */

const SOURCE_NAME = { canvas: "Canvas", timeedit: "TimeEdit", kronox: "KronoX", ical: "Kalendern", ladok: "Ladok" };
function sourceNotice(sources) {
  if (!sources) return "";
  const failed = Object.entries(sources).filter(([, v]) => v !== "ok" && !String(v).startsWith("mock:") && !String(v).startsWith("intyg:") && v !== "saknas");
  if (failed.length === 0) return "";
  return `<p class="footnote">${failed.map(([k, v]) => `${SOURCE_NAME[k] ?? k} kunde inte hämtas (${esc(v)}). <button class="button-text is-inline" type="button" data-go="connections">Kontrollera kopplingen</button>`).join(" ")}</p>`;
}

/* ---------- Idag ---------- */

function severity(item) {
  if (item.kind === "exam_registration_closing" || item.kind === "exam") return "danger";
  const hours = (new Date(item.at) - Date.now()) / 36e5;
  if (hours <= 48 && ["mandatory_event", "graded_assignment", "lab"].includes(item.kind)) return "warn";
  return "";
}

function kickerFor(item) {
  switch (item.kind) {
    case "exam_registration_closing": return "Kostar dig en hel tentaomgång";
    case "exam": return "Tenta";
    case "mandatory_event": return "Obligatoriskt";
    case "graded_assignment": return "Betygsgrundande";
    default: return "Kommande";
  }
}

function actionFor(item) {
  if (item.kind === "exam_registration_closing") return `<a class="action" href="${esc(item.url)}" target="_blank" rel="noopener">Anmäl dig i Ladok</a>`;
  if (item.url) return `<a class="action" href="${esc(item.url)}" target="_blank" rel="noopener">Öppna</a>`;
  return "";
}

function renderTop(item) {
  if (!item) return `<div class="top"><h2>Inget brådskande</h2><p class="why">Inget stänger, inget är obligatoriskt och ingen deadline ligger inom en vecka.</p></div>`;
  const sev = severity(item);
  return `
    <section class="top ${sev ? "is-" + sev : ""}" aria-label="Viktigast just nu">
      <p class="kicker">${esc(kickerFor(item))}${item.course ? " · " + esc(item.course) : ""}</p>
      <h2>${esc(item.title)}</h2>
      <p class="why">${esc(item.why)}</p>
      ${actionFor(item)}
    </section>`;
}

function renderRow(item) {
  const time = item.end
    ? `<strong>${fmtTime(item.at)}</strong>${fmtTime(item.end)}`
    : `<strong>${fmtTime(item.at)}</strong>senast`;
  const sub = [item.course, item.location].filter(Boolean).join(" · ");
  const sev = severity(item);
  const badge = item.kind === "exam_registration_closing" ? "Anmäl" : item.kind === "mandatory_event" ? "Oblig." : item.kind === "graded_assignment" ? "Betyg" : "";
  return `
    <div class="row">
      <div class="time">${time}</div>
      <div class="main">
        <div class="title">${esc(item.title)}</div>
        ${sub ? `<div class="sub">${esc(sub)}</div>` : ""}
      </div>
      ${badge ? `<span class="badge ${sev ? "is-" + sev : ""}">${badge}</span>` : "<span></span>"}
    </div>`;
}

function groupByDay(items) {
  const groups = new Map();
  for (const it of items) {
    const key = isToday(it.at) ? "Senare idag" : isTomorrow(it.at) ? "Imorgon" : cap(fmtDay(it.at));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  return groups;
}

async function renderToday() {
  const data = await load("/api/today");
  // Toppen är rangordnad. Resten visas som tidslinje; vikt syns via markeringarna.
  const chronological = [...data.items].sort((x, y) => new Date(x.at) - new Date(y.at));
  const groups = groupByDay(chronological);
  view.innerHTML = `
    <h1 class="large-title">Idag</h1>
    <p class="date-line">${cap(fmtLong(new Date().toISOString()))} · ${esc(data.student.institution)}</p>
    ${renderTop(data.top)}
    ${[...groups].map(([label, items]) => `
      <h3 class="group-title">${esc(label)}</h3>
      <div class="group">${items.map(renderRow).join("")}</div>`).join("")}
    ${data.items.length === 0 ? `<div class="empty"><strong>Resten av veckan är tom</strong>Nya händelser hämtas från schema, kursrum och Ladok automatiskt.</div>` : ""}
    ${sourceNotice(data.sources)}
    <p class="footnote">Överst: det som kostar mest att missa. Därefter i tidsordning. ${refreshLine(data.fetchedAt)}</p>`;
}

/* ---------- Tentor ---------- */

function examBadge(u) {
  switch (u.state) {
    case "registered": return `<span class="badge is-ok">Anmäld</span>`;
    case "open": return `<span class="badge ${u.daysToClose <= 7 ? "is-danger" : ""}">${u.daysToClose <= 0 ? "Idag" : u.daysToClose + " d kvar"}</span>`;
    case "not_open": return `<span class="badge">Ej öppen</span>`;
    case "missed": return `<span class="badge is-danger">Missad</span>`;
  }
}

function examSub(u) {
  switch (u.state) {
    case "registered": return `Anmäld · tenta ${fmtDay(u.examDate)}`;
    case "open": return `Anmälan stänger ${fmtDay(u.registrationCloses)}`;
    case "not_open": return `Anmälan öppnar ${fmtDay(u.registrationOpens)}`;
    case "missed": return `Anmälan stängde ${fmtDay(u.registrationCloses)}`;
  }
}

function renderExamRow(u) {
  return `
    <a class="row" href="${esc(u.url)}" target="_blank" rel="noopener">
      <div class="time"><strong>${fmtShort(u.examDate)}</strong>${fmtTime(u.examDate)}</div>
      <div class="main">
        <div class="title">${esc(u.course)} ${esc(u.module)}</div>
        <div class="sub">${esc(examSub(u))}</div>
      </div>
      ${examBadge(u)}
    </a>`;
}

async function renderExams() {
  const data = await load("/api/exams");
  const alerts = data.alerts;
  const key = u => `${u.course}:${u.module}:${u.examDate}`;
  const alertKeys = new Set(alerts.map(key));
  const rest = data.upcoming.filter(u => !alertKeys.has(key(u)));
  view.innerHTML = `
    <h1 class="large-title">Tentor</h1>
    <p class="date-line">${data.upcoming.length} kommande i dina registrerade kurser</p>
    ${alerts.length ? `<h3 class="group-title">Du är inte anmäld</h3><div class="group">${alerts.map(renderExamRow).join("")}</div>` : ""}
    ${rest.length ? `<h3 class="group-title">${alerts.length ? "Övriga" : "Kommande"}</h3><div class="group">${rest.map(renderExamRow).join("")}</div>` : ""}
    ${data.upcoming.length === 0 ? `<div class="empty"><strong>Inga tentor inplanerade</strong>När Ladok publicerar tillfällen för dina kurser dyker de upp här.</div>` : ""}
    <p class="footnote">Anmälningsfönster och tillfällen hämtas från Ladok. Anmälan görs alltid i Ladok, aldrig här.</p>`;
}

/* ---------- Examen ---------- */

async function renderDegree(message) {
  const d = await load("/api/degree");
  if (!d.program) {
    view.innerHTML = `<h1 class="large-title">Examen</h1><div class="empty"><strong>Inget program kopplat</strong>Ladda upp dina intyg från Ladok under Kopplingar, så räknar vi ut var du ligger. <button class="button-text is-inline" type="button" data-go="connections">Öppna Kopplingar</button></div>`;
    return;
  }
  view.innerHTML = `
    <h1 class="large-title">Examen</h1>
    <p class="date-line">${esc(d.program)}</p>
    <section class="top ${d.onTime ? "" : "is-warn"}" aria-label="Examensprognos">
      <p class="kicker">${d.onTime ? "Du ligger i fas" : `Du ligger ${d.termsBehind} termin${d.termsBehind === 1 ? "" : "er"} efter`}</p>
      <h2>${d.completedHp} av ${d.totalHp} hp</h2>
      <div class="progress" role="progressbar" aria-valuenow="${d.percent}" aria-valuemin="0" aria-valuemax="100"><div style="width:${d.percent}%"></div></div>
      <p class="why">${d.onTime
        ? `I nuvarande takt tar du examen ${d.projectedFinish}, som planerat.`
        : `Nominellt klar ${d.nominalFinish}. I nuvarande takt blir det ${d.projectedFinish}. Det som avgör är resterna nedan.`}</p>
    </section>
    <div class="stat-grid">
      <div class="stat"><div class="value">${d.pace}</div><div class="label">hp per termin hittills</div></div>
      <div class="stat"><div class="value ${d.rests.length ? "is-danger" : ""}">${d.rests.length}</div><div class="label">rester som blockerar</div></div>
    </div>
    ${d.rests.length ? `
      <h3 class="group-title">Rester</h3>
      <div class="group">${d.rests.map(r => `
        <div class="row row-stacked">
          <div class="time"><strong>${r.missing.reduce((s, m) => s + m.hp, 0)} hp</strong>saknas</div>
          <div class="main">
            <div class="title">${esc(r.name)}</div>
            <div class="sub">${esc(r.code)} · ${r.missing.map(m => esc(m.code)).join(", ")}${r.nextChance ? ` · nästa chans ${fmtDay(r.nextChance.examDate)}` : " · inget tillfälle publicerat"}</div>
            ${r.nextChance ? `<span class="badge ${r.nextChance.registered ? "is-ok" : "is-warn"}">${r.nextChance.registered ? "Anmäld" : "Ej anmäld"}</span>` : ""}
          </div>
        </div>`).join("")}</div>` : ""}
    <p class="footnote">Räknat på godkända moduler i Ladok. Nominell takt ${d.nominalPace} hp per termin. ${d.sources?.ladok?.startsWith("intyg:") ? "" : '<button class="button-text is-inline" type="button" data-go="connections">Ladda upp intyg</button>'}</p>`;
}

/* ---------- Kopplingar ---------- */

// Vad varje koppling behöver och var studenten hittar det. Texten är instruktionen; inga bilder.
const CONNECTIONS = [
  { id: "canvas", name: "Canvas", what: "Kurser, inlämningar och kalender", fields: [
      { key: "baseUrl", label: "Adress", type: "url", placeholder: "https://canvas.kth.se", autocomplete: "url", hint: "KTH: canvas.kth.se · SU: canvas.su.se" },
      { key: "token", label: "Åtkomsttoken", type: "password", placeholder: "Klistra in tokenen", autocomplete: "off", hint: "Canvas → Konto → Inställningar → Godkända integrationer → + Ny åtkomsttoken. Visas bara en gång." },
    ] },
  { id: "timeedit", name: "TimeEdit", what: "Schema", fields: [
      { key: "icalUrl", label: "Prenumerationslänk", type: "url", placeholder: "https://cloud.timeedit.net/…/ri….ics", autocomplete: "url", hint: "KTH: kth.se/schema → Prenumerera. Andra lärosäten: sök schema i TimeEdit → Prenumerera." },
    ] },
  { id: "kronox", name: "KronoX", what: "Schema", fields: [
      { key: "icalUrl", label: "Prenumerationslänk", type: "url", placeholder: "https://kronox.…/setup/jsp/SchemaICAL.ics?…", autocomplete: "url", hint: "KronoX → Avancerad sök → Prenumerera (iCal). Borås, Gävle, Kristianstad, Väst, Konstfack, LTU, Malmö, MDU, Södertörn, Örebro." },
    ] },
  { id: "ical", name: "Annan kalender", what: "Schema från Moodle, Itslearning, Outlook eller Google", fields: [
      { key: "icalUrl", label: "iCal-länk", type: "url", placeholder: "https://…/calendar.ics", autocomplete: "url", hint: "Alla kalendrar som kan exportera iCal fungerar. Länken ska sluta på .ics eller ge en kalender." },
    ] },
];
const UNAVAILABLE = [
  { name: "Ladok-anmälan", why: "Ladok tillåter inte integrationer. Tentafönster måste tills vidare läggas in för hand." },
  { name: "Athena (SU)", why: "Fasas ut under 2026. SU byter till Canvas." },
  { name: "Daisy (SU DSV)", why: "Inget API och ingen kalenderlänk." },
  { name: "Skola24, Unikum, InfoMentor", why: "Kräver avtal med skolans huvudman." },
];

function connStatusText(conn) {
  if (!conn) return "Inte kopplad";
  if (conn.name) return `Kopplad · ${conn.name}${conn.courses != null ? ` · ${conn.courses} kurser` : ""}`;
  if (conn.upcoming != null) return `Kopplad · ${conn.upcoming} kommande händelser`;
  return "Kopplad";
}

function renderConnectionGroup(def, conn, open, receipt) {
  const fields = def.fields.map(f => `
    <label class="field">
      <span class="field-label">${esc(f.label)}</span>
      <input name="${f.key}" type="${f.type}" inputmode="${f.type === "url" ? "url" : "text"}" autocapitalize="off" autocorrect="off" spellcheck="false"
        autocomplete="${f.autocomplete}" placeholder="${esc(f.placeholder)}" value="${f.type === "password" ? "" : esc(conn?.[f.key] ?? "")}" ${f.key === "baseUrl" ? "" : "required"}>
      <span class="field-hint">${esc(f.hint)}</span>
    </label>`).join("");
  return `
    <div class="group">
      <div class="row">
        <div class="main">
          <div class="title">${esc(def.name)}</div>
          <div class="sub">${esc(def.what)}</div>
          <div class="sub">${conn ? '<span class="badge is-ok is-inline">Kopplad</span>' : ""}${esc(connStatusText(conn).replace(/^Kopplad( · )?/, ""))}</div>
        </div>
        <button class="button-text" type="button" data-toggle="${def.id}" aria-expanded="${open ? "true" : "false"}" aria-controls="form-${def.id}">${conn ? "Ändra" : "Koppla"}</button>
      </div>
      ${receipt ? `<p class="status conn-receipt" role="status">${esc(receipt)}</p>` : ""}
      <form class="conn-form" id="form-${def.id}" data-kind="${def.id}" ${open ? "" : "hidden"}>
        ${fields}
        <p class="status" role="status" data-status></p>
        <div class="actions">
          <button class="action" type="submit">Testa och spara</button>
          ${conn ? `<button class="button-text" type="button" data-remove="${def.id}">Koppla bort</button>` : ""}
        </div>
      </form>
    </div>`;
}

let openConnection = null;
const receipts = {}; // kvitto per koppling, visas under raden tills vyn lämnas

async function renderConnections(ladokMessage) {
  const c = connGet();
  view.innerHTML = `
    <h1 class="large-title">Kopplingar</h1>
    <p class="date-line">Allt du klistrar in sparas bara i den här webbläsaren.</p>
    ${CONNECTIONS.map(def => renderConnectionGroup(def, c[def.id], openConnection === def.id, receipts[def.id])).join("")}
    ${renderLadokPanel(ladokMessage)}
    ${renderAppearance()}
    <h3 class="group-title">Inte tillgängliga än</h3>
    <div class="group">
      ${UNAVAILABLE.map(u => `<div class="row"><div class="main"><div class="title">${esc(u.name)}</div><div class="sub">${esc(u.why)}</div></div></div>`).join("")}
    </div>
    <p class="footnote">Vilka system som finns och vad de kan ge: docs/SOURCES.md i repot.</p>`;
  wireLadokPanel();
  wireConnections();
}

function wireConnections() {
  view.querySelectorAll("[data-toggle]").forEach(btn => btn.addEventListener("click", () => {
    const id = btn.dataset.toggle;
    openConnection = openConnection === id ? null : id;
    renderConnections();
    if (openConnection) view.querySelector(`#form-${id} input`)?.focus();
  }));
  view.querySelectorAll("[data-remove]").forEach(btn => btn.addEventListener("click", () => {
    const c = connGet(); delete c[btn.dataset.remove]; connSet(c); openConnection = null; receipts[btn.dataset.remove] = "Bortkopplad."; renderConnections();
  }));
  view.querySelectorAll("form.conn-form").forEach(form => form.addEventListener("submit", async e => {
    e.preventDefault();
    const kind = form.dataset.kind;
    const status = form.querySelector("[data-status]");
    const submit = form.querySelector('[type="submit"]');
    const data = Object.fromEntries(new FormData(form).entries());
    const existing = connGet()[kind];
    if (kind === "canvas" && !data.token && existing?.token) data.token = existing.token; // tomt lösenordsfält = behåll
    submit.disabled = true;
    status.className = "status"; status.setAttribute("aria-busy", "true");
    status.textContent = "Testar kopplingen…";
    try {
      const res = await fetch("/api/connect/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, ...data }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Servern svarade ${res.status}.`);
      const c = connGet();
      c[kind] = kind === "canvas"
        ? { baseUrl: body.baseUrl, token: data.token, name: body.name, courses: body.courses, institution: institutionFor(body.baseUrl), at: Date.now() }
        : { icalUrl: data.icalUrl.trim(), upcoming: body.upcoming, events: body.events, at: Date.now() };
      connSet(c);
      openConnection = null;
      lastLoadedAt = 0;
      receipts[kind] = kind === "canvas" ? `Kopplad som ${body.name} med ${body.courses} aktiva kurser.` : `${body.upcoming} kommande händelser${body.next ? ", nästa " + fmtDay(body.next).replace(/\.$/, "") : ""}.`;
      renderConnections();
    } catch (err) {
      status.className = "status is-danger";
      status.textContent = `Kunde inte koppla. ${err.message}`;
      submit.disabled = false;
    } finally {
      status.removeAttribute("aria-busy");
    }
  }));
}

function institutionFor(baseUrl) {
  try { const h = new URL(baseUrl).hostname; if (h.endsWith("kth.se")) return "KTH"; if (h.endsWith("su.se")) return "Stockholms universitet"; if (h.endsWith("lu.se")) return "Lunds universitet"; if (h.endsWith("gu.se")) return "Göteborgs universitet"; if (h.endsWith("uu.se")) return "Uppsala universitet"; if (h.endsWith("umu.se")) return "Umeå universitet"; return h.replace(/^canvas\./, ""); } catch { return ""; }
}

/* ---------- Laddning och uppdatering ---------- */

const TITLES = { today: "Idag", exams: "Tentor", degree: "Examen", connections: "Kopplingar" };
let lastLoadedAt = 0;

// Visas direkt vid flikbyte, innan svaret kommit (HIG Loading: visa något så fort som möjligt).
function renderSkeleton(tab) {
  view.setAttribute("aria-busy", "true");
  view.innerHTML = `
    <h1 class="large-title">${TITLES[tab]}</h1>
    <p class="date-line">Hämtar…</p>
    <div class="group skeleton" aria-hidden="true">
      <div class="row"><div class="time"><strong>&nbsp;</strong></div><div class="main"><div class="title">&nbsp;</div><div class="sub">&nbsp;</div></div></div>
      <div class="row"><div class="time"><strong>&nbsp;</strong></div><div class="main"><div class="title">&nbsp;</div><div class="sub">&nbsp;</div></div></div>
      <div class="row"><div class="time"><strong>&nbsp;</strong></div><div class="main"><div class="title">&nbsp;</div><div class="sub">&nbsp;</div></div></div>
    </div>`;
}

function refreshLine(fetchedAt) {
  return `<span class="refresh-line">Hämtat ${fmtTime(fetchedAt)}. <button class="button-text is-inline" type="button" data-refresh>Uppdatera</button></span>`;
}

// Appen öppnas i tunnelbanan efter en natt i bakgrunden. Är datan äldre än fem minuter hämtas den om.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && Date.now() - lastLoadedAt > 5 * 60 * 1000) { go(currentTab, { silent: true }); refreshNotices(); }
});
view.addEventListener("click", e => {
  if (e.target.closest("[data-refresh]")) go(currentTab);
  const link = e.target.closest("[data-go]");
  if (link) go(link.dataset.go);
});

/* ---------- Verktygsrad: uppdatera, notiser, utseende, logga ut ---------- */

// Utseende. Standard är att följa systemet (HIG Dark Mode avråder från egen inställning; den finns
// för att studenten bett om den). Valet sparas i webbläsaren och läses i index.html före första målningen.
const THEME_KEY = "studiett.theme";
const themeMeta = [...document.querySelectorAll('meta[name="theme-color"]')].map(m => ({ m, content: m.content, media: m.media }));
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
function themeGet() { try { const t = localStorage.getItem(THEME_KEY); return t === "light" || t === "dark" ? t : "system"; } catch { return "system"; } }
function effectiveTheme() { const t = themeGet(); return t === "system" ? (darkQuery.matches ? "dark" : "light") : t; }
function applyTheme(pref) {
  try { if (pref === "system") localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, pref); } catch {}
  if (pref === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = pref;
  const eff = effectiveTheme();
  // Statusfältet i PWA-läge följer valet, inte bara systemet.
  for (const { m, content, media } of themeMeta) {
    if (pref === "system") { m.content = content; m.media = media; }
    else { m.content = eff === "dark" ? "#0E0E0C" : "#F4F1EA"; m.removeAttribute("media"); }
  }
  const label = eff === "dark" ? "Byt till ljust läge" : "Byt till mörkt läge";
  themeButton.setAttribute("aria-label", label);
  themeButton.title = label;
  view.querySelectorAll("[data-theme-pick]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.themePick === pref)));
}
const themeButton = document.getElementById("tool-theme");
themeButton.addEventListener("click", () => applyTheme(effectiveTheme() === "dark" ? "light" : "dark"));
darkQuery.addEventListener("change", () => applyTheme(themeGet()));
view.addEventListener("click", e => { const b = e.target.closest("[data-theme-pick]"); if (b) applyTheme(b.dataset.themePick); });

function renderAppearance() {
  const pref = themeGet();
  const opt = (v, t) => `<button type="button" role="radio" aria-checked="${pref === v}" data-theme-pick="${v}">${t}</button>`;
  return `
    <h3 class="group-title">Utseende</h3>
    <div class="group">
      <div class="row">
        <div class="main"><div class="title">Ljust eller mörkt</div><div class="sub">Följ systemet är standard. Knappen i toppraden växlar.</div></div>
        <div class="segmented" role="radiogroup" aria-label="Utseende">${opt("system", "System")}${opt("light", "Ljust")}${opt("dark", "Mörkt")}</div>
      </div>
    </div>`;
}

// Notiser: det som kostar något att missa, samlat under klockan. Rangordningen kommer från servern;
// här väljs bara vilka rader som visas, med samma regler som markeringarna i Idag och Tentor.
const noticePanel = document.getElementById("notices");
const noticeButton = document.getElementById("tool-notices");
const noticeCount = document.getElementById("notice-count");
noticePanel.tabIndex = -1;
let notices = [];

function noticesFrom(today, exams) {
  const out = [];
  for (const it of [today?.top, ...(today?.items ?? [])].filter(Boolean)) {
    const sev = severity(it);
    if (sev) out.push({ sev, at: it.at, title: it.title, sub: [kickerFor(it), it.course].filter(Boolean).join(" · "), tab: "today" });
  }
  for (const u of exams?.alerts ?? []) {
    out.push({ sev: u.daysToClose <= 7 ? "danger" : "warn", at: u.registrationCloses, title: `${u.course} ${u.module}`, sub: `Inte anmäld · stänger ${fmtDay(u.registrationCloses)}`, tab: "exams" });
  }
  return out.sort((a, b) => new Date(a.at) - new Date(b.at));
}

async function refreshNotices() {
  try {
    const [today, exams] = await Promise.all([load("/api/today"), load("/api/exams")]);
    notices = noticesFrom(today, exams);
  } catch { return; }
  renderNoticeCount();
  if (!noticePanel.hidden) renderNotices();
}

function renderNoticeCount() {
  const n = notices.length;
  noticeCount.hidden = n === 0;
  noticeCount.textContent = n > 99 ? "99+" : String(n);
  noticeCount.className = "count" + (notices.some(x => x.sev === "danger") ? " is-danger" : "");
  noticeButton.setAttribute("aria-label", n ? `Notiser, ${n} att bevaka` : "Notiser");
}

function renderNotices() {
  noticePanel.innerHTML = `
    <div class="popover-title"><h2>Att bevaka</h2><span class="popover-sub">${notices.length ? `${notices.length} inom en vecka` : ""}</span></div>
    ${notices.length ? `<div class="group">${notices.map(n => `
      <button class="row" type="button" data-go="${n.tab}">
        <div class="time"><strong>${fmtShort(n.at)}</strong>${fmtTime(n.at)}</div>
        <div class="main"><div class="title">${esc(n.title)}</div><div class="sub">${esc(n.sub)}</div></div>
        <span class="badge is-${n.sev}">${n.sev === "danger" ? "Viktigt" : "Snart"}</span>
      </button>`).join("")}</div>`
    : `<div class="empty"><strong>Inget att bevaka</strong>Inget stänger och ingen deadline är nära.</div>`}
    <p class="footnote">Samma regler som markeringarna i Idag och Tentor. Inga pushnotiser skickas.</p>`;
}

function openNotices(open) {
  noticePanel.hidden = !open;
  noticeButton.setAttribute("aria-expanded", String(open));
  if (open) { renderNotices(); (noticePanel.querySelector("button") ?? noticePanel).focus(); }
  else noticeButton.focus();
}
noticeButton.addEventListener("click", () => openNotices(noticePanel.hidden));
noticePanel.addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (b) { openNotices(false); go(b.dataset.go); } });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !noticePanel.hidden) openNotices(false); });
document.addEventListener("click", e => { if (!noticePanel.hidden && !noticePanel.contains(e.target) && !noticeButton.contains(e.target)) openNotices(false); });

// Uppdatera: hämtar om vyn och notiserna. Den gamla vyn står kvar tills den nya kommit.
const refreshButton = document.getElementById("tool-refresh");
refreshButton.addEventListener("click", async () => {
  refreshButton.classList.add("is-busy"); refreshButton.disabled = true;
  await Promise.all([go(currentTab, { silent: true }), refreshNotices()]);
  refreshButton.classList.remove("is-busy"); refreshButton.disabled = false;
});

// Logga ut: det finns inget konto att logga ut från, så det betyder att allt som sparats i
// webbläsaren tas bort: kopplingar, intyg, utseende och offline-kopior. Bekräftas först (HIG Modality).
const logoutDialog = document.getElementById("logout-dialog");
document.getElementById("tool-logout").addEventListener("click", () => logoutDialog.showModal());
logoutDialog.addEventListener("close", async () => {
  if (logoutDialog.returnValue !== "confirm") return;
  try { for (const k of Object.keys(localStorage)) if (k.startsWith("studiett.")) localStorage.removeItem(k); } catch {}
  try { for (const k of await caches.keys()) if (k.startsWith("studiett-data")) await caches.delete(k); } catch {}
  applyTheme("system");
  notices = []; renderNoticeCount();
  openConnection = null; lastLoadedAt = 0;
  await go("today");
  refreshNotices();
});

/* ---------- Navigation ---------- */

const routes = { today: renderToday, exams: renderExams, degree: renderDegree, connections: () => renderConnections() };
let currentTab = "today";

async function go(tab, { silent = false } = {}) {
  const switching = tab !== currentTab || !view.children.length;
  if (switching) for (const k of Object.keys(receipts)) delete receipts[k];
  if (switching && !noticePanel.hidden) openNotices(false);
  currentTab = tab;
  tabs.forEach(t => {
    const on = t.dataset.tab === tab;
    t.classList.toggle("is-active", on);
    if (on) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
  });
  location.hash = tab;
  // Vid flikbyte visas skelettet direkt. Vid tyst uppdatering står den gamla vyn kvar tills den nya kommit.
  if (switching && !silent && tab !== "connections") renderSkeleton(tab);
  try {
    await routes[tab]();
    lastLoadedAt = Date.now();
  } catch (e) {
    view.innerHTML = `<h1 class="large-title">${TITLES[tab]}</h1><div class="empty"><strong>Kunde inte hämta data</strong>${esc(e.message)} <button class="button-text is-inline" type="button" data-refresh>Försök igen</button></div>`;
  }
  view.removeAttribute("aria-busy");
  if (switching && !silent) { window.scrollTo({ top: 0 }); view.focus({ preventScroll: true }); }
}

tabs.forEach(t => t.addEventListener("click", () => go(t.dataset.tab)));
applyTheme(themeGet());
go(routes[location.hash.slice(1)] ? location.hash.slice(1) : "today").then(refreshNotices);

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");

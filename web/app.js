// Studiett klient. Ingen produktlogik här: allt rangordnas och räknas på servern (server/core).
// Klienten översätter JSON till tre vyer och inget mer.

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

async function load(path) {
  const ladok = ladokGet();
  const res = ladok
    ? await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ladok }) })
    : await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
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
    await renderDegree(statusEl.textContent);
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
    <p class="footnote">Intygen finns i Ladok för studenter under Intyg. Tentaanmälan syns inte i intyg.</p>`;
}

function wireLadokPanel() {
  const pick = document.getElementById("ladok-pick");
  const file = document.getElementById("ladok-file");
  const clear = document.getElementById("ladok-clear");
  const status = document.getElementById("ladok-status");
  if (!pick || !file) return;
  pick.addEventListener("click", () => file.click());
  file.addEventListener("change", () => { if (file.files[0]) importIntygFile(file.files[0], status, pick); });
  if (clear) clear.addEventListener("click", async () => { ladokSet(null); await renderDegree("Ladok-data borttagna."); });
}

/* ---------- Källor ---------- */

const SOURCE_NAME = { canvas: "Canvas", timeedit: "TimeEdit", ladok: "Ladok" };
function sourceNotice(sources) {
  if (!sources) return "";
  const failed = Object.entries(sources).filter(([, v]) => v !== "ok" && !String(v).startsWith("mock:") && !String(v).startsWith("intyg:") && v !== "saknas");
  if (failed.length === 0) return "";
  return `<p class="footnote">${failed.map(([k, v]) => `${SOURCE_NAME[k] ?? k} kunde inte hämtas (${esc(v)}). Kontrollera kopplingen i .env.`).join(" ")}</p>`;
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
    <p class="footnote">Överst: det som kostar mest att missa. Därefter i tidsordning. Hämtat ${fmtTime(data.fetchedAt)}.</p>`;
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
    view.innerHTML = `<h1 class="large-title">Examen</h1><div class="empty"><strong>Inget program kopplat</strong>Ladda upp dina intyg från Ladok så räknar vi ut var du ligger.</div>${renderLadokPanel(message)}`;
    wireLadokPanel();
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
    <p class="footnote">Räknat på godkända moduler i Ladok. Nominell takt ${d.nominalPace} hp per termin.</p>
    ${renderLadokPanel(message)}`;
  wireLadokPanel();
}

/* ---------- Navigation ---------- */

const routes = { today: renderToday, exams: renderExams, degree: renderDegree };

async function go(tab) {
  tabs.forEach(t => {
    const on = t.dataset.tab === tab;
    t.classList.toggle("is-active", on);
    if (on) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current");
  });
  location.hash = tab;
  try {
    await routes[tab]();
  } catch (e) {
    view.innerHTML = `<div class="empty"><strong>Kunde inte hämta data</strong>${esc(e.message)}. Kontrollera att servern kör.</div>`;
  }
  window.scrollTo({ top: 0 });
  view.focus({ preventScroll: true });
}

tabs.forEach(t => t.addEventListener("click", () => go(t.dataset.tab)));
go(routes[location.hash.slice(1)] ? location.hash.slice(1) : "today");

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");

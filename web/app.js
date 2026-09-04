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

async function load(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
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

async function renderDegree() {
  const d = await load("/api/degree");
  if (!d.program) {
    view.innerHTML = `<h1 class="large-title">Examen</h1><div class="empty"><strong>Inget program kopplat</strong>Koppla Ladok så räknar vi ut var du ligger.</div>`;
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
    <p class="footnote">Räknat på godkända moduler i Ladok. Nominell takt ${d.nominalPace} hp per termin.</p>`;
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

// Gemensam API-kärna. Används av den lokala servern (server.js) och av Vercels
// serverless-funktioner (api/*.js), så att båda svarar exakt likadant.
import { loadBundle } from "./adapters/index.js";
import { rank } from "./core/rank.js";
import { examStatus } from "./core/exams.js";
import { degree } from "./core/degree.js";

export async function handle(pathname, now = new Date()) {
  const bundle = await loadBundle();
  switch (pathname) {
    case "/api/today":  return { student: bundle.student, fetchedAt: bundle.fetchedAt, sources: bundle.sources, ...rank(bundle, now) };
    case "/api/exams":  return { student: bundle.student, sources: bundle.sources, ...examStatus(bundle, now) };
    case "/api/degree": return { student: bundle.student, sources: bundle.sources, ...degree(bundle, now) };
    default: return null;
  }
}

// Svarar med JSON på ett Node-kompatibelt res-objekt (både http.ServerResponse och Vercels).
export async function respond(pathname, res) {
  try {
    const data = await handle(pathname);
    if (!data) { res.statusCode = 404; return res.end(); }
    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify(data));
  } catch (e) {
    console.error(String(e));
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Servern kunde inte bygga svaret. Se serverloggen.");
  }
}

// Studiett server. Inga beroenden. Node 18+.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBundle } from "./adapters/index.js";
import { rank } from "./core/rank.js";
import { examStatus } from "./core/exams.js";
import { degree } from "./core/degree.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const WEB = join(here, "..", "web");
const PORT = Number(process.env.PORT ?? 3000);

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };

async function api(path) {
  const bundle = await loadBundle();
  const now = new Date();
  switch (path) {
    case "/api/today":  return { student: bundle.student, fetchedAt: bundle.fetchedAt, ...rank(bundle, now) };
    case "/api/exams":  return { student: bundle.student, ...examStatus(bundle, now) };
    case "/api/degree": return { student: bundle.student, ...degree(bundle, now) };
    default: return null;
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      const data = await api(url.pathname);
      if (!data) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      return res.end(JSON.stringify(data));
    }
    let file = normalize(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^(\.\.[/\\])+/, "");
    let full = join(WEB, file);
    const s = await stat(full).catch(() => null);
    if (!s || s.isDirectory()) { full = join(WEB, "index.html"); }
    res.writeHead(200, { "content-type": MIME[extname(full)] ?? "application/octet-stream" });
    res.end(await readFile(full));
  } catch (e) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(String(e));
  }
}).listen(PORT, () => console.log(`Studiett  http://localhost:${PORT}  (profil: ${process.env.STUDENT ?? "viktor"})`));

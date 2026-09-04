// Studiett server. Inga beroenden. Node 18+.
// Lokalt: statiska filer ur web/ plus API:t. På Vercel serveras web/ statiskt och
// api/*.js kör samma svar via server/api.js.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./env.js";
import { respond } from "./api.js";

loadEnv();

const here = fileURLToPath(new URL(".", import.meta.url));
const WEB = join(here, "..", "web");
const PORT = Number(process.env.PORT ?? 3000);

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) return respond(url.pathname, req, res);
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
}).listen(PORT, () => console.log(`Studiett  http://localhost:${PORT}  (${process.env.CANVAS_TOKEN || process.env.TIMEEDIT_ICAL_URL ? "riktiga kopplingar från .env" : "mockprofil " + (process.env.STUDENT ?? "viktor")})`));

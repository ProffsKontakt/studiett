// Gemensam API-kärna. Används av den lokala servern (server.js) och av Vercels
// serverless-funktioner (api/*.js), så att båda svarar exakt likadant.
import { loadBundle } from "./adapters/index.js";
import { extractIntyg, normalizeIntyg, MODEL } from "./adapters/ladok.js";
import { rank } from "./core/rank.js";
import { examStatus } from "./core/exams.js";
import { degree } from "./core/degree.js";

const MAX_BODY = 4 * 1024 * 1024; // Vercel tar emot högst 4,5 MB per anrop

export async function handle(pathname, now = new Date(), overlay = null) {
  const bundle = await loadBundle(undefined, process.env, overlay);
  switch (pathname) {
    case "/api/today":  return { student: bundle.student, fetchedAt: bundle.fetchedAt, sources: bundle.sources, ...rank(bundle, now) };
    case "/api/exams":  return { student: bundle.student, sources: bundle.sources, ...examStatus(bundle, now) };
    case "/api/degree": return { student: bundle.student, sources: bundle.sources, ...degree(bundle, now) };
    default: return null;
  }
}

// POST /api/ladok-import { pdf: <base64> } -> { kind, issuedAt, program, courses, warnings }
// PDF:en lämnar aldrig minnet; inget skrivs till disk eller logg.
export async function importIntyg(body, { client } = {}) {
  const pdf = typeof body?.pdf === "string" ? body.pdf : "";
  if (!pdf) throw new ClientError(400, "Ingen PDF skickades.");
  if (!pdf.startsWith("JVBERi0")) throw new ClientError(400, "Filen är inte en PDF."); // "%PDF-" i base64
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new ClientError(503, "ANTHROPIC_API_KEY saknas på servern. Intyg kan inte läsas.");
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    client = new Anthropic();
  }
  const raw = await extractIntyg(pdf, { client, model: process.env.LADOK_MODEL ?? MODEL });
  const data = normalizeIntyg(raw);
  return { ...data, intyg: [{ kind: data.kind, issuedAt: data.issuedAt, institution: data.institution, importedAt: new Date().toISOString() }] };
}

export class ClientError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Läser JSON-kroppen. Vercels Node-runtime kan redan ha tolkat req.body; lokalt läser vi strömmen.
export async function readJson(req) {
  if (req.body !== undefined && req.body !== null) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new ClientError(413, "Filen är för stor. Skapa ett intyg avgränsat till färre terminer.");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function send(res, status, data, type = "application/json; charset=utf-8") {
  res.statusCode = status;
  res.setHeader("content-type", type);
  res.setHeader("cache-control", "no-store");
  res.end(typeof data === "string" ? data : JSON.stringify(data));
}

// Svarar på ett Node-kompatibelt req/res-par (både http.* och Vercels).
export async function respond(pathname, req, res, deps = {}) {
  try {
    const method = (req.method ?? "GET").toUpperCase();
    if (pathname === "/api/ladok-import") {
      if (method !== "POST") return send(res, 405, { error: "Använd POST." });
      const body = await readJson(req);
      return send(res, 200, await importIntyg(body, deps));
    }
    // Idag, Tentor, Examen: GET utan overlay, eller POST { ladok } med importerade Ladok-data.
    let overlay = null;
    if (method === "POST") {
      const body = await readJson(req);
      overlay = body?.ladok ?? null;
    }
    const data = await handle(pathname, new Date(), overlay);
    if (!data) return send(res, 404, { error: "Okänd väg." });
    return send(res, 200, data);
  } catch (e) {
    const status = e instanceof ClientError ? e.status : 500;
    if (status === 500) console.error(String(e));
    return send(res, status, { error: status === 500 ? "Servern kunde inte bygga svaret." : e.message });
  }
}

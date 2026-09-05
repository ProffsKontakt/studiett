// Nätverkshjälp för adaptrarna. Studenten klistrar in URL:er själv, så servern får
// aldrig hämta vad som helst: bara https mot publika värdar, med tidsgräns och storlekstak.
import { isIP } from "node:net";

export class NetError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0)$/i;
function isPrivateIp(host) {
  const v = isIP(host);
  if (v === 4) {
    const [a, b] = host.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (v === 6) {
    const h = host.toLowerCase();
    return h === "::1" || h === "::" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80") || h.startsWith("::ffff:");
  }
  return false;
}

// Godkänner en URL som studenten angett. Kastar NetError(400) med ett meddelande som går att visa.
export function publicHttpsUrl(input, { maxLength = 2000 } = {}) {
  const s = String(input ?? "").trim().replace(/^webcal:/i, "https:");
  if (!s) throw new NetError(400, "Länken saknas.");
  if (s.length > maxLength) throw new NetError(400, "Länken är för lång.");
  let url;
  try { url = new URL(s); } catch { throw new NetError(400, "Det är inte en giltig länk."); }
  if (url.protocol !== "https:") throw new NetError(400, "Länken måste börja med https://.");
  if (url.username || url.password) throw new NetError(400, "Länken får inte innehålla användarnamn eller lösenord.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (PRIVATE_HOST.test(host) || isPrivateIp(host)) throw new NetError(400, "Länken pekar inte på en publik adress.");
  return url;
}

// Hämtar text med tidsgräns och storlekstak. Returnerar { status, contentType, text }.
export async function fetchText(url, { headers = {}, timeoutMs = 10000, maxBytes = 2 * 1024 * 1024 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal, redirect: "follow" });
    const contentType = res.headers.get("content-type") ?? "";
    const reader = res.body?.getReader();
    const chunks = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) { ctrl.abort(); throw new NetError(413, "Svaret är för stort."); }
        chunks.push(value);
      }
    }
    return { status: res.status, contentType, text: Buffer.concat(chunks).toString("utf8") };
  } catch (e) {
    if (e instanceof NetError) throw e;
    if (e?.name === "AbortError") throw new NetError(504, "Svaret tog för lång tid.");
    const code = e?.cause?.code ? ` (${e.cause.code})` : "";
    throw new NetError(502, `Kunde inte nå adressen${code}.`);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url, opts) {
  const r = await fetchText(url, opts);
  let json = null;
  try { json = JSON.parse(r.text); } catch { /* lämnas null */ }
  return { ...r, json };
}

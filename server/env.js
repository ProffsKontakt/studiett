// Läser .env i repots rot utan beroenden (docs/DECISIONS.md §5). Sätter aldrig över
// variabler som redan finns i miljön. Värdena loggas aldrig.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

export function loadEnv(file = join(fileURLToPath(new URL("..", import.meta.url)), ".env")) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch { return; }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

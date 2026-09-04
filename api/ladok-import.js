// Vercel serverless-funktion. Tar emot ett Ladok-intyg som PDF (base64) och returnerar
// normaliserade Ladok-data. Kräver ANTHROPIC_API_KEY i Vercel-projektet.
import { respond } from "../server/api.js";
export default function handler(req, res) { return respond("/api/ladok-import", req, res); }

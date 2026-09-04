// Vercel serverless-funktion. Samma svar som server/server.js ger lokalt.
import { respond } from "../server/api.js";
export default function handler(req, res) { return respond("/api/exams", req, res); }

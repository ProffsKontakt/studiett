// Vercel serverless-funktion. Testar en koppling (Canvas, TimeEdit, KronoX, iCal) utan att spara den.
import { respond } from "../../server/api.js";
export default function handler(req, res) { return respond("/api/connect/verify", req, res); }

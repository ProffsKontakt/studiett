// Bygger web/data/gymnasier.json från Skolverkets öppna API (planned-educations v3, skolenhetsregistret v1).
// Inga nycklar behövs. Kör: node scripts/build-gymnasier.mjs
// Fälten hålls till det som behövs för att välja sin skola: kod, namn, kommun, huvudmanstyp.
import { writeFileSync } from "node:fs";

const API = "https://api.skolverket.se";
const ACCEPT = { Accept: "application/vnd.skolverket.plannededucations.api.v3.hal+json" };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url, headers) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.json();
    } catch (e) {
      if (attempt >= 5) throw e;
      await sleep(1000 * (attempt + 1));
    }
  }
}

const kommuner = new Map((await getJson(`${API}/skolenhetsregistret/v1/kommun`)).Kommuner.map(k => [k.Kommunkod, k.Namn]));

const units = [];
for (let page = 0; page < 100; page++) {
  const j = await getJson(`${API}/planned-educations/v3/school-units?typeOfSchooling=gy&page=${page}&size=100`, ACCEPT);
  units.push(...(j.body._embedded?.listedSchoolUnits ?? []));
  if (!j.body._links.next) break;
}

const ORG = { Kommunal: "kommunal", "Fristående": "fristående", "Kommunalförbund": "kommunalförbund", Region: "region" };
const schools = units
  .filter(u => !u.abroadSchool)
  .map(u => ({ id: u.code, name: u.name.trim(), kommun: kommuner.get(u.geographicalAreaCode) ?? u.postCodeDistrict ?? "", org: ORG[u.principalOrganizerType] ?? "" }))
  .sort((a, b) => a.name.localeCompare(b.name, "sv"));

const out = { source: "Skolverket, skolenhetsregistret och planned-educations v3", fetchedAt: new Date().toISOString().slice(0, 10), schools };
writeFileSync(new URL("../web/data/gymnasier.json", import.meta.url), JSON.stringify(out));
console.log(`${schools.length} gymnasieskolor skrivna till web/data/gymnasier.json`);

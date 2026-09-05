# API-karta: vad varje källa ger och hur studenten får åtkomst

Research 2026-09-05. Märkning: **[C]** läst på officiell sida eller verifierat med HTTP-anrop, **[L]** sekundär källa, **[G]** gissning. Systemkartan (vilka lärosäten som kör vad) finns i `docs/SOURCES.md`; adresser per lärosäte i `web/data/larosaten.json`.

## Canvas [C]

- Dokumentation: https://canvas.instructure.com/doc/api/ (auth `file.oauth.html`, paginering `file.pagination.html`, kvoter `file.throttling.html`).
- **Studentens token:** Konto → Inställningar (`https://<canvas>/profile/settings`) → Godkända integrationer → + Ny åtkomsttoken → Syfte, utgångsdatum → Skapa. Visas en gång. Appen länkar dit när ett lärosäte är valt.
- **Tokenpolicy 2025–2026:** studenttokens måste ha utgångsdatum; Instructures guide anger 30 dagar för studenter. Admin kan spärra alla studenter från att skapa tokens (då är knappen inaktiv). Studiett måste alltså räkna med att tokenen förnyas varje månad, och att vissa lärosäten stängt av den helt.
- Auth: `Authorization: Bearer <token>`. Kvot per token; `X-Rate-Limit-Remaining` i svaret; parallella anrop kostar extra; 403 vid överskridande.
- Paginering: `Link`-header med `rel="next"`; följ den, `rel="last"` kan saknas. `per_page` upp till 100 [L].
- Endpoints vi använder eller ska använda:
  - `GET /api/v1/users/self` (namn), `GET /api/v1/users/self/profile` (ger även kalenderflödets `calendar.ics`).
  - `GET /api/v1/courses?enrollment_state=active&per_page=100`. **Studenten ser som standard bara `available`-kurser.** En kurs läraren inte publicerat, eller en inbjudan studenten inte accepterat (`enrollment_state=invited_or_pending`), syns inte. Det är därför "0 kurser" kan vara rätt svar i början av terminen. Adaptern räknar inbjudningar separat.
  - `GET /api/v1/courses/:id/assignments?include[]=submission&bucket=upcoming`.
  - `GET /api/v1/calendar_events?context_codes[]=course_<id>&all_events=true` (max 10 context_codes per anrop).
  - `GET /api/v1/users/self/upcoming_events?only_active_courses=true`, `GET /api/v1/planner/items?filter=incomplete_items`, `GET /api/v1/users/self/missing_submissions`.
  - `GET /api/v1/courses/:id/enrollments?user_id=self` → `grades.current_score`.
- iCal-alternativ (ingen token): Kalender → Kalenderflöde → kopiera URL (`/feeds/calendars/user_<hash>.ics`). Fungerar med kopplingen "Annan kalender". Uppdateras med ca en timmes fördröjning.

## Ladok [C]

- **Inget student-API.** Ladokkonsortiet tillåter bara myndigheter och lärosätenas egna integrationer. Lärosätes-API:t (Ladok3 REST) dokumenteras i konsortiets Confluence bakom behörighet; autentisering med lärosätescertifikat.
- Studentwebben: `https://student.ladok.se/student/app/studentwebb/start`. Det är en SPA som svarar 200 på alla sökvägar under `/studentwebb/`, så bara `/start` är belagd. Menyn: Registrering, Examinationstillfällen (tentaanmälan), Min utbildning, Intyg, Examen och bevis.
- Vår väg: studenten skapar intyg (PDF) under Intyg och laddar upp dem i Kopplingar (`docs/DECISIONS.md` §9). Tentafönster syns inte i intyg.

## TimeEdit [C]

- Utvecklardokumentation: https://developer.timeedit.com/ (REST med api-key på kundnivå, inte student). Viewer-formaten är odokumenterade men stabila.
- **Studentens länk:** sök schema i TimeEdit Viewer → Prenumerera → kopiera webcal-länk. Länken går ut när ingångens datumgräns passeras. Alternativ: Ladda ner → iCal (statisk fil).
- URL-mönster: `…/web/<ingång>/ri.html?sid=3&p=<period>&objects=<id.typ,…>`; samma adress med `ri.json` eller `ri.ics` ger JSON respektive `text/calendar`. Prenumerationslänkar ser ut som `…/ri<hash>.ics`. Objektsök: `objects.json?search_text=…`.
- **Servern kräver en User-Agent, annars 412.** `server/net.js` sätter en.
- Verifierade ingångar: KTH `kth/web/public01`, SU `su/web/stud1`, GU `gu/web/schema`, UU `uu/web/wr_student`, UmU `umu/web/public1`, Chalmers `chalmers/web/public`, SLU `slu/web/stud1`, LiU `liu/web/schema`, KaU `kau/web/schema_kau`, LnU `lnu/web/schema1`, LU per fakultet (`lu/web/lth1` m.fl.). UU, LU och KaU svarar 412 även med webbläsar-UA från vår miljö; länkarna fungerar i webbläsare [L].

## KronoX [C]

- Lärosäten och värdar (kronox.se/app/larosaten.php): Borås `schema.hb.se`, Gävle `schema.hig.se`, Kristianstad `schema.hkr.se`, Väst `schema.hv.se`, Konstfack `kronox.konstfack.se`, LTU `tenta.ltu.se`, Malmö `schema.mau.se`, MDU `webbschema.mdu.se`, Södertörn `kronox.sh.se`, Örebro `schema.oru.se`.
- **Studentens länk:** Avancerad sök (`/avanceratschema.jsp`) → kurs/program → Schematyp: iCal → kopiera `webcal://`-länken.
- Flöde: `/setup/jsp/SchemaICAL.ics?startDatum=idag&intervallTyp=m&intervallAntal=1&sprak=SV&resurser=<resurser>` ger `text/calendar`. `SchemaXML.jsp` finns också. Ingen officiell API-dokumentation; öppna appar att läsa: tumble-dev/Tumble-Cross-Platform, kraxarn/school_schedule.

## Itslearning, Moodle, Blackboard [C]

- Itslearning: Kalender → … → Prenumerera på iCal-flöde. Den som har länken kan läsa kalendern utan inloggning. Inget student-API.
- Moodle: Kalender → Exportera kalender → Hämta kalender-URL (`/calendar/export_execute.php?userid=…&authtoken=…`). Webbtjänst-token via `/login/token.php?service=moodle_mobile_app` om lärosätet aktiverat mobiltjänsten och har lösenordsinloggning.
- Blackboard Learn (Örebro, Halmstad): REST kräver registrerad app hos lärosätet. Kalender-ICS finns i Learn Ultra [L].

Alla tre kopplas via "Annan kalender" i Kopplingar.

## Skolverket [C]

- Skolenhetsregistret v2: `https://api.skolverket.se/skolenhetsregistret/v2/school-units?school_type=GY&status=AKTIV`. Ingen nyckel, CC0, uppdateras dagligen; v1 avvecklas årsskiftet 2025/26.
- Planned educations v3: `https://api.skolverket.se/planned-educations/v3/school-units?typeOfSchooling=gy&size=100` med `Accept: application/vnd.skolverket.plannededucations.api.v3.hal+json`. Max 100 per sida. Det är den `scripts/build-gymnasier.mjs` använder.
- Lärosäteslista: UKÄ (uka.se, "Lista över universitet, högskolor och enskilda utbildningsanordnare"), inget API. Handskriven i `web/data/larosaten.json`.

## Sammanfattning

| System | Studentåtkomst | Direktlänk i appen | Ger |
|---|---|---|---|
| Canvas | Personlig token (30 dagar) eller iCal | `<canvas>/profile/settings` | Course, Assignment, Event, uppgiftsbetyg |
| Ladok | Bara webb; intyg som PDF | `student.ladok.se/…/studentwebb/start` | Course, Result via intyg |
| TimeEdit | iCal via Prenumerera | Lärosätets Viewer-ingång | Event |
| KronoX | iCal via Avancerad sök | `<värd>/avanceratschema.jsp` | Event |
| Itslearning, Moodle, Blackboard | iCal | Ingen (varierar per lärosäte) | Event |
| Skolverket | Öppet, CC0 | – | Skollistan |

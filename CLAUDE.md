# Studiett

Läs hela den här filen innan du gör något. Den är produktens hjärna. Om något du vill bygga strider mot den, säg det och fråga, bygg inte runt.

## Vad Studiett är

Stud · i · ett. Ett aggregeringslager ovanpå lärosätenas befintliga system (Ladok, Canvas, TimeEdit). Vi äger inte datan; källsystemen gör det. Vi äger gränssnittet studenten faktiskt öppnar varje morgon. Studenten är kund, användare och ägare av sin data.

Tre funktioner, i den här ordningen, och bara de tre: **Idag** (dagligt), **Tentaanmälan** (månadsvis), **Examen** (terminsvis). Allt annat är lager fyra och byggs inte förrän de tre har riktig data. Se `README.md` och `docs/DECISIONS.md`.

## Regler för agenter

- Innan någon UI-ändring: läs `.claude/skills/apple-design/SKILL.md` och granska ändringen mot `.claude/skills/apple-design/references/hig/` (minst accessibility, color, layout, typography, dark-mode). Skillen är en granskare, inte en generator. Tokens som ger native-känslan finns i `docs/DESIGN.md`. Avvikelser dokumenteras i PR-texten.
- Läs `docs/DESIGN.md` för tokens innan du skriver CSS. Hitta inte på nya färger.
- Produktlogiken bor i `server/core/`. Ändra rangordning där, aldrig i `web/app.js`.
- Alla datakällor går via `server/adapters/` och returnerar objekt enligt `server/core/schema.md`. Ingen adapter läcker källspecifika fält uppåt.
- Inga npm-beroenden utan beslut i `docs/DECISIONS.md`. Det enda hittills är `@anthropic-ai/sdk` (§9).
- Svenska i UI och dokumentation. Engelska i kod och commit-meddelanden.
- Personuppgifter: lagra aldrig tokens eller studentdata i repot. `.env` är gitignored. Läs aldrig `.env`; du behöver inte se värdena för att skriva koden.
- Skriv aldrig till källsystemen. Tentaanmälan görs i Ladok; appen länkar dit.
- En funktion per PR. Börja varje session med `node server/server.js` och en kontroll av att `/api/today`, `/api/exams`, `/api/degree` svarar innan du ändrar något.

## Var saker finns

```
CLAUDE.md                      den här filen (AGENTS.md pekar hit)
docs/                          ARCHITECTURE, DECISIONS, DESIGN, DATA (framtida databas), SOURCES (systemkarta), screenshots
.claude/skills/apple-design/   HIG-baserad designgranskning, laddas automatiskt av Claude Code
server/server.js               statisk server + /api/today /api/exams /api/degree
server/adapters/               canvas.js timeedit.js ladok.js -> normaliserat schema
server/core/                   rank.js exams.js degree.js (produktlogiken)
server/data/                   mockprofiler viktor.json (KTH), julian.json (SU/DSV)
web/                           PWA: index.html app.js styles.css sw.js manifest. Fyra vyer: Idag, Tentor, Examen, Kopplingar (profil, kopplingar, utseende). Topprad med uppdatera/notiser/utseende/logga ut
web/data/                      larosaten.json (handskriven, verifierade adresser), gymnasier.json (byggd av scripts/build-gymnasier.mjs från Skolverket)
```

## Datakällor

- **Canvas**: personlig åtkomsttoken, skapas av studenten själv. Måste anropas från servern (ingen CORS).
- **TimeEdit**: iCal-prenumerationslänk som studenten hämtar själv. Länken är hemligheten.
- **Ladok**: inget officiellt student-API. Största risken i projektet. Tre spår i `docs/DECISIONS.md` §3. Spår 2 är byggt: intyg som PDF läses av en modell (`server/adapters/ladok.js`, `docs/DECISIONS.md` §9). Modellen skriver av, all status räknas deterministiskt.
- Studenten väljer nivå och lärosäte under Kopplingar (`docs/DECISIONS.md` §12); det styr förifyllda adresser och direktlänkar. Lägg till eller rätta lärosäten i `web/data/larosaten.json`, aldrig i `app.js`.
- Riktiga kopplingar görs i vyn Kopplingar och bor i studentens webbläsare (`docs/DECISIONS.md` §11), eller i `.env` enligt `.env.example` vid lokal körning. Saknas båda körs servern på mockdata.
- Innan en ny adapter byggs: läs `docs/SOURCES.md` för åtkomsttyp och vad systemet kan mata. Gymnasiesystem är avtalsspår, inte studentspår.

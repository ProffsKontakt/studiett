# Studiett

**Stud · i · ett** — alla dina studier i ett.

Ett aggregeringslager ovanpå lärosätenas befintliga system (Ladok, Canvas/Athena, TimeEdit). Vi äger inte datan; källsystemen gör det. Vi äger gränssnittet studenten faktiskt öppnar varje morgon.

## De tre funktionerna (och bara de tre, i den här ordningen)

| Lager | Funktion | Vad den kräver | Mäts som |
|---|---|---|---|
| Dagligt | **Idag** — allt som gäller idag och i veckan, rangordnat efter vad som kostar mest att missa | TimeEdit + Canvas + Ladok | Dagliga öppningar |
| Månadsvis | **Tentaanmälan** — "anmälan till SF1624 stänger torsdag, du är inte anmäld" | Ladok (kursregistreringar + anmälningsfönster) + tentaschema | Andel anmälda i tid |
| Terminsvis | **Examen** — hinner jag ta examen i tid, vilka rester blockerar, när är nästa chans | Ladok (resultat + program) | Rester per student, genomströmning |

Pluggschema, träningspass och generativa AI-funktioner är lager fyra. De byggs inte förrän de tre ovan har riktig data i sig.

## Arkitektur i en mening

Tre adaptrar normaliserar källsystemen till ett gemensamt schema (`server/core/schema.md`), en rangordningsmotor sorterar (`server/core/rank.js`), en PWA visar (`web/`). Adaptrarna körs på servern, inte i webbläsaren: Canvas API tillåter inte CORS-anrop med personliga tokens och Ladok saknar helt öppet studentAPI.

```
Ladok ──┐
Canvas ─┼─▶ adapters ─▶ normaliserat schema ─▶ rank / exams / degree ─▶ /api/* ─▶ PWA
TimeEdit┘
```

Se `docs/ARCHITECTURE.md` för detaljer och `docs/DECISIONS.md` för varför.

## Kom igång

```bash
node server/server.js          # startar på http://localhost:3000 med mockdata
STUDENT=julian node server/server.js   # mockprofil SU/DSV istället för KTH
```

Riktiga kopplingar: `cp .env.example .env`, fyll i `CANVAS_TOKEN` och `TIMEEDIT_ICAL_URL`, starta om. Saknas Ladok-data läggs de från en mockprofil med `LADOK_MOCK=viktor`. Vilka källor som svarade syns i `sources` i varje API-svar och längst ned i Idag-vyn om något gick fel.

Öppna i Safari på iPhone → Dela → Lägg till på hemskärmen. Då körs den som app, exakt som Optimera Hub.

Inga npm-beroenden i MVP:n. Node 18+ räcker.

## Struktur

```
studiett/
├── AGENTS.md              instruktioner till Claude/agenter som jobbar i repot
├── docs/                  arkitektur, beslut, designtokens
├── .claude/skills/apple-design/   HIG-baserad designgranskning (körs på varje UI-ändring)
├── server/
│   ├── server.js          statisk server + /api/today /api/exams /api/degree
│   ├── adapters/          canvas.js timeedit.js ladok.js → normaliserat schema
│   ├── core/              rank.js exams.js degree.js (produktlogiken)
│   └── data/              mockprofiler (viktor-kth.json, julian-su.json)
└── web/                   PWA: index.html app.js styles.css sw.js manifest
```

## Två riktiga testkonton från start

- **Viktor, KTH** (civilingenjör maskinteknik): Canvas + TimeEdit + Ladok. Den "rena" trion.
- **Julian, SU/DSV**: Athena (Itslearning), Daisy, iLearn (Moodle) + TimeEdit + Ladok. Den smutsiga verkligheten.

Om produkten fungerar på båda fungerar den på de flesta svenska lärosäten. DSV-fallet är beviset på att aggregeringen behövs.

## Nästa steg (i ordning)

1. Viktor genererar en Canvas access token (Konto → Inställningar → Ny åtkomsttoken) och hämtar sin TimeEdit-iCal-länk. Lägg i `.env`. Kör `adapters/canvas.js` och `adapters/timeedit.js` mot riktig data.
2. Kartlägg hur Ladok exponerar kursregistreringar, resultat och tentaanmälningsfönster för studenten (ladok.se → nätverksfliken i Safari). Det är projektets största risk. Se `docs/DECISIONS.md` §3.
3. Kör appen dagligen i två veckor. Om ni själva slutar öppna den, är rangordningen fel, inte designen.
4. 20 kursare i oktober. Mät dagliga öppningar och andel som anmäler sig till tenta i tid.

## Skärmbilder

`docs/screenshots/`. Renderade i headless Chromium på Linux med reservtypsnitt, så radbrytningar blir tightare på en riktig iPhone med SF Pro.

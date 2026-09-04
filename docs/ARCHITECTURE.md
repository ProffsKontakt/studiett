# Arkitektur

## Princip

Studiett lagrar så lite som möjligt men låtsas inte att det lagrar ingenting. Det vi behandlar är personuppgifter enligt GDPR oavsett om det sparas på disk. Därför:

- Källsystemen är master. Vi skriver aldrig tillbaka till dem i MVP.
- Vi cachar normaliserad data per student i högst 24 h för att kunna skicka notiser och räkna trender. Cache kan raderas av studenten när som helst.
- Tokens lagras krypterade på servern, aldrig i klienten. I MVP: `.env` på utvecklarens maskin, läst av `server/env.js` utan beroenden.
- Riktiga svar cachas i minne i `CACHE_TTL_MIN` minuter (standard 10) per student. Misslyckade anrop cachas inte. Varje API-svar bär `sources`, per källa `ok`, `mock:<profil>`, `saknas` eller feltexten, så att klienten kan säga vilken koppling som inte svarade.

## Lager

### 1. Adaptrar (`server/adapters/`)

En adapter per källsystem. Varje adapter exporterar `fetchAll(credentials) → NormalizedBundle` (se `core/schema.md`).

| Källa | Åtkomst | Status |
|---|---|---|
| Canvas | REST API, personlig access token. Ingen CORS, måste gå via server. | Inkopplad bakom `CANVAS_TOKEN` i `.env`. Otestad mot riktig token. |
| TimeEdit | iCal-prenumerationslänk som studenten hämtar själv | Inkopplad bakom `TIMEEDIT_ICAL_URL`. Parsern testad mot lokal .ics med TZID, sommar- och vintertid. Otestad mot riktig länk. |
| Ladok | Inget officiellt studentAPI. (a) studentens egen session mot ladok.se, (b) intyg som PDF, (c) avtal med Ladokkonsortiet. | (b) byggd: `POST /api/ladok-import` läser resultat- och registreringsintyg med en modell (`docs/DECISIONS.md` §9). Resultatet bor i studentens webbläsare och skickas med som `ladok` i anropen. `LADOK_MOCK=viktor` ger tentafönster tills (a) finns. |
| Athena / Itslearning (SU) | REST API finns för Itslearning, kräver lärosätets godkännande | Ej påbörjad |
| Daisy / iLearn (SU DSV) | Daisy: skrapning. iLearn: Moodle web services om aktiverat. | Ej påbörjad |

Vilka system som finns att koppla, per lärosäte och gymnasium, med åtkomsttyp och vilka entiteter de kan mata: `docs/SOURCES.md`.

### 2. Normaliserat schema (`server/core/schema.md`)

Allt uppströms trycks in i fem typer: `Course`, `Event`, `Assignment`, `Result`, `ExamRegistration`. Ingen kod utanför adaptrarna får känna till Canvas-, Ladok- eller TimeEdit-begrepp.

### 3. Produktlogik (`server/core/`)

- `rank.js` rangordnar allt som gäller de kommande 7 dagarna efter konsekvens gånger brådska. Detta är produkten. Vikterna är dokumenterade i filen och ska justeras mot verkligt beteende, inte mot magkänsla.
- `exams.js` matchar kursregistreringar mot tentatillfällen och anmälningsfönster, producerar "du är inte anmäld"-larm.
- `degree.js` räknar tagna hp, rester, blockerande moment och projicerad examen.

### 4. API (`server/server.js`)

`GET /api/today`, `GET /api/exams`, `GET /api/degree`. JSON. Samma vägar tar `POST { ladok }` med importerade Ladok-data som då ersätter mockens program och kurser. `POST /api/ladok-import { pdf }` läser ett intyg och svarar med Ladok-data utan att spara något. Svaren byggs i `server/api.js` som både den lokala servern och Vercels funktioner i `api/` anropar. Ingen auth i MVP: lokalt, eller på Vercel bakom Deployment Protection (`docs/DECISIONS.md` §8). Auth är första sak som byggs när fler än vi två kör den.

### 5. PWA (`web/`)

Ren HTML/CSS/JS, inga ramverk. Installeras via "Lägg till på hemskärmen". Service worker cachar skalet så appen öppnar direkt även offline och visar senast hämtade data.

## Notiser

Tentaanmälan-larmet är en push-produkt. Web Push fungerar på iOS 16.4+ bara om appen är installerad på hemskärmen. Det är en accepterad begränsning i MVP. Om det visar sig vara ett problem för spridning är nästa steg en Capacitor-wrapper för App Store, inte en omskrivning.

## Vad som medvetet inte finns

- Ingen databas. JSON-filer per student tills auth finns. Schemat för när den behövs, med storleksräkning och retention, står i `docs/DATA.md`.
- Ingen LLM i produktlogiken. Rangordningen är deterministisk och förklarbar. Den enda modellanvändningen är avskrift av Ladok-intyg (`docs/DECISIONS.md` §9).
- Ingen inloggning. Lokal körning, eller Vercel bakom Vercels egen inloggning.

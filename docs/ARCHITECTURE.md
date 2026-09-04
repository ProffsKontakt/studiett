# Arkitektur

## Princip

Studiett lagrar så lite som möjligt men låtsas inte att det lagrar ingenting. Det vi behandlar är personuppgifter enligt GDPR oavsett om det sparas på disk. Därför:

- Källsystemen är master. Vi skriver aldrig tillbaka till dem i MVP.
- Vi cachar normaliserad data per student i högst 24 h för att kunna skicka notiser och räkna trender. Cache kan raderas av studenten när som helst.
- Tokens lagras krypterade på servern, aldrig i klienten. I MVP: `.env` på utvecklarens maskin.

## Lager

### 1. Adaptrar (`server/adapters/`)

En adapter per källsystem. Varje adapter exporterar `fetchAll(credentials) → NormalizedBundle` (se `core/schema.md`).

| Källa | Åtkomst | Status |
|---|---|---|
| Canvas | REST API, personlig access token. Ingen CORS, måste gå via server. | Stub med riktiga endpoints |
| TimeEdit | iCal-prenumerationslänk som studenten hämtar själv | iCal-parser klar, otestad mot riktig länk |
| Ladok | Inget officiellt studentAPI. Alternativ: (a) studentens egen session mot ladok.se, (b) export/intyg-parsning, (c) avtal med Ladokkonsortiet. | Mock. Största risken i projektet. |
| Athena / Itslearning (SU) | REST API finns för Itslearning, kräver lärosätets godkännande | Ej påbörjad |
| Daisy / iLearn (SU DSV) | Daisy: skrapning. iLearn: Moodle web services om aktiverat. | Ej påbörjad |

### 2. Normaliserat schema (`server/core/schema.md`)

Allt uppströms trycks in i fem typer: `Course`, `Event`, `Assignment`, `Result`, `ExamRegistration`. Ingen kod utanför adaptrarna får känna till Canvas-, Ladok- eller TimeEdit-begrepp.

### 3. Produktlogik (`server/core/`)

- `rank.js` rangordnar allt som gäller de kommande 7 dagarna efter konsekvens gånger brådska. Detta är produkten. Vikterna är dokumenterade i filen och ska justeras mot verkligt beteende, inte mot magkänsla.
- `exams.js` matchar kursregistreringar mot tentatillfällen och anmälningsfönster, producerar "du är inte anmäld"-larm.
- `degree.js` räknar tagna hp, rester, blockerande moment och projicerad examen.

### 4. API (`server/server.js`)

`GET /api/today`, `GET /api/exams`, `GET /api/degree`. JSON. Ingen auth i MVP (körs lokalt). Auth är första sak som byggs när fler än vi två kör den.

### 5. PWA (`web/`)

Ren HTML/CSS/JS, inga ramverk. Installeras via "Lägg till på hemskärmen". Service worker cachar skalet så appen öppnar direkt även offline och visar senast hämtade data.

## Notiser

Tentaanmälan-larmet är en push-produkt. Web Push fungerar på iOS 16.4+ bara om appen är installerad på hemskärmen. Det är en accepterad begränsning i MVP. Om det visar sig vara ett problem för spridning är nästa steg en Capacitor-wrapper för App Store, inte en omskrivning.

## Vad som medvetet inte finns

- Ingen databas. JSON-filer per student tills auth finns.
- Ingen LLM. Rangordningen är deterministisk och förklarbar. LLM-lagret kommer när det finns beteendedata att resonera över.
- Ingen inloggning. Lokal körning.

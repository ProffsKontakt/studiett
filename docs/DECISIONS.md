# Beslut

Korta protokoll. Ett beslut per rubrik. Ändra genom att lägga till ett nytt, inte genom att redigera gamla.

## 1. Aggregator, inte ersättare (2026-09-04)

Vi bygger gränssnittslagret ovanpå befintliga system. Skälen: Ladok är lärosätenas juridiska register och kan inte ersättas, Stockholms stad gick nyss från monolit till inköpta moduler efter en miljard kronor, och "fungerar ovanpå det ni redan har" är en tillköpsupphandling medan "riv ut allt" är en förlustupphandling. Att äga bakänden är en option för om tio år, inte en plan.

## 2. Tre funktioner, i ordning (2026-09-04)

Idag (dagligt), Tentaanmälan (månadsvis), Examen (terminsvis). Frekvens gånger konsekvens. Allt annat är lager fyra och byggs inte förrän lager ett till tre har riktig data.

## 3. Ladok-åtkomst är den öppna frågan (2026-09-04)

Ladok saknar öppet studentAPI. Tre vägar, i ordning av hur snabbt de ger data:
1. Studentens egen session mot ladok.se, proxad via vår server. Snabbast. Bräckligt. Juridiskt: studenten hämtar sin egen data, vilket är okej, men lärosätet kan invända mot automatiserad åtkomst.
2. Parsning av resultatintyg (PDF) som studenten laddar ner själv. Robust men manuellt.
3. Avtal med Ladokkonsortiet eller ett enskilt lärosäte. Långsamt. Det enda som skalar.

Vi börjar med 1 för att få data, dokumenterar allt vi lär oss om gränssnittet, och öppnar spår 3 så snart vi har 20 aktiva användare på KTH att peka på.

## 4. PWA först, inte App Store (2026-09-04)

Samma väg som Optimera Hub. En kodbas, installerbar på iOS och Android, ingen granskningskö. Kända kostnader: Web Push kräver hemskärmsinstallation på iOS, och ingen Face ID-inloggning. Omprövas om spridningen visar sig blockeras av installationssteget.

## 5. Inga ramverk, inga beroenden i MVP (2026-09-04)

Vanilla JS, CSS-variabler, Node utan npm-paket. Det tvingar oss att hålla appen liten och gör att vem som helst av oss kan läsa hela koden på en kväll. Omprövas när vi behöver auth eller databas.

## 6. Apple HIG som designgrund (2026-09-04)

`.claude/skills/apple-design` används som granskare på varje UI-ändring. Observera att skillen är en granskare, inte en generator: den gör inget native av sig självt. Tokens som faktiskt ger native-känslan finns i `docs/DESIGN.md`.

## 7. Rangordningen är deterministisk (2026-09-04)

Ingen LLM i rangordningen. En student ska kunna fråga "varför ligger det här överst" och få ett svar i en mening. LLM används först när det finns beteendedata, och då för att föreslå, aldrig för att sortera tyst.

## 8. Deploy till Vercel, bakom Vercels egen inloggning (2026-09-04)

Repot deployas automatiskt till Vercel. `web/` serveras statiskt och `api/*.js` kör samma svar som den lokala servern via `server/api.js`. Inga beroenden tillkommer: Vercels Node-runtime kör ESM-filerna i `api/` som de är. Auth finns fortfarande inte i appen (§ARCHITECTURE), så produktions-URL:en ska stå bakom Vercels Deployment Protection tills egen inloggning finns. Den dag `CANVAS_TOKEN` eller `TIMEEDIT_ICAL_URL` läggs in som miljövariabel på Vercel är det Viktors data som ligger bakom den URL:en. Utan skydd får de inte läggas in.

## 9. Ladok via intyg, läst av en modell (2026-09-04)

Spår 2 i §3 byggs först. Studenten hämtar resultatintyg och registreringsintyg i Ladok för studenter och laddar upp PDF:erna i Examen-vyn. En modell (`claude-opus-5`, Anthropic) skriver av intyget till JSON enligt ett strikt schema; status (klar, registrerad, rest), hp och examensprognos räknas sedan deterministiskt i `server/adapters/ladok.js` och `server/core/`. Modellen skriver av, den sorterar och bedömer inte, så §7 håller.

Det är projektets första npm-beroende, `@anthropic-ai/sdk`, vilket bryter §5 medvetet: att skriva HTTP-anropet själv vore mer kod och mer risk än paketet. Inga fler beroenden utan nytt beslut.

Intygen lagras aldrig hos oss. PDF:en går genom minnet till modellen och kastas. Resultatet sparas i studentens webbläsare och skickas med varje anrop. "Ta bort Ladok-data" raderar allt.

Ett resultatintyg visar bara godkända resultat. Rester syns först när ett registreringsintyg läggs ovanpå. Anmälningsperioder för tentor finns inte i något intyg; det förblir spår 1 eller handunderhållet i `LADOK_MOCK`.

## 10. Indigo och solgult, Optimera-släkt (2026-09-05)

Grundarna vill att Studiett känns som en syskonprodukt till Optimera Energi: indigo (#3648C3) och solgult (#FFDD6C) på benvitt (#F4F1EA), display-serifen Fraunces. Det ersätter det gröna i §6-eran. Vad som inte ändras: strukturen är fortfarande Apples (grupperade listor, bottenflikar, systemfont i brödtext, 44 pt tryckytor, mörkt läge), skillen granskar fortfarande varje UI-ändring, och gult är fortfarande bara tillåtet på det enda stora elementet. Alla kontraster är räknade och står i `docs/DESIGN.md`. Fraunces självhostas (SIL OFL) så att inga anrop går till Google.

## 11. Kopplingar bor i studentens webbläsare (2026-09-05)

En fjärde vy, Kopplingar, där studenten själv klistrar in Canvas-token och kalenderlänkar (TimeEdit, KronoX, valfri iCal) och laddar upp Ladok-intyg. Uppgifterna sparas i webbläsarens localStorage och skickas med varje anrop till vårt API, som använder dem för att hämta från källorna och sedan glömmer dem. Servern lagrar aldrig en token. Varje anrop verifieras först (`POST /api/connect/verify`) så att studenten får ett kvitto: namn och antal kurser för Canvas, antal händelser för en kalender.

Det ersätter "tokens i `.env`" som enda väg och gör att flera personer kan använda samma deploy utan databas eller inloggning: var och en ser bara det egna. `.env` finns kvar som reserv för lokal körning.

Vad det inte är: säkert mot skadlig kod i sidan. En token i localStorage kan läsas av vilket skript som helst på samma origin. Därför: inga tredjepartsskript, ingen analys, ingen CDN. Fonten självhostas. Databas och auth (`docs/DATA.md`) flyttar tokens till servern när de byggs.

Servern hämtar bara från https-adresser på publika värdar, med tio sekunders tidsgräns och två megabyte tak (`server/net.js`), eftersom studenten själv anger adresserna.

Kopplingar är inte en fjärde funktion (§2). Det är inställningar, och HIG Settings säger att kontorelaterade val hör hemma i en egen yta.

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

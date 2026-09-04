# Studiett

Läs hela den här filen innan du gör något. Den är produktens hjärna. Om något du vill bygga strider mot den, säg det och fråga, bygg inte runt.

## Vad Studiett är

En app där en svensk universitetsstudent kopplar sina egna Canvas-, TimeEdit- (och senare Ladok-)konton och får hela sin studietid på ett ställe: schema, deadlines, kursmaterial, tentor, och en AI-assistent som faktiskt ser studentens data. Namnet är "stud i ett".

Studenten är kund, användare och ägare av sin data. Ingen skola upphandlar något. Ingen kommun. Inga minderåriga. Studenten klistrar själv in sina kopplingar, och kan koppla bort med en knapp.

Ett Studiett-konto ska fungera på vilket svenskt lärosäte som helst som kör Canvas. KTH är först eftersom grundarna går där.

## Varför det här, och inte något annat

- Ladok, Canvas och TimeEdit går inte att ersätta. Vi lägger oss ovanpå.
- Skolsidan (grundskola/gymnasium) kräver huvudmannaavtal, LOU och 12–24 månaders säljcykel. Vi gör det inte nu. SS 12000 finns när vi någon gång vill dit.
- Universitetsstudenten är myndig och äger sin data. Det är den enda vägen i branschen utan tillstånd från någon annan.
- Lärosätenas egna appar funkar bara på det egna lärosätet. Vi funkar överallt.

## Vad vi INTE bygger i prototyp 1

- BankID. Det ger ingen dataåtkomst, kostar per inloggning och kräver avtal. Inloggning sker med magic link eller Google/Apple via Supabase Auth.
- Ladok-integration. Det finns inget öppet student-API. Skjuts till fas 3, eventuellt via uppladdat resultatintyg.
- Universitetsmail. Kräver admin consent från lärosätets Microsoft-tenant. Fas 4 tidigast.
- Lärarfunktioner, vårdnadshavarfunktioner, betygsprognoser, "vilken student behöver stöd". Det sista är högrisk under EU:s AI-förordning och vi går inte dit.
- Notiser, sociala funktioner, gamification.

Om användaren eller du frestas att lägga till något av ovanstående: stopp, hänvisa hit.

## Användaren

En 19–25-årig student som öppnar appen 07.45 i tunnelbanan för att se dagens schema, och 22.30 för att kolla vad som ska in i veckan. Hen har inte tid att lära sig en app. Om onboarding tar mer än tre minuter tappar vi hen.

Frågor hen ställer: "vad har jag imorgon", "vad ska in den här veckan", "när är tentan i SF1624", "sammanfatta föreläsning 4", "vilka labbar är kvar".

## Designprinciper

Målbild: premium, minimalistiskt, i klass med Apples egna appar. Inte "inspirerat av", utan samma disciplin.

- Vitt (eller sant svart i dark mode) som bakgrund. En enda accentfärg. Ingen gradient som dekoration.
- Systemtypsnitt: `-apple-system, BlinkMacSystemFont, "SF Pro", system-ui`. Tydlig typskala. Stora, lugna rubriker. Tabellsiffror för tider.
- Innehållet är gränssnittet. Inga kort runt allt, inga skuggor för sin egen skull, inga ikoner som inte behövs. Struktur (linjer, avstånd, gruppering) bär informationen.
- Rörelse bara som svar på användarens handling: öppna, expandera, bekräfta. Ingen intro-animation, inga hover-effekter på allt.
- Copy: kort, aktiv, sentence case, svenska. Knappen säger vad som händer: "Koppla Canvas", inte "Skicka". Tomma vyer förklarar nästa steg. Fel säger vad som gick fel och hur man fixar det, utan att be om ursäkt.
- Mobil först. Allt ska vara tumvänligt på en 390 px bred skärm. Desktop är en bredare version av samma sak, inte en annan app.
- Respektera `prefers-reduced-motion` och `prefers-color-scheme`. Synligt tangentbordsfokus.
- Ta bort en sak innan du är klar med en vy.

## Teknik

- Next.js (App Router), TypeScript, React. PWA med manifest så den kan läggas på hemskärmen. Ingen native app i prototyp 1.
- Supabase: Auth, Postgres, RLS. Varje rad i `profiles` ägs av `auth.uid()`.
- Vercel för hosting.
- Anthropic API (`claude-sonnet-4-6`) för assistenten. Kontexten byggs per anrop ur studentens data. Ingen vektordatabas i prototyp 1; ett kursmaterial åt gången får plats i kontexten.
- Ingen CSS-framework. Vanlig CSS med variabler. Håll selektorspecificitet platt.
- Befintlig kod: `lib/canvas.ts` (Canvas-klient), `lib/ical.ts` (TimeEdit), `lib/crypto.ts` (AES-256-GCM för tokens), `app/api/*` (demo-routes som läser från .env). Bygg vidare på dem, skriv inte om från noll.

## Integrationer, exakt så här

**Canvas** (`https://canvas.kth.se`, konfigurerbar per student): studenten skapar en access token under Konto → Inställningar → Ny åtkomsttoken. Vi använder:
- `GET /api/v1/courses?enrollment_state=active`
- `GET /api/v1/planner/items?start_date&end_date` (alla deadlines i ett svep)
- `GET /api/v1/courses/:id/modules?include[]=items`
- `GET /api/v1/files/:id` → nedladdnings-URL → text ur PDF/PPTX
- `GET /api/v1/users/self` för att verifiera token vid onboarding
Rate limit finns; cacha svar per användare i några minuter.

**TimeEdit**: studenten klistrar in sin iCal-prenumerationslänk. Vi parsar VEVENT. Länken kan vara upp till 500 tecken, validera att den svarar med `text/calendar`.

**Ladok**: ingen integration i prototyp 1.

## Säkerhet, icke förhandlingsbart

- Canvas-token är full åtkomst till studentens konto. Lagras endast krypterad (`lib/crypto.ts`), nyckeln i miljövariabel, aldrig i databasen, aldrig i loggar, aldrig i felmeddelanden, aldrig i klienten.
- "Koppla bort"-knapp som raderar token omedelbart. Ska finnas från första versionen med inloggning.
- Läs aldrig `.env.local`. Du behöver inte se värdena för att skriva koden.
- Ingen tredjepartsanalys eller tracking i prototyp 1.
- Kursmaterial cachas inte permanent hos oss utan studentens aktiva val.

## Faser

### Fas 0, klar: lokal demo
En användare, tokens i `.env.local`, veckovy och chatt. Finns i repot.

### Fas 1: prototyp 1, det vi bygger nu
Mål: en främling på KTH kan skapa konto, koppla Canvas och TimeEdit på under tre minuter, och se sin vecka. 30 studenter använder den.

1. Supabase Auth (magic link + Google). `profiles`-tabell enligt `supabase/001_users_and_tokens.sql`. RLS på.
2. Onboarding i tre steg, en skärm per steg, med bild-guide för hur man hittar token och iCal-länk. Verifiera varje koppling direkt (`/users/self`, hämta iCal) och visa studentens namn och antal kurser som kvitto.
3. Vy "Idag": dagens schema, deadlines inom 48 h. Det här är hemskärmen.
4. Vy "Vecka": sju dagar, schema och deadlines i samma flöde.
5. Vy "Kurser": lista, per kurs: moduler, filer, kommande uppgifter.
6. Assistent: ett textfält längst ned på alla vyer. Kontext = deadlines 30 dagar, schema 14 dagar, plus vald kursfil om studenten frågar om den. Svarar på svenska, kort, alltid med datum och veckodag.
7. Inställningar: kopplingar, koppla bort, radera konto.
8. PWA-manifest, ikon, deploy till Vercel på studiett.se.

Klart när: tre personer utanför grundarteamet har gjort onboarding utan hjälp och kommit tillbaka dag två.

### Fas 2: material och minne
- Assistenten läser PDF/PPTX från Canvas-moduler.
- Studenten kan markera "läst"/"klar" på moduler och uppgifter; sparas hos oss.
- Tentaperioder markeras tydligt.
- Enkel mätning: veckoaktiva användare, retention dag 7. Egen tabell, ingen tredje part.

### Fas 3: Ladok och fler lärosäten
- Resultat via uppladdat intyg eller via lärosätets Ladok-öppning om KTH ger oss det.
- Lärosätesväljare i onboarding: Canvas-URL och TimeEdit-bas per lärosäte.

### Fas 4: allt på ett ställe
- Universitetsmail via Microsoft Graph efter admin consent.
- Native-skal om PWA inte räcker.

## Så här jobbar vi i Claude Code

- En fas-punkt per session. Blanda inte onboarding med assistent.
- Börja varje session med `npm run dev` och en kontroll av att befintliga routes svarar innan du ändrar något.
- Skriv inga funktioner som inte står i fas-listan utan att fråga.
- När du är osäker på design: ta bort, inte lägg till.
- Commit-meddelanden på engelska, kod på engelska, gränssnitt på svenska.
- Innan en session avslutas: kör `npx tsc --noEmit` och `npm run build`.

## Öppna frågor (svara innan fas 1 avslutas)
- Domän: studiett.se primär, studiett.com/.app och studiet.se som skydd. Köpta? (ja/nej)
- Vem av grundarna testar först med riktiga KTH-kopplingar?
- Accentfärg: bestäm en, skriv in här.

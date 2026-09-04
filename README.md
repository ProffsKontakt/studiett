# Studiett, lokal demo (fas 0)

Canvas + TimeEdit + en AI-assistent som ser din data. Körs lokalt med dina egna kopplingar.

## Kom igång (10 minuter)

1. `npm install`
2. `cp .env.example .env.local`
3. Canvas-token: logga in på canvas.kth.se → Konto → Inställningar → scrolla till "Godkända integrationer" → "+ Ny åtkomsttoken". Klistra in i `CANVAS_TOKEN`. Tokenen ger full åtkomst till ditt Canvas-konto: dela den aldrig.
4. TimeEdit: öppna ditt schema på cloud.timeedit.net/kth → "Prenumerera" → kopiera länken (börjar med `https://cloud.timeedit.net/.../ri...ics`). Klistra in i `TIMEEDIT_ICAL_URL`.
5. `ANTHROPIC_API_KEY` från console.anthropic.com.
6. `npm run dev` → http://localhost:3000

## Vad som finns
- `lib/canvas.ts`: kurser, planner (deadlines), moduler, filer.
- `lib/ical.ts`: TimeEdit-schema.
- `app/api/chat`: agenten får deadlines + schema som kontext.
- `lib/crypto.ts` + `supabase/001...sql`: förberett för steg 2 (flera användare, krypterade tokens). Används inte i demon.

## Nästa steg, i ordning
1. Kör mot dina egna kopplingar tills det känns rätt.
2. Låt agenten läsa kursfiler (`canvas.moduleItems` → `canvas.file` → PDF-text).
3. Supabase-auth + onboarding där studenten själv klistrar in token och länk.
4. Deploy till Vercel, PWA-manifest, 30 vänner.

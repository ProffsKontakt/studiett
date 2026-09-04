# Data

Hur Studiett ska lagra data när det behövs, och varför det inte behövs än. Skrivet innan databasen finns, så att beslutet om den blir konkret. Ingen kod i det här dokumentet är körd.

## Läget nu

Ingen databas. Per student finns tre slags data, och alla har redan ett hem:

| Data | Var den bor | Hur länge |
|---|---|---|
| Canvas-token, TimeEdit-länk | `.env` lokalt eller miljövariabler i Vercel | Tills studenten tar bort dem |
| Normaliserat svar från källorna | Minnescache i servern, `CACHE_TTL_MIN` minuter | Minuter |
| Ladok-data från intyg | Studentens webbläsare (localStorage), skickas med varje anrop | Tills studenten trycker "Ta bort" |

Det räcker exakt så länge appen har en användare per deploy. Databasen behövs samma dag som auth behövs: när fler än ni två kör den. Bygg dem tillsammans, aldrig var för sig (`docs/ARCHITECTURE.md`, `docs/DECISIONS.md` §5).

## Hur stort är det egentligen

Viktors hela normaliserade profil är 12 KB. Det som äter utrymme är inte studenterna, det är om man sparar råa svar eller dagliga kopior.

| Modell | 1 000 studenter, ett år |
|---|---|
| Råa Canvas- och TimeEdit-svar sparade per hämtning | tiotals GB |
| En kopia av hela bundlen per dag | ~4 GB |
| Entiteter med upsert per nyckel plus en händelselogg | < 100 MB |

Supabases gratisnivå har 500 MB databas. Den tredje modellen ryms i åratal. Ingen kvantisering behövs; det som behövs är att aldrig spara det som kan hämtas igen.

## Principer

1. **Källsystemen är master.** Vi sparar det normaliserade schemat (`server/core/schema.md`), aldrig råa svar. Råsvar cachas i minne i minuter och skrivs aldrig till disk.
2. **Upsert, inte ögonblicksbilder.** En rad per (student, källa, id). Ny hämtning uppdaterar raden. Historik finns bara i händelseloggen, och bara för det vi mäter.
3. **Tokens i en egen tabell utan klientåtkomst.** Krypterade med AES-256-GCM, nyckeln i miljövariabel, tabellen läsbar enbart av serverns service role. Aldrig genom RLS-policyer till webbläsaren.
4. **Radera på riktigt.** "Ta bort" i appen raderar raderna, inte markerar dem. `on delete cascade` från `auth.users`.
5. **Mät lite, inte allt.** Händelseloggen sparar det som avgör produkten: appen öppnades, tentaanmälan-larm visades, studenten anmälde sig i tid. Inga klick, inga vyer, ingen tredje part (§ARCHITECTURE).

## Schema, förslag

Postgres i Supabase. Alla tabeller ägs av `auth.uid()` genom kolumnen `student_id` och RLS. Tider i `timestamptz`, hp i `numeric(4,1)`.

```sql
-- En rad per student. Skapas av en trigger på auth.users.
create table students (
  id            uuid primary key references auth.users(id) on delete cascade,
  institution   text not null default 'kth',
  display_name  text,
  created_at    timestamptz not null default now()
);

-- Hemligheter. INGEN RLS-policy för anon/authenticated: bara service role läser.
create table connections (
  student_id    uuid primary key references students(id) on delete cascade,
  canvas_base   text,
  canvas_token  text,          -- AES-256-GCM-blob, aldrig klartext
  timeedit_url  text,          -- iCal-länken är också en hemlighet
  updated_at    timestamptz not null default now()
);
revoke all on connections from anon, authenticated;

-- Normaliserade entiteter. Nyckeln är (student, källa, id från källan) så att en
-- ny hämtning skriver över i stället för att lägga till.
create table courses (
  student_id  uuid references students(id) on delete cascade,
  code        text,
  name        text not null,
  hp          numeric(4,1) not null default 0,
  term        text,
  status      text not null check (status in ('registered','completed','rest')),
  source      text,                          -- null = Ladok-härledd
  primary key (student_id, code)
);

create table modules (
  student_id  uuid references students(id) on delete cascade,
  course_code text,
  code        text,
  name        text,
  hp          numeric(4,1) not null default 0,
  passed      boolean not null default false,
  grade       text,
  passed_at   date,
  primary key (student_id, course_code, code),
  foreign key (student_id, course_code) references courses(student_id, code) on delete cascade
);

create table events (
  student_id  uuid references students(id) on delete cascade,
  source      text not null,
  source_id   text not null,
  course_code text,
  type        text not null,
  title       text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  location    text,
  mandatory   boolean not null default false,
  url         text,
  primary key (student_id, source, source_id)
);

create table assignments (
  student_id  uuid references students(id) on delete cascade,
  source      text not null,
  source_id   text not null,
  course_code text not null,
  title       text not null,
  due_at      timestamptz not null,
  submitted   boolean not null default false,
  graded      boolean not null default false,
  hp          numeric(4,1),
  url         text,
  primary key (student_id, source, source_id)
);

create table exam_registrations (
  student_id   uuid references students(id) on delete cascade,
  course_code  text not null,
  module_code  text not null,
  exam_at      timestamptz not null,
  opens_at     timestamptz not null,
  closes_at    timestamptz not null,
  registered   boolean not null default false,
  url          text,
  primary key (student_id, course_code, module_code, exam_at)
);

create table programs (
  student_id     uuid primary key references students(id) on delete cascade,
  name           text not null,
  total_hp       numeric(5,1) not null,
  start_term     text,
  nominal_terms  int
);

-- Vad vi mäter. Inget annat. Rensas efter 90 dagar.
create table events_log (
  id          bigint generated always as identity primary key,
  student_id  uuid references students(id) on delete cascade,
  kind        text not null check (kind in ('app_opened','exam_alert_shown','exam_registered_in_time')),
  at          timestamptz not null default now(),
  course_code text
);
create index on events_log (student_id, at);

-- RLS: varje student ser bara sina rader.
alter table students enable row level security;
create policy own on students for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- samma policy på courses, modules, events, assignments, exam_registrations, programs, events_log
-- med student_id = auth.uid(). connections har ingen policy alls.
```

Index utöver primärnycklarna: `events (student_id, starts_at)` och `assignments (student_id, due_at)`, eftersom Idag-vyn alltid frågar "de kommande sju dagarna".

## Storlek per student med det här schemat

| Tabell | Rader | ~bytes |
|---|---|---|
| courses + modules | 20 + 40 | 6 KB |
| events (14 dagar rullande) | 60 | 12 KB |
| assignments (30 dagar) | 20 | 4 KB |
| exam_registrations | 10 | 2 KB |
| events_log (90 dagar) | 300 | 15 KB |

Under 40 KB. Tusen studenter är 40 MB. Index fördubblar det. Fortfarande under en tiondel av gratisnivån.

## Retention

- `events` och `assignments`: rader äldre än 30 dagar raderas av ett schemalagt jobb (`pg_cron` finns i Supabase). Historiken finns i källsystemet.
- `events_log`: 90 dagar.
- `courses`, `modules`, `programs`, `exam_registrations`: behålls så länge kontot finns. Det är studentens studiehistorik och den är liten.
- Radera konto: en `delete from auth.users` tar allt via cascade. Verifiera med en test som räknar rader före och efter.

## Vad som ändras i koden när det byggs

- `server/adapters/index.js`: `loadBundle(studentId)` läser `connections` via service role och skriver normaliserade entiteter med upsert i stället för minnescache. Cachen blir databasen.
- `web/app.js`: Ladok-overlayen i localStorage försvinner; importen skriver till `courses`/`modules`/`programs` direkt.
- `api/*.js`: tar session-token från Supabase Auth, aldrig `STUDENT` från miljön.
- Adaptrarnas returtyp ändras inte. `server/core/` ändras inte alls. Det är poängen med schemat i `server/core/schema.md`.

## Vad som inte ska byggas

- Ingen vektordatabas, inga embeddings. Det finns ingen fråga i produkten som kräver semantisk sökning.
- Ingen lagring av PDF:er eller råa API-svar.
- Ingen "data warehouse". Tre frågor besvarar mätningen: dagliga öppningar, andel larm som ledde till anmälan i tid, retention dag 7. De går att svara på med `count(*)` på `events_log`.

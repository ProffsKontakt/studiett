# Design

## Vad appen är

En morgonvy för studenter. Öppnas med ena handen på väg till tunnelbanan. Den ska svara på en fråga: vad kostar mest att missa idag. Allt annat är sekundärt.

## Ett minnesvärt element

Rangordningen. Den översta raden i Idag-vyn är stor, ensam och har en förklaring i en mening ("Anmälan stänger torsdag, du är inte anmäld"). Resten av listan är tyst. Vi spenderar all djärvhet där. Ingen dekoration någon annanstans.

## Tokens

Systemtypsnitt för brödtext och en display-serif för det som ska kännas igen. Färgerna är Optimera-släkt: indigo och solgult på benvitt (`docs/DECISIONS.md` §10).

### Färg

Semantiska namn. Ljust och mörkt läge via `prefers-color-scheme`.

| Token | Ljust | Mörkt | Roll |
|---|---|---|---|
| `--bg` | #F4F1EA | #0E0E0C | Sidbakgrund (ben / bläck) |
| `--surface` | #FFFFFF | #1A1A17 | Listceller, kort |
| `--surface-2` | #EFE9DC | #2A2A26 | Sekundära ytor, skelett, neutrala badges |
| `--label` | #0E0E0C | #F4F1EA | Primär text |
| `--label-2` | rgba(14,14,12,.62) | rgba(244,241,234,.65) | Sekundär text. 5,4:1 i ljust, 7,2:1 i mörkt. |
| `--label-3` | rgba(14,14,12,.35) | rgba(244,241,234,.35) | Separatorer och inaktiva element. Aldrig läsbar text. |
| `--tint` | #3648C3 | #9AA5FF | Indigo. Text, ikoner, länkar, aktiv flik. Betyder alltid tryckbar. |
| `--tint-fill` | #3648C3 | #3648C3 | Indigo som fyllnad i knappar och "klart"-badges. Vit text ger 7,3:1 i båda lägena. |
| `--on-tint` | #FFFFFF | #FFFFFF | Text på `--tint-fill` |
| `--sun` | #FFDD6C | #FFDD6C | Solgult. Bara för det enda stora elementet när det kostar dig något. Bläcktext ger 14,5:1. |
| `--danger` | #D93A2B | #FF6B5E | "Kostar dig en tentaomgång". Fyllnad i ljust (vit text 4,6:1), text i mörkt (6,2:1). |
| `--warn` | #E9B949 | #E9B949 | Amber. Deadline inom 48 h, "ej anmäld". Bläcktext 10,6:1. |

Regler:
- `--tint` betyder alltid "tryckbar" eller "klart". Aldrig som dekoration.
- `--sun` används på exakt ett ställe per vy: det översta rankade kortet i Idag när det är `is-danger` eller `is-warn`, och examensprognosen när du ligger efter. Gult utan konsekvens är förbjudet.
- Gult är aldrig textfärg. Text på gult är alltid bläck.
- Ökad kontrast (`prefers-contrast: more`): sekundärtext höjs till .85 i alfa och tint går till djupare indigo #2A3A9E i ljust, ljusare #C3CAFF i mörkt.

### Typografi

Brödtext: `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`. Display: Fraunces (SIL OFL, självhostad i `web/fonts/`, en variabel fil, 66 KB, bara latin). Fraunces förekommer på fyra ställen: ordmärket, vyrubriken, rubriken i det stora elementet och siffrorna i Examen. Ingen annanstans. HIG Branding: egen font för rubriker, systemfont för brödtext.

| Stil | Typsnitt | Storlek / vikt | Används till |
|---|---|---|---|
| Large title | Fraunces | 38 / 600 | Vyns rubrik ("Idag") |
| Title 2 | Fraunces | 26 / 600 | Översta rankade raden |
| Headline | System | 17 / 600 | Radrubrik |
| Body | System | 17 / 400 | Brödtext |
| Subhead | System | 15 / 400 | Sekundär rad |
| Footnote | System | 13 / 400 | Tid, källa, förklarande fotnot. Alltid i `--label-2`. |
| Fliketikett | System | 11 / 500 | Bottenflikar. HIG-minimum på mobil är 11 pt. |

Dynamic Type respekteras genom att allt sätts i `rem` och roten följer systemet.

### Layout

Grupperade listor med 20 pt radie, 16 pt marginal, pillerformade knappar och badges. Bottenflikar: Idag, Tentor, Examen, Kopplingar. Safe areas via `env(safe-area-inset-*)`. Tryckytor minst 44 pt.

Från 900 pt bredd blir bottenflikarna ett sidofält till vänster om innehållet (HIG Layout: convertible tab bar), med ordmärket ovanför. Innehållskolumnen är högst 680 pt. Samma DOM, bara CSS.

```
┌──────────────────────────┐
│ Studiett        (serif)  │
│ Stud · i · ett           │
│                          │
│ Idag                     │  large title, Fraunces
│ ┌──────────────────────┐ │
│ │ Anmäl dig            │ │  det enda stora elementet, solgult
│ │ SF1624 stänger tors  │ │
│ │ Du är inte anmäld    │ │
│ │ ( Anmäl dig i Ladok )│ │  pillerknapp, indigo
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │ 10:15 Föreläsning    │ │
│ │ 15:00 Inlämning lab2 │ │
│ └──────────────────────┘ │
│                          │
│ Idag Tentor Examen Kopplingar │  tab bar
└──────────────────────────┘
```

Vänsterjusterat genomgående. Ingen centrering utom i tomma tillstånd.

Knappar: `.action` är den fyllda indigoknappen, en per vy. `.button-text` är indigotext med 44 pt tryckyta för sekundära handlingar som "Ta bort Ladok-data". Statusrader (`.status`) står i sekundärtext direkt under det de beskriver, i `--danger` när något gick fel. Filval går via systemets filväljare, aldrig en egen.

Formulär (Kopplingar): en etikett över varje fält, en hjälprad under, 44 pt fälthöjd, `--bg` som fältbakgrund på `--surface`, fokusring i tint. Token i lösenordsfält som aldrig förifylls (HIG Entering data). Fälttyp `url` ger rätt tangentbord. Knappen säger vad som händer: "Testa och spara", och kvittot står i statusraden under formuläret.

### Rörelse

En enda rörelse: när Idag-listan laddas glider den översta raden in. Allt annat är statiskt. `prefers-reduced-motion` stänger av den.

### Text

Meningsform, aktiv röst, inga versaler som etiketter. Knappen heter det den gör: "Anmäl dig i Ladok", inte "Gå vidare".

## Granskning

Varje UI-ändring granskas mot `.claude/skills/apple-design/references/hig/` (accessibility, color, layout, typography). Avvikelser dokumenteras i PR-texten.

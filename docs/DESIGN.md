# Design

## Vad appen är

En morgonvy för studenter. Öppnas med ena handen på väg till tunnelbanan. Den ska svara på en fråga: vad kostar mest att missa idag. Allt annat är sekundärt.

## Ett minnesvärt element

Rangordningen. Den översta raden i Idag-vyn är stor, ensam och har en förklaring i en mening ("Anmälan stänger torsdag, du är inte anmäld"). Resten av listan är tyst. Vi spenderar all djärvhet där. Ingen dekoration någon annanstans.

## Tokens

Systemfärger och systemtypsnitt, så att PWA:n ärver plattformen istället för att härma den.

### Färg

Semantiska namn. Ljust och mörkt läge via `prefers-color-scheme`.

| Token | Ljust | Mörkt | Roll |
|---|---|---|---|
| `--bg` | #F2F2F7 | #000000 | Grupperad bakgrund (iOS systemGroupedBackground) |
| `--surface` | #FFFFFF | #1C1C1E | Listceller |
| `--surface-2` | #E5E5EA | #2C2C2E | Sekundära ytor |
| `--label` | #000000 | #FFFFFF | Primär text |
| `--label-2` | rgba(60,60,67,.6) | rgba(235,235,245,.6) | Sekundär text |
| `--label-3` | rgba(60,60,67,.3) | rgba(235,235,245,.3) | Tertiär text, separatorer |
| `--tint` | #0A6C3F | #30B46E | Studiett-grönt. Den enda varumärkesfärgen. Bara för interaktiva element och "klart"-status. |
| `--danger` | #FF3B30 | #FF453A | iOS systemRed. Bara för "kostar dig en tentaomgång". |
| `--warn` | #FF9500 | #FF9F0A | iOS systemOrange. Deadline inom 48 h. |

Regel: `--tint` betyder alltid "tryckbar" eller "klart". Den används aldrig som dekoration.

### Typografi

`-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`. Ordmärket "Studiett" och uttalsraden sätts i `ui-serif, "New York", Georgia, serif`, Apples egen serif. Det är det enda stället serifen förekommer.

| Stil | Storlek / vikt | Används till |
|---|---|---|
| Large title | 34 / 700 | Vyns rubrik ("Idag") |
| Title 2 | 22 / 700 | Översta rankade raden |
| Headline | 17 / 600 | Radrubrik |
| Body | 17 / 400 | Brödtext |
| Subhead | 15 / 400 | Sekundär rad |
| Footnote | 13 / 400 | Tid, källa |

Dynamic Type respekteras genom att allt sätts i `rem` och roten följer systemet.

### Layout

Grupperade, insatta listor (inset grouped) med 10 pt radie, 16 pt marginal. Bottenflikar: Idag, Tentor, Examen. Safe areas via `env(safe-area-inset-*)`. Tryckytor minst 44 pt.

```
┌──────────────────────────┐
│ Studiett        (serif)  │
│ Stud · i · ett           │
│                          │
│ Idag                     │  large title
│ ┌──────────────────────┐ │
│ │ Anmäl dig            │ │  det enda stora elementet
│ │ SF1624 stänger tors  │ │
│ │ Du är inte anmäld    │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │ 10:15 Föreläsning    │ │
│ │ 15:00 Inlämning lab2 │ │
│ └──────────────────────┘ │
│                          │
│  Idag    Tentor   Examen │  tab bar
└──────────────────────────┘
```

Vänsterjusterat genomgående. Ingen centrering utom i tomma tillstånd.

### Rörelse

En enda rörelse: när Idag-listan laddas glider den översta raden in. Allt annat är statiskt. `prefers-reduced-motion` stänger av den.

### Text

Meningsform, aktiv röst, inga versaler som etiketter. Knappen heter det den gör: "Anmäl dig i Ladok", inte "Gå vidare".

## Granskning

Varje UI-ändring granskas mot `.claude/skills/apple-design/references/hig/` (accessibility, color, layout, typography). Avvikelser dokumenteras i PR-texten.

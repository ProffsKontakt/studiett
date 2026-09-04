# Systemkarta: svenska lärosäten och gymnasieskolor

Vilka system studenter och elever faktiskt möter, hur Studiett kan komma åt dem, och vilka av våra entiteter (`server/core/schema.md`) varje system kan mata. Research 2026-09-05 med webbkällor; osäkerheter står längst ned. En adapter per system byggs i `server/adapters/` och ska bara returnera det normaliserade schemat.

Åtkomsttyper: **(1)** öppet REST-API som studenten själv kan använda med personlig token, **(2)** iCal/ICS-prenumerationslänk, **(3)** institutions-API som kräver avtal eller API-nyckel från huvudmannen, **(4)** inget API (skrapning eller manuell export).

## 1. Universitet och högskolor

### LMS (lärplattform)

| System | Används av (belagt) | Åtkomst | Kan mata |
|---|---|---|---|
| **Canvas** | "drygt 30 svenska universitet och högskolor" [1]. Belagt: KTH [2], LU [3], GU [4], Umeå [5], LTU [6], KaU [7], HiG [8], HKR [9], FHS [10], Högskolan Dalarna (från HT24) [11], Mittuniversitetet (från HT25) [12], Uppsala (Studium = Canvas) [13], SLU [14], Borås [15]. **SU byter från Athena till Canvas HT26**; canvas.su.se öppnar i augusti, Athena fasas ut efter 2026 [16][17]. | **1** (personlig API-token under Konto → Inställningar; KTH:s eget klientbibliotek pekar på canvas.kth.se/profile/settings [18][19]) + **2** (iCal-flöde för kalendern inkl. inlämningsdatum [20]) | Course, Event (kalender), Assignment (due dates), Result (uppgiftsbetyg; formellt kursbetyg finns bara i Ladok) |
| **Moodle** | Linnéuniversitetet (moodle.lnu.se) [21]; LU Medicinska fakulteten (moodle.med.lu.se) [22]. MIUN lämnade Moodle HT25 [12]. | **2** (standard-Moodle exporterar kalender som iCal-URL) / **3** (webbtjänst-API kräver att lärosätet aktiverat det; ej verifierat per lärosäte) | Course, Event, Assignment via iCal; Result bara via API |
| **Itslearning** | I högskolesektorn i praktiken bara Marie Cederschiöld högskola [23]. FHS och KaU har lämnat för Canvas [10][24]. | **2** (kalendern har "Prenumerera"-länk i iCalendar-format [25]) / **3** (partner-API) | Event; Assignment sannolikt via kalenderposter (verifiera) |
| **Blackboard Learn** | Örebro universitet [26], Högskolan i Halmstad [27]. Uppsalas "Studium" började som Blackboard men är i dag Canvas [13][28]. | **3** (REST-API kräver registrerad app hos lärosätet) / **2** (kalender-ICS finns i Learn Ultra; ej verifierat) | Course, Event, Assignment via 3 |
| **Institutionella undantag** | **SU/DSV: Daisy** (kurser, schema, betyg, tentamensanmälan, grupprum) + **NEXTiLearn/iLearn** + SciPro [29][30]. Inget API eller iCal nämns. **LiU: Lisam** (e-post, kursrum; länkar vidare till Ladok för registrering och tentaanmälan) [31][32]; LiU har också tentabokning.liu.se [33]. | **4** | Daisy: Course, Event, Result, ExamRegistration, bara via skrapning |

### Studieadministration

| System | Används av | Åtkomst | Kan mata |
|---|---|---|---|
| **Ladok** (student.ladok.se) | Alla svenska lärosäten [34]. Studentgränssnittet: Registrering, Studieval, "Examinationstillfällen (Aktivitetstillfällen, t.ex. tentamen)", Min utbildning, Kurssidan, Intyg, Examen och bevis, Tillgodoräknande [35]. | **4** för tredje part. Ladokkonsortiet: "Andra myndigheter eller företag får inte göra en integration mot Ladok"; bara myndigheter enligt förordning 1993:1153 (CSN, UHR, SCB m.fl.) och lärosätenas egna lokala integrationer [36]. Lärosätenas interna REST-klienter finns öppet (Uppsala, KTH) men kräver lärosätescertifikat [37][38]. Studenten kan ladda ner signerade PDF-intyg [39][40]. | Course (registreringar), Result (kursbetyg/moduler), ExamRegistration (aktivitetstillfällen med anmälningsfönster), endast via PDF-intyg (vårt spår 2, byggt) eller skrapning |

### Schema

| System | Används av | Åtkomst | Kan mata |
|---|---|---|---|
| **TimeEdit** | LU [41], Umeå [42], SU [43], KaU [44], GU [45], Chalmers [46], KTH [47], SLU [48]. | **2**: "Prenumerera" i TimeEdit Viewer ger webcal/ICS-länk; rullande 4 veckor som standard, kan förlängas [41][42]. | Event (start, slut, lokal, kurskod); Course härledbart |
| **KronoX** | Borås, Gävle, Kristianstad, Högskolan Väst, Konstfack, LTU, Malmö, MDU, Södertörn, Örebro [49][50]. | **2**: "Synkronisering med externa kalendrar för lärare och studenter (ICAL)"; webcal-länk under Avancerad sök [50][51]. | Event; Course härledbart |
| **KTH Personliga menyn / "Mitt schema"** | KTH | **2**: exportlänk för Mitt schema [52] | Event |

### Tentamensanmälan

| System | Används av | Åtkomst | Kan mata |
|---|---|---|---|
| **Ladok för studenter ("Examinationstillfällen")** | Dominerande: GU [53], KTH [54], LTH [55], SU [56], MIUN [57], HV [58], Uppsala (senast 12 dagar före) [59], Umeå [60]. Typiskt öppnar anmälan 25–30 dagar före, stänger 8–10 dagar före [53][55]. | **4** (se Ladok ovan) | ExamRegistration |
| **Chalmers** | Automatisk anmälan till ordinarie tenta om man är kursregistrerad; omtenta anmäls i Ladok [61]. Äldre tjänst i Chalmers studentportal [62]. | **4** | ExamRegistration |
| **LiU tentabokning** | tentabokning.liu.se + "Dagens tentor" [33][63] | **4** | ExamRegistration |
| **DSV Daisy** | Tentamensanmälan görs i Daisy [30] | **4** | ExamRegistration |

### Studentportaler

GU Studentportalen [45], Chalmers Studentportal [62], KTH Personliga menyn [52], LiU Lisam [31], Uppsala (Studentportalen avvecklad 2019–2021 till förmån för Studium) [28]. Alla är inloggade webbgränssnitt utan studentvänt API, alltså **4**, med undantag för KTH:s schemaexport (**2**).

### E-post och kalender

| System | Används av | Åtkomst | Kan mata |
|---|---|---|---|
| **Microsoft 365 / Exchange** | SU [64], Uppsala [65], GU [66], BTH [67], MIUN [68] | **2** (publicerad Outlook-kalender som ICS) / tekniskt **1** via Microsoft Graph, men i praktiken **3** eftersom lärosätets tenant måste godkänna tredjepartsappen [69] | Event |
| **Google Workspace for Education** | Lunds universitet (studentmejl) [70] | **2** (privat iCal-adress i Google Kalender) / **1** via Calendar API, som admin kan blockera [71] | Event |

## 2. Gymnasieskolor

| System | Roll | Används av (belagt) | Kan eleven få iCal/token? | Kan mata |
|---|---|---|---|---|
| **Skola24** | Schema, frånvaro | Stockholms stad gymnasium [72][73], Linköping [74], Umeå [75], Kalmarsunds gymnasieförbund [76], Ödeshög [77], Sundbyberg [78] | **Nej officiellt.** Varken manualen eller release-noterna nämner iCal [79][80]. Tredjepartsverktyg skrapar schemavisaren [81][82]. "API Bas/Plus" (SS12000) säljs till huvudman → **3** [83]. | Event |
| **SchoolSoft** | Elevportal, schema, kalender, betyg, närvaro | AcadeMedias gymnasieskolor [84], Internationella Engelska Skolan (48 skolor, ca 31 000 elever) [85][86], Nacka [87], Rönninge gymnasium [88] | **Ja, iCal**: Elev-appen kan "exportera till och prenumerera på uppdateringar från SchoolSoft-kalendern i tredjepartskalendrar" [89]. SS12000 för huvudman → **3** [90]. | Event; Assignment om prov/inlämning ligger i kalendern (verifiera); Result nej |
| **Vklass** | Lärplattform + schema + närvaro | Sundsvall [91], Nynäshamn [92], Tyresö [93], Kungsbacka [94] | **Ja, iCal**: "Schemaprenumerationen ges i iCalendar (ics) format", 5 dagar bakåt/31 framåt [95]. SS12000 för elever/klasser/schema, ej betyg/närvaro → **3** [96]. Hämtar lektioner från Skola24 [97]. | Event; Course (grupper) |
| **Unikum** | Bedömning, uppgifter, betyg, närvaro | Malmö stad gymnasium [98], Partille [99]; egen uppgift "100+ kommuner" [100][101] | **Nej** (ingen iCal funnen). Unikum Connect API för huvudman → **3** [102]. | Assignment, Result bara via 3 |
| **InfoMentor** | Kommunikation, kalender, omdömen | Stockholms stad gymnasium (sedan aug 2024) [72][73], Vänersborg [103], Solna [104] | **Nej**: Hub-appen har push men ingen iCal eller API [105] → **4** | Event, Assignment bara via skrapning |
| **Edlevo (Tieto)** | Elevregister, betyg, studieplan, frånvaro | Stockholms stad gymnasium [72][73], Malmö stad gymnasium [98], Ulricehamn [106], Svalöv [107] | **Nej** för elev. REST-API med nycklar som beställs från Tieto → **3** [108] | Course (studieplan), Result (betyg), Event bara via 3 |
| **IST** | Elevregister, IST Lärande | Linköping [109], Uppsala kommun [110], Ödeshög [77], GGVV-kommunerna [111] | **Nej** för elev. EduCloud med SS12000:2020 och OneRoster → **3** [112][113] | Course, Result via 3 |
| **Admentum** | Administrationssystem + elevapp | Amerikanska Gymnasiet, Europaskolan Strängnäs [114]; Skolon-integration [115] | **Nej** dokumenterat → **4** (SS12000 mot Skolon tyder på **3**) | Event, Result via 3 |
| **Haldor** | Lärplattform inuti Microsoft Teams | Vadsbogymnasiet [116], Lysekil [117], Älvdalen [118] | Data i Microsoft Graph education-API; skol-IT-admin måste ge consent → **3** [69] | Course, Assignment, Result |
| **Microsoft Teams for Education** | Samarbete, uppgifter | Stockholms stad gymnasium [73], via Haldor | Som Haldor → **3** [69] | Course, Assignment, Result |
| **Google Classroom / Workspace** | Lärplattform | Malmö stad ("MaApps") [119], Göteborgs stad [120], Falun [121][122] | Classroom API: courses, courseWork, studentSubmissions via OAuth [123]. Admin kan blockera tredjepartsappar; för användare under 18 är appar blockerade som standard → i praktiken **3** [71]. Google Kalender-iCal → **2**. | Course, Assignment, Result; Event via kalender |
| **Itslearning** | Lärplattform/elevportal | Marks kommun [124], Laholm [125], Eskilstuna [126], Örebro kommun [127] | **Ja, iCal** (kalender → Prenumerera) [25] → **2**; partner-API → **3** | Event; Assignment sannolikt via kalender (verifiera) |
| **Canvas** | Lärplattform | Realgymnasiet [128] | Som i högskolan → **1 + 2** | Course, Event, Assignment, Result |

**SS 12000:2020** (SIS, licens betald av Skolverket) täcker elevregister, betyg, schema, närvaro och rekommenderas av Skolverket som krav i upphandlingar [129][130][131]. Det är ett huvudman-till-leverantör-API, aldrig ett elev-API. Alla gymnasiesystem som anger SS12000 hamnar därför i typ 3 för Studiett.

**Rättsligt för minderåriga.** Huvudmannen är personuppgiftsansvarig för elevdata; skolan kan normalt inte använda samtycke som rättslig grund på grund av maktobalansen, och leverantörer kräver personuppgiftsbiträdesavtal [132][133]. Studiett kan alltså inte få ut data ur skolans system (typ 3) utan avtal med huvudmannen. Om eleven själv matar in en iCal-länk eller ger OAuth-samtycke är Studiett egen personuppgiftsansvarig; för barn under 13 år krävs vårdnadshavarens samtycke [134], och Google/Microsoft-tenanter blockerar som regel tredjepartsappar för användare under 18 [71]. Slutsats: gymnasiet är ett avtalsspår, inte ett studentspår. Det bekräftar DECISIONS §1.

## 3. Mappningstabell

| System | Course | Event | Assignment | Result | ExamRegistration | Åtkomst |
|---|---|---|---|---|---|---|
| Canvas | ja via REST | ja via REST/iCal | ja via REST/iCal | ja via REST (uppgiftsbetyg) | nej | 1 (+2) |
| Moodle | ja via iCal/API | ja via iCal | ja via iCal | ja via API | nej | 2 (+3) |
| Itslearning | ja via iCal | ja via iCal | trolig via iCal | nej | nej | 2 (+3) |
| Blackboard Learn | ja via API | ja via API/ICS | ja via API | ja via API | nej | 3 |
| Ladok | ja via PDF-intyg | nej | nej | ja via PDF-intyg | ja via skrapning | 4 |
| TimeEdit | härledd via iCal | ja via iCal | nej | nej | nej | 2 |
| KronoX | härledd via iCal | ja via iCal | nej | nej | nej | 2 |
| Daisy (DSV) | ja via skrapning | ja via skrapning | nej | ja via skrapning | ja via skrapning | 4 |
| Lisam / studentportaler | nej | KTH: ja via iCal | nej | nej | nej | 4 (KTH 2) |
| Microsoft 365/Exchange | nej | ja via ICS/Graph | nej | nej | nej | 2 / 3 |
| Google Workspace (kalender) | nej | ja via iCal | nej | nej | nej | 2 |
| Skola24 | nej | ja via inofficiell skrapning / huvudman-API | nej | nej | nej | 3 / 4 |
| SchoolSoft | härledd via iCal | ja via iCal | trolig via iCal | nej | nej | 2 (+3) |
| Vklass | härledd via iCal | ja via iCal | nej | nej | nej | 2 (+3) |
| Unikum | ja via huvudman-API | nej | ja via huvudman-API | ja via huvudman-API | nej | 3 |
| InfoMentor | nej | nej | nej | nej | nej | 4 |
| Edlevo | ja via huvudman-API | ja via huvudman-API | nej | ja via huvudman-API | nej | 3 |
| IST | ja via SS12000 | nej | nej | ja via SS12000 | nej | 3 |
| Admentum | nej | nej | nej | nej | nej | 4 (3 mot Skolon) |
| Haldor / Teams for Education | ja via Graph | nej | ja via Graph | ja via Graph | nej | 3 |
| Google Classroom | ja via OAuth | via Google Kalender iCal | ja via OAuth | ja via OAuth | nej | 3 (1 om admin tillåter) |

## 4. Prioritering: fem system med störst täckning per integrationskrona

1. **Canvas**: drygt 30 lärosäten plus SU från HT26, studenten skapar token själv, och det är det enda systemet som ger Assignment och Result utan avtal [1][16][18][20]. Adapter finns (`server/adapters/canvas.js`), otestad mot riktig token.
2. **TimeEdit**: iCal-länk som studenten hämtar själv, används av de största lärosätena (LU, UU, GU, Chalmers, KTH, SU, Umeå) och ger Event komplett [41][42][47]. Adapter finns.
3. **Ladok**: täcker 100 % av studenterna och är enda källan till Result på kursnivå och ExamRegistration, men bara via PDF-intyg eller skrapning [35][36][39]. Intygsläsning finns (DECISIONS §9); anmälningsfönster saknas fortfarande.
4. **KronoX**: samma iCal-mönster som TimeEdit, tio lärosäten inklusive Malmö, Örebro, LTU, MDU, Södertörn; nästan noll extra kostnad ovanpå TimeEdit-adaptern [49][50]. Nästa adapter att bygga: samma parser, annan URL-validering.
5. **SchoolSoft (iCal)**: enda gymnasiesystemet med både officiell elev-iCal och de största fristående kedjorna (AcadeMedia, IES); Vklass är nära tvåa med samma mekanism, medan Skola24 (störst på schema) saknar officiellt elevflöde och kräver skrapning eller huvudmansavtal [84][86][89][95][79]. Byggs inte förrän gymnasiet är ett beslut.

## 5. Osäkerheter att verifiera innan adapterbygge

- Moodle- och Blackboard-raderna bygger på generisk produktfunktionalitet, inte på svenska lärosätessidor.
- Att Itslearning- och SchoolSoft-kalendrarna innehåller inlämningsdeadlines är inte bekräftat.
- Chalmers verkar ha flyttat tentaanmälan till Ladok (automatisk ordinarie anmälan) men den äldre studentportaltjänsten refereras fortfarande.
- LiU:s tentabokning.liu.se existerar parallellt med Ladok-hänvisningen i Lisam-FAQ.

## 6. Källor

1. https://www.su.se/enheter/centrum-for-barnkulturforskning/nyheter/nyhetsartiklar/2026-05-19-canvas-ersatter-athena-som-ny-larplattform-ht26
2. https://kth.se/student/it/learning-platforms/canvas-1.784659
3. https://www.education.lu.se/digitala-verktyg/canvas
4. https://studentportal.gu.se/en/digital-tools/canvas
5. https://www.umu.se/en/student/help-and-support/it-services/software-and-services/canvas/
6. https://www.ltu.se/en/student-web/your-studies/canvas---learning-platform-with-your-course-rooms
7. https://www.kau.se/student/ar-student/it-stod/tjanster/canvas
8. https://www.hig.se/engelska/university-of-gavle/student/during-your-studies/services-and-systems/snabbguider/lc-guider/canvas
9. https://www.hkr.se/student/studierna/canvas-din-larplattform/
10. https://www.fhs.se/en/student-web/all-about-your-studies/my-studies/digital-tools-and-services/canvas-lms.html
11. https://www.du.se/sv/studentwebb/studentnyheter/bra-att-veta-om-larplattformen-canvas/
12. https://www.miun.se/medarbetare/undervisning/stod-for-pedagogisk-utveckling/larplattform/larplattformen-moodle/
13. https://www.uu.se/en/students/it-for-students/services-for-students/studium
14. https://www.slu.se/studentwebb/studier/verktyg-och-system-for-studier/canvas-larplattform/
15. https://www.hb.se/student/mina-studier/webb-och-mobiltjanster/canvas/
16. https://www.su.se/nyheter/nyhetsartiklar/2026-06-08-i-host-kommer-canvas
17. https://medarbetare.su.se/en/our-su/organisation/current-projects/transition-to-canvas-as-the-new-learning-platform-2026
18. https://github.com/KTH/canvas-api
19. https://community.instructure.com/t5/Svenksa-Studerande-Guide/Hur-hanterar-jag-API-%C3%A5tkomsttokens-i-mitt-anv%C3%A4ndarkonto/ta-p/441522
20. https://community.instructure.com/sv/kb/articles/662804-hur-visar-jag-kalenderns-ical-floede-foer-att-importera-och-prenumerera-pa-en-extern-kalender
21. https://www.lnu.se/en/medarbetare/support-and-service/learning-platform/
22. https://moodle.med.lu.se/mod/book/tool/print/index.php?id=36161
23. https://www.student.esh.se/stod-och-service/it-stod/larplattform-itslearning.html
24. https://studenttidning.se/campus/ny-larplattform-i-host-1339
25. https://help.itslearning.com/help/sv-SE/Content/Calendar/calendar.htm
26. https://www.oru.se/utbildning/jag-ar-student/mina-studier/it-tjanster/programvaror/blackboard-for-studenter/
27. https://www.hh.se/student-web/content-a-z/blackboard-learning-platform.html
28. https://mp.uu.se/web/info/vart-uu/projekt/ny-larplattform
29. https://www.su.se/english/divisions/department-of-computer-and-systems-sciences/education/new-student
30. https://www.su.se/english/divisions/department-of-computer-and-systems-sciences/education/it-services-at-dsv
31. https://liu.se/artikel/faq-registrering
32. https://liu.se/en/article/checklistor
33. https://tentabokning.liu.se/www4_index.html
34. https://en.wikipedia.org/wiki/Ladok
35. https://ladokkonsortiet.se/wp-content/uploads/2021/02/Lathund_Ladok-for-studenter.pdf
36. https://ladokkonsortiet.se/vara-tjanster/systemet-ladok/integrationer-mot-ladok
37. https://github.com/uppsala-university/ati-ladok3-rest-client
38. https://github.com/KTH/ladok-api
39. https://www.lu.se/student/it-tjanster-och-studentsupport/ladok-studenter
40. https://ladokkonsortiet.se/wp-content/uploads/2019/08/Guide_Ladok-Intyg-i-Ladok.pdf
41. https://www.srs.lu.se/lathundar/timeedit-viewer-schemageneratorn/att-prenumerera-pa-ett-schema-fran-timeedit-viewer/
42. https://manual.umu.se/en/subscribe-to-a-timeedit-schedule/
43. https://medarbetare.su.se/download/18.4690f37d18f240eec86433f0/1729866357367/Schema_lathund_prenumerera.pdf
44. https://www5.kau.se/sites/default/files/Dokument/subpage/2012/03/snabbguide_timeedit_3_ical_prenumeration_v1_1_11922.pdf
45. https://studentportal.gu.se/en/digital-tools/timeedit
46. https://www.chalmers.se/utbildning/dina-studier/planera-och-genomfora-studier/schema-och-boka-grupprum/
47. https://www.kth.se/student/studier/schema/sok-schema-1.2214
48. https://www.slu.se/studentwebb/studier/verktyg-och-system-for-studier/timeedit/
49. https://kronox.se/app/larosaten.php
50. https://kronox.se/
51. https://www.hb.se/student/mina-studier/webb-och-mobiltjanster/kronoxschema/
52. https://www.kth.se/student/it/studenttjanster/personligamenyn/koppla-mitt-schema
53. https://studentportal.gu.se/minastudier/sprak/tentamen/anmalan-till-tentamen
54. https://www.kth.se/student/studier/kurs/tentamen/examination-1.324344
55. https://www.student.lth.se/mina-studier/tentamen/
56. https://www.su.se/utbildning/studera-vid-universitetet/tentamen
57. https://www.miun.se/tentamensanmalan
58. https://www.hv.se/student/studier/examination/Tentamen/
59. https://www.uu.se/student/institution/kulturgeografiska/infor-och-efter-tentamen
60. https://www.umu.se/en/student/your-studies/examinations-and-assessments/sign-up-for-an-exam/
61. https://www.chalmers.se/utbildning/dina-studier/planera-och-genomfora-studier/tentamen-och-ovrig-examination/fore-examination/
62. https://student.portal.chalmers.se/sv/chalmersstudier/tentamen/Sidor/sa-anmaler-du-dig.aspx
63. https://liu.se/student/dagens-tentor/
64. https://www.su.se/english/education/it-for-students/digital-tools-and-services/office-365-for-students
65. https://www.uu.se/en/students/it-for-students/microsoft-365-education
66. https://studentportal.gu.se/en/digital-tools/email-and-microsoft-365
67. https://www.bth.se/english/student/during-your-studies/it-tools/email-and-microsoft-365
68. https://www.miun.se/en/student/service-and-support/it-services/Office-365/
69. https://learn.microsoft.com/en-us/graph/api/resources/education-overview
70. https://www.lu.se/student/it-tjanster-och-studentsupport/studentmejl
71. https://knowledge.workspace.google.com/admin/apps/control-which-apps-access-google-workspace-data?hl=sv
72. https://via.tt.se/pressmeddelande/3569683/nya-appar-for-vardnadshavare-med-barn-i-stockholms-stads-skolor?publisherId=1213538&lang=sv
73. https://pedagog.stockholm/kompetensutveckling/verktyg-resurser/infomentor-edlevo-och-skola24-i-gymnasieskolan/
74. https://www.linkoping.se/forskola-och-utbildning/inloggning-elever/skola24-for-elever
75. https://sites.google.com/edu.umea.se/eduit/digitala-l%C3%A4rresurser/digitala-l%C3%A4rresurser-i-gragr/skola24-fr%C3%A5nvaro-och-schema
76. https://gyf.se/elevinformation/skola24---schema
77. https://www.odeshog.se/forskolaskolaochutbildning/elevsystemistadministrationochskola24.4.79e8407e19931eacce044934.html
78. https://sites.google.com/utb.sundbyberg.se/pedagogsundbyberg/digitala-l%C3%A4rresurser/skola/skola24-schema
79. https://www.skola24.com/support/schema/manualer/schemavisning/
80. https://www.skola24.com/support/plattformen/uppdateringar-skola24-schema/
81. https://github.com/thuma/skola24-to-ics
82. https://schedule-app.cloud.mustini.com/
83. https://www.skola24.com/produkter/plattformen/
84. https://medarbetare.academedia.se/gymnasieskola/schoolsoft/schoolsoft-for-elever/
85. https://engelska.se/sv/
86. https://en.wikipedia.org/wiki/Internationella_Engelska_Skolan
87. https://www.nacka.se/valfard-skola/nackas-kommunala-skolor/digitalaresursersystem/schoolsoft/
88. http://www.ronningegymnasium.se/wp-content/uploads/2020/09/SchoolSoft_for_vardnadshavare.pdf
89. https://apps.apple.com/se/app/schoolsoft-elev/id6447290050
90. https://support.skolon.com/sv/kb/articles/schoolsoft
91. https://sundsvall.se/kommun/utbildning-och-forskola/vklass/vklass-for-grundskola-och-gymnasium
92. https://nynashamn.se/service/forskola--skola/grundskola/vklass
93. https://www.tyreso.se/forskola--skola/skolbarn/larplattformen-vklass.html
94. https://skolenhet5.kodlabb.se/vklass/
95. https://support.vklass.se/knowledge-base/schema-lektionsschema-i-vklass/
96. https://support.vklass.se/knowledge-base/standarden-ss12000/
97. https://support.vklass.se/knowledge-base/synkronisering-med-skola24-schema-novaschem/
98. https://malmo.se/Bo-och-leva/Utbildning-och-forskola/Gymnasieskola/For-elever-och-vardnadshavare-i-gymnasieskolan/Plattformar-for-narvarohantering-studieplan-och-betyg.html
99. https://www.partillegymnasium.se/elevportal/
100. https://www.unikum.net/kommun/
101. https://www.unikum.net/
102. https://www.unikum.net/kommun/systempusslet-kombinera-moderna-verktyg/
103. https://vanersborg.se/utbildning-och-barnomsorg/infomentor---larplattform
104. https://www.solna.se/barn--utbildning/grundskola/infomentor
105. https://www.infomentor.se/infomentor-hub/
106. https://www.ulricehamn.se/barn-och-utbildning/appar-och-e-tjanster-i-forskola-och-skola/edlevo-nytt-gemensamt-skolsystem
107. https://www.svalov.se/utbildning--barnomsorg/grundskola--anpassad-grundskola/edlevo---grundskolans-skolplattform
108. https://support.skolon.com/sv/kb/articles/edlevo
109. https://www.linkoping.se/forskola-och-utbildning/inloggning-elever/ist-administration-e-tjanstesida/
110. https://utforareskola.uppsala.se/skolformer/grundskola/ansokan-och-placering-for-fristaende-skolor-utanfor-skolvalsperioden/
111. https://www.ist.com/sv/artiklar/ist-vann-upphandlingen
112. https://www.ist.com/en/integrations
113. https://api.ist.com/ss12000v2-api/
114. https://www.admentum.se/gymnasiet/
115. https://skolon.com/sv/admentum-och-skolon-i-samarbete/
116. https://haldor.se/vadsbogymnasiet-vill-oka-elevernas-maluppfyllelse-valjer-haldor/
117. https://haldor.se/lysekil-kommun-valjer-haldor-for-alla-skolformer/
118. https://haldor.se/pa-besok-i-dalafjallen/
119. https://sites.google.com/skola.malmo.se/gsuiteguide/maapps
120. https://sites.google.com/grundskola.goteborg.se/diginn/plattformar/google
121. https://www.falun.se/utbildning--barnomsorg/gymnasium/kommunala-gymnasieskolor/lugnetgymnasiet/vart-larande/google-larplattform.html
122. https://www.falun.se/utbildning--barnomsorg/gymnasium/kommunala-gymnasieskolor/kristinegymnasiet/vart-larande/google-for-education.html
123. https://developers.google.com/workspace/classroom/reference/rest
124. https://etjanster.mark.se/oversikt/overview/51
125. https://e-tjanster.laholm.se/oversikt/overview/961
126. https://zetterberg.eskilstuna.se/zetterbergsgymnasiet/for-elever-och-vardnadshavare/larplattformen-itslearning
127. https://orebro.se/barn--utbildning/gymnasieskola--anpassad-gymnasieskola/digitalt-larande-i-gymnasieskolan.html
128. https://www.realgymnasiet.se/om-oss/nyheter/2020-07-02-13-01-07
129. https://www.skolverket.se/om-skolverket/det-har-gor-skolverket/instruktion-och-uppdrag/sektorsansvar-for-skolvasendets-digitalisering/ss-12000---en-teknisk-standard-for-informationsutbyte-i-skolan
130. https://www.sis.se/en/produkter/information-technology-office-machines/applications-of-information-technology/it-applications-in-education/ss-120002020/
131. https://github.com/skolverket/dnp-ss12000-reference-api
132. https://www.imy.se/verksamhet/dataskydd/dataskydd-pa-olika-omraden/skola-och-forskola/digital-undervisning/
133. https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/rattslig-grund/samtycke/
134. https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/introduktion-till-gdpr/personuppgifter/personuppgifter-om-barn/

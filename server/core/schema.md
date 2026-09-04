# Normaliserat schema

Allt adaptrarna returnerar. Inga källspecifika fält utanför `raw`.

```ts
type Source = "ladok" | "canvas" | "timeedit" | "athena" | "daisy" | "ilearn" | "manual";

interface Course {
  source?: Source;       // saknas = Ladok-härledd (intyg, mock)
  code: string;          // "SF1624"
  name: string;          // "Algebra och geometri"
  hp: number;            // 7.5
  term: string;          // "HT26"
  status: "registered" | "completed" | "rest";   // rest = påbörjad, ej klar
  modules?: Module[];
}

interface Module {
  code: string;          // "TEN1"
  name: string;
  hp: number;
  passed: boolean;
  grade?: string;
  date?: string;         // ISO
}

interface Event {         // schemalagt, har start och slut
  id: string;
  source: Source;
  course?: string;       // kurskod
  type: "lecture" | "exercise" | "lab" | "seminar" | "exam" | "other";
  title: string;
  start: string;         // ISO
  end: string;           // ISO
  location?: string;
  mandatory?: boolean;
  url?: string;
}

interface Assignment {    // har deadline, inte start
  id: string;
  source: Source;
  course: string;
  title: string;
  due: string;           // ISO
  submitted: boolean;
  graded: boolean;       // påverkar betyg/poäng
  hp?: number;           // om momentet ger hp
  url?: string;
}

interface ExamRegistration {
  course: string;
  module: string;        // "TEN1"
  examDate: string;      // ISO
  registrationOpens: string;
  registrationCloses: string;
  registered: boolean;
  url?: string;          // djuplänk till anmälan
}

interface Program {
  name: string;          // "Civilingenjör Maskinteknik"
  totalHp: number;       // 300
  startTerm: string;     // "HT24"
  nominalTerms: number;  // 10
}

interface NormalizedBundle {
  fetchedAt: string;
  student: { id: string; name: string; institution: string };
  program?: Program;
  courses: Course[];
  events: Event[];
  assignments: Assignment[];
  examRegistrations: ExamRegistration[];
}
```

// Ladok adapter. DET FINNS INGET OFFICIELLT STUDENT-API.
//
// Detta är projektets största tekniska och juridiska risk. Se docs/DECISIONS.md §3.
//
// Spår 1 (nu): studentens egen session mot ladok.se, proxad via oss.
//   Steg: logga in på https://www.student.ladok.se i Safari, öppna nätverksfliken,
//   och kartlägg de JSON-anrop som sidan gör för
//     - kursregistreringar (aktuella kurser)
//     - resultat per modul
//     - tentatillfällen och anmälningsfönster ("Anmäl till tenta")
//   Dokumentera endpoints här allteftersom. Förvänta er att de ändras utan förvarning.
//
// Spår 2: parsning av resultatintyg (PDF) som studenten laddar ner.
// Spår 3: avtal med Ladokkonsortiet / lärosätet. Det enda som skalar.

export async function fetchAll(/* { sessionCookie } */) {
  throw new Error("Ladok-adaptern är inte implementerad. Kör med mockdata (STUDENT=viktor|julian).");
}

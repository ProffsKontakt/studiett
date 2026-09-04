// Ladok adapter. DET FINNS INGET OFFICIELLT STUDENT-API. Se docs/DECISIONS.md §3 och §9.
//
// Spår 2 (byggt här): studenten laddar ner sina intyg i Ladok för studenter
// (Intyg → Resultatintyg / Registreringsintyg) och laddar upp PDF:erna. En modell
// läser PDF:en och returnerar rader enligt ett strikt JSON-schema. Status (klar,
// registrerad, rest) räknas sedan ut deterministiskt här, aldrig av modellen.
//
// Ett resultatintyg visar bara godkända resultat. Rester går därför inte att se i det
// ensamt; de faller ut när ett registreringsintyg läggs ovanpå: registrerad på kursen
// men inte alla moduler godkända.
//
// Tentaanmälan (anmälningsperioder, tillfällen) finns inte i något intyg. Det är spår 1.
//
// Spår 1: studentens egen session mot ladok.se, proxad via oss. Inte byggt.
// Spår 3: avtal med Ladokkonsortiet / lärosätet. Det enda som skalar.

export const MODEL = "claude-opus-5";

// Schemat modellen måste följa. Bara råa rader från intyget; ingen tolkning av status.
// Strukturerade svar kräver additionalProperties: false på alla objekt och inga min/max.
export const INTYG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "language", "issuedAt", "institution", "program", "courses", "warnings"],
  properties: {
    kind: { type: "string", enum: ["resultatintyg", "nationellt_resultatintyg", "registreringsintyg", "forvantat_deltagande", "annat"] },
    language: { type: "string", enum: ["sv", "en", "annat"] },
    issuedAt: { type: ["string", "null"], description: "Datum intyget skapades, ISO YYYY-MM-DD, annars null" },
    institution: { type: ["string", "null"], description: "Lärosätets namn som det står i intyget" },
    program: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["name", "hp", "startTerm"],
      properties: {
        name: { type: "string", description: "Programmets namn, t.ex. Civilingenjörsutbildning i maskinteknik" },
        hp: { type: ["number", "null"], description: "Programmets omfattning i hp, t.ex. 300" },
        startTerm: { type: ["string", "null"], description: "Första registrerade termin som HT24 eller VT25, annars null" },
      },
    },
    courses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "name", "hp", "term", "listedAs", "courseResult", "modules"],
        properties: {
          code: { type: "string", description: "Kurskod exakt som i intyget, t.ex. SF1624" },
          name: { type: "string" },
          hp: { type: ["number", "null"], description: "Kursens omfattning i hp" },
          term: { type: ["string", "null"], description: "Termin som HT26 eller VT26 om den går att läsa ut, annars null" },
          listedAs: { type: "string", enum: ["result", "registration", "expected"], description: "result = raden står under resultat; registration = raden står under registreringar; expected = förväntat deltagande" },
          courseResult: {
            type: ["object", "null"],
            additionalProperties: false,
            required: ["grade", "date"],
            description: "Resultat på hela kursen om en sådan rad finns, annars null",
            properties: {
              grade: { type: ["string", "null"] },
              date: { type: ["string", "null"], description: "ISO YYYY-MM-DD" },
            },
          },
          modules: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["code", "name", "hp", "grade", "date"],
              properties: {
                code: { type: "string", description: "Modulkod, t.ex. TEN1, LAB1, PRO1" },
                name: { type: "string" },
                hp: { type: ["number", "null"] },
                grade: { type: ["string", "null"] },
                date: { type: ["string", "null"], description: "ISO YYYY-MM-DD" },
              },
            },
          },
        },
      },
    },
    warnings: { type: "array", items: { type: "string" }, description: "Sådant som inte gick att läsa säkert, på svenska" },
  },
};

const SYSTEM = `Du läser intyg från Ladok, det svenska studiedokumentationssystemet, och skriver av dem exakt till JSON enligt schemat.

Regler:
- Skriv av. Tolka inte. Räkna inte ut status. Gissa inte värden som saknas; använd null och lägg en varning.
- Kurskoder ser ut som SF1624, DD1318, IB513C. Modulkoder ser ut som TEN1, LAB1, PRO1, INL1.
- I ett resultatintyg står moduler indragna under sin kurs. En rad för hela kursen med betyg och datum betyder att kursen är klar; sätt då courseResult. Moduler utan kursrad betyder att bara delar är godkända; courseResult är då null.
- Ett resultatintyg visar bara godkända resultat. Underkända betyg förekommer inte där.
- I ett registreringsintyg står kurser som studenten är registrerad på, oftast med termin eller datumperiod, och ofta ett program ("kurspaketering") med omfattning i hp. Sätt listedAs till "registration".
- Termin: juli till december är HT, januari till juni är VT, med tvåsiffrigt år: HT26, VT26.
- Omfattning anges i hp (högskolepoäng). Skriv talet, t.ex. 7.5.
- Intyget kan vara på svenska eller engelska. Fältnamnen i JSON är alltid desamma.
- Personnummer och kontrollkod ska inte med.`;

// Anropar modellen. client injiceras så att adaptern kan testas utan nyckel.
export async function extractIntyg(pdfBase64, { client, model = MODEL } = {}) {
  if (!client) throw new Error("extractIntyg: client saknas");
  const res = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { effort: "medium", format: { type: "json_schema", schema: INTYG_SCHEMA } },
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 }, title: "Ladok-intyg" },
        { type: "text", text: "Skriv av intyget till JSON enligt schemat." },
      ],
    }],
  });
  if (res.stop_reason === "refusal") throw new Error("Modellen avböjde att läsa dokumentet.");
  if (res.stop_reason === "max_tokens") throw new Error("Intyget är för långt för ett svar. Skapa ett intyg avgränsat till färre terminer.");
  if (!res.parsed_output) throw new Error("Modellen svarade inte enligt schemat.");
  return res.parsed_output;
}

// Rå avskrift -> Ladok-del av NormalizedBundle (program, courses). Deterministiskt.
export function normalizeIntyg(raw) {
  const warnings = [...(raw.warnings ?? [])];
  const courses = [];
  for (const c of raw.courses ?? []) {
    const code = (c.code ?? "").trim().toUpperCase();
    if (!code) { warnings.push(`Kurs utan kod hoppades över: ${c.name ?? "?"}`); continue; }
    const modules = (c.modules ?? []).map(m => ({
      code: (m.code ?? "").trim().toUpperCase(),
      name: m.name ?? "",
      hp: Number(m.hp ?? 0),
      passed: Boolean(m.grade) && !isFail(m.grade),
      grade: m.grade ?? undefined,
      date: m.date ?? undefined,
    }));
    const completed = Boolean(c.courseResult?.grade) && !isFail(c.courseResult.grade);
    const hp = Number(c.hp ?? 0) || modules.reduce((s, m) => s + m.hp, 0);
    let status;
    if (completed) status = "completed";
    else if (c.listedAs === "registration" || c.listedAs === "expected") status = "registered";
    else status = "rest";
    // En klar kurs utan modulrader: en modul som bär hela kursen, så att degree() kan räkna.
    if (completed && modules.length === 0) modules.push({ code: "KURS", name: c.name ?? "", hp, passed: true, grade: c.courseResult.grade ?? undefined, date: c.courseResult.date ?? undefined });
    if (completed) for (const m of modules) m.passed = true;
    courses.push({ code, name: c.name ?? "", hp, term: c.term ?? "", status, modules });
  }
  let program;
  if (raw.program?.name) {
    const totalHp = Number(raw.program.hp ?? 0);
    if (!totalHp) warnings.push("Programmets omfattning saknas i intyget; examensprognosen kan inte räknas.");
    program = { name: raw.program.name, totalHp, startTerm: raw.program.startTerm ?? "", nominalTerms: totalHp ? Math.round(totalHp / 30) : 0 };
  }
  return { kind: raw.kind, issuedAt: raw.issuedAt ?? null, institution: raw.institution ?? null, program, courses, warnings };
}

function isFail(grade) {
  return /^(F|U|FX|underkänd|fail)$/i.test(String(grade).trim());
}

// Lägger ett nytt intyg ovanpå tidigare importerade. Kurser slås ihop per kod.
// completed vinner över registered som vinner över rest. Modulers passed OR:as.
export function mergeLadok(existing, incoming) {
  const byCode = new Map();
  for (const c of [...(existing?.courses ?? []), ...(incoming.courses ?? [])]) {
    const prev = byCode.get(c.code);
    if (!prev) { byCode.set(c.code, { ...c, modules: c.modules.map(m => ({ ...m })) }); continue; }
    const mods = new Map(prev.modules.map(m => [m.code, m]));
    for (const m of c.modules) {
      const pm = mods.get(m.code);
      if (!pm) mods.set(m.code, { ...m });
      else Object.assign(pm, { passed: pm.passed || m.passed, grade: m.grade ?? pm.grade, date: m.date ?? pm.date, hp: m.hp || pm.hp, name: m.name || pm.name });
    }
    const rank = { completed: 3, registered: 2, rest: 1 };
    byCode.set(c.code, {
      code: c.code,
      name: c.name || prev.name,
      hp: c.hp || prev.hp,
      term: c.term || prev.term,
      status: rank[c.status] >= rank[prev.status] ? c.status : prev.status,
      modules: [...mods.values()],
    });
  }
  const program = pick(incoming.program, existing?.program);
  const intyg = [...(existing?.intyg ?? []), ...(incoming.intyg ?? [])];
  return { program, courses: [...byCode.values()], examRegistrations: existing?.examRegistrations ?? [], intyg };
}

function pick(a, b) {
  if (!a) return b;
  if (!b) return a;
  return { name: a.name || b.name, totalHp: a.totalHp || b.totalHp, startTerm: a.startTerm || b.startTerm, nominalTerms: a.nominalTerms || b.nominalTerms };
}

export async function fetchAll(/* { sessionCookie } */) {
  throw new Error("Ladok-adaptern har ingen sessionskoppling (spår 1). Använd intyg-import eller LADOK_MOCK.");
}

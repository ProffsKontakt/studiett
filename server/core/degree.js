// Examensprojektion. Samma siffra lärosätet kallar genomströmning.
const HP_PER_TERM_NOMINAL = 30;

function termIndex(term) {
  // "HT24" -> 2024.5, "VT25" -> 2025.0 ; en term = 0.5
  const season = term.slice(0, 2), year = 2000 + Number(term.slice(2));
  return year + (season === "HT" ? 0.5 : 0);
}
function termLabel(idx) {
  const year = Math.floor(idx), ht = idx - year >= 0.5;
  return `${ht ? "HT" : "VT"}${String(year).slice(2)}`;
}

export function degree(bundle, now = new Date()) {
  const p = bundle.program;
  if (!p) return null;

  const completedHp = bundle.courses
    .flatMap(c => c.modules ?? [{ hp: c.hp, passed: c.status === "completed" }])
    .filter(m => m.passed)
    .reduce((s, m) => s + m.hp, 0);

  const rests = bundle.courses
    .filter(c => c.status === "rest")
    .map(c => ({
      code: c.code,
      name: c.name,
      missing: (c.modules ?? []).filter(m => !m.passed),
      nextChance: bundle.examRegistrations
        .filter(r => r.course === c.code && new Date(r.examDate) > now)
        .sort((a, b) => new Date(a.examDate) - new Date(b.examDate))[0] ?? null,
    }));

  const start = termIndex(p.startTerm);
  const currentTerm = now.getMonth() >= 7 ? now.getFullYear() + 0.5 : now.getFullYear();
  const termsElapsed = Math.max(1, Math.round((currentTerm - start) / 0.5));
  const pace = completedHp / termsElapsed;                 // hp per term hittills
  const remaining = p.totalHp - completedHp;
  const termsLeftAtPace = pace > 0 ? Math.ceil(remaining / pace) : Infinity;
  const nominalFinish = start + (p.nominalTerms - 1) * 0.5;
  const projectedFinish = currentTerm + (termsLeftAtPace - 1) * 0.5;

  return {
    program: p.name,
    completedHp,
    totalHp: p.totalHp,
    percent: Math.round((completedHp / p.totalHp) * 100),
    pace: Math.round(pace * 10) / 10,
    nominalPace: HP_PER_TERM_NOMINAL,
    nominalFinish: termLabel(nominalFinish),
    projectedFinish: Number.isFinite(projectedFinish) ? termLabel(projectedFinish) : null,
    onTime: projectedFinish <= nominalFinish,
    termsBehind: Math.max(0, Math.round((projectedFinish - nominalFinish) / 0.5)),
    rests,
  };
}

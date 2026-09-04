// Tentaanmälan: matchar registrerade kurser mot anmälningsfönster.
const DAY = 86400 * 1000;

export function examStatus(bundle, now = new Date()) {
  const registeredCourses = new Set(bundle.courses.filter(c => c.status !== "completed").map(c => c.code));
  const upcoming = bundle.examRegistrations
    .filter(r => registeredCourses.has(r.course) && new Date(r.examDate) > now)
    .map(r => {
      const closes = new Date(r.registrationCloses);
      const opens = new Date(r.registrationOpens);
      const daysToClose = Math.ceil((closes - now) / DAY);
      let state;
      if (r.registered) state = "registered";
      else if (now < opens) state = "not_open";
      else if (now <= closes) state = "open";
      else state = "missed";
      return { ...r, state, daysToClose, alert: state === "open" && daysToClose <= 7 };
    })
    .sort((a, b) => new Date(a.examDate) - new Date(b.examDate));

  return {
    alerts: upcoming.filter(u => u.alert || u.state === "missed"),
    upcoming,
  };
}

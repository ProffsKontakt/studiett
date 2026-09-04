import ical from "node-ical";

export type ScheduleEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
};

export async function fetchSchedule(icalUrl: string, from: Date, to: Date): Promise<ScheduleEvent[]> {
  const data = await ical.async.fromURL(icalUrl);
  const out: ScheduleEvent[] = [];
  for (const ev of Object.values(data)) {
    if (ev.type !== "VEVENT") continue;
    const start = new Date(ev.start);
    if (start < from || start > to) continue;
    out.push({
      id: String(ev.uid),
      title: String(ev.summary ?? ""),
      start: start.toISOString(),
      end: new Date(ev.end).toISOString(),
      location: ev.location ? String(ev.location) : undefined,
    });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

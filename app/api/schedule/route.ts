import { NextResponse } from "next/server";
import { fetchSchedule } from "@/lib/ical";
import { env } from "@/lib/env";

export async function GET() {
  try {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 7 * 86400e3);
    const events = await fetchSchedule(env("TIMEEDIT_ICAL_URL"), from, to);
    return NextResponse.json({ events });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

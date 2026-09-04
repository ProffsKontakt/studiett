import { NextResponse } from "next/server";
import { CanvasClient } from "@/lib/canvas";
import { env } from "@/lib/env";

export async function GET() {
  try {
    const canvas = new CanvasClient(env("CANVAS_BASE_URL"), env("CANVAS_TOKEN"));
    const from = new Date();
    const to = new Date(Date.now() + 21 * 86400e3);
    const [courses, planner] = await Promise.all([canvas.courses(), canvas.planner(from, to)]);
    const deadlines = planner
      .filter((p) => p.plannable_type !== "announcement")
      .map((p) => ({
        title: p.plannable.title,
        course: p.context_name ?? "",
        due: p.plannable.due_at ?? p.plannable_date,
        type: p.plannable_type,
        url: p.html_url,
      }))
      .sort((a, b) => a.due.localeCompare(b.due));
    return NextResponse.json({ courses, deadlines });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

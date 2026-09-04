import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CanvasClient } from "@/lib/canvas";
import { fetchSchedule } from "@/lib/ical";
import { env } from "@/lib/env";

// Agenten får studentens deadlines och schema som kontext. Inget lagras.
export async function POST(req: Request) {
  try {
    const { messages } = (await req.json()) as { messages: { role: "user" | "assistant"; content: string }[] };
    const canvas = new CanvasClient(env("CANVAS_BASE_URL"), env("CANVAS_TOKEN"));
    const now = new Date();
    const [planner, schedule] = await Promise.all([
      canvas.planner(now, new Date(now.getTime() + 30 * 86400e3)),
      fetchSchedule(env("TIMEEDIT_ICAL_URL"), now, new Date(now.getTime() + 14 * 86400e3)),
    ]);

    const context = [
      `Idag: ${now.toLocaleString("sv-SE", { timeZone: "Europe/Stockholm" })}`,
      "",
      "DEADLINES (Canvas):",
      ...planner.map((p) => `- ${p.plannable.due_at ?? p.plannable_date} | ${p.context_name} | ${p.plannable.title} (${p.plannable_type})`),
      "",
      "SCHEMA (TimeEdit):",
      ...schedule.map((e) => `- ${e.start} till ${e.end} | ${e.title}${e.location ? " | " + e.location : ""}`),
    ].join("\n");

    const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: `Du är studentens studieassistent. Svara kort och konkret på svenska. Använd bara datan nedan; om något saknas, säg det. Ange alltid datum och veckodag när du nämner deadlines eller lektioner.\n\n${context}`,
      messages,
    });
    const text = res.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
    return NextResponse.json({ reply: text });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

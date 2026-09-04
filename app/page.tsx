"use client";
import { useEffect, useState } from "react";

type Deadline = { title: string; course: string; due: string; type: string; url?: string };
type Ev = { id: string; title: string; start: string; end: string; location?: string };
type Msg = { role: "user" | "assistant"; content: string };

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "short", timeZone: "Europe/Stockholm" });
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" });

function groupByDay<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = day(key(it));
    m.set(k, [...(m.get(k) ?? []), it]);
  }
  return [...m.entries()];
}

export default function Page() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/canvas").then((r) => r.json()).then((d) => (d.error ? setErrors((e) => [...e, "Canvas: " + d.error]) : setDeadlines(d.deadlines)));
    fetch("/api/schedule").then((r) => r.json()).then((d) => (d.error ? setErrors((e) => [...e, "TimeEdit: " + d.error]) : setEvents(d.events)));
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, content: input.trim() }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    const r = await fetch("/api/chat", { method: "POST", body: JSON.stringify({ messages: next }) });
    const d = await r.json();
    setMsgs([...next, { role: "assistant", content: d.reply ?? d.error }]);
    setBusy(false);
  }

  const soon = Date.now() + 2 * 86400e3;

  return (
    <main>
      <h1>Idag</h1>
      <p className="sub">Ditt schema och dina deadlines, på ett ställe.</p>
      {errors.map((e) => <div className="err" key={e}>{e}</div>)}

      <h2>Schema</h2>
      {events.length === 0 && <div className="empty">Inga lektioner de närmaste sju dagarna.</div>}
      {groupByDay(events, (e) => e.start).map(([d, evs]) => (
        <section key={d}>
          <h2>{d}</h2>
          {evs.map((e) => (
            <div className="row" key={e.id}>
              <time>{clock(e.start)}</time>
              <div><div className="t">{e.title}</div>{e.location && <div className="m">{e.location}</div>}</div>
            </div>
          ))}
        </section>
      ))}

      <h2>Deadlines, tre veckor framåt</h2>
      {deadlines.length === 0 && <div className="empty">Inga deadlines i Canvas just nu.</div>}
      {groupByDay(deadlines, (x) => x.due).map(([d, ds]) => (
        <section key={d}>
          <h2>{d}</h2>
          {ds.map((x) => (
            <div className={"row" + (new Date(x.due).getTime() < soon ? " due-soon" : "")} key={x.title + x.due}>
              <time>{clock(x.due)}</time>
              <div>
                <div className="t">{x.url ? <a href={x.url} target="_blank" rel="noreferrer">{x.title}</a> : x.title}</div>
                <div className="m">{x.course}</div>
              </div>
            </div>
          ))}
        </section>
      ))}

      <div className="chat">
        <div className="chat-inner">
          {msgs.length > 0 && (
            <div className="chat-log">
              {msgs.map((m, i) => <div className={"msg " + m.role} key={i}>{m.content}</div>)}
            </div>
          )}
          <form onSubmit={send}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Vad ska jag ha klart till fredag?" aria-label="Fråga assistenten" />
            <button disabled={busy}>{busy ? "…" : "Fråga"}</button>
          </form>
        </div>
      </div>
    </main>
  );
}

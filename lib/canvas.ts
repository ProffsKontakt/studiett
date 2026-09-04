// Canvas REST-klient. Token skapas av studenten själv i Canvas-inställningarna.
// Docs: https://canvas.instructure.com/doc/api/

export type CanvasCourse = { id: number; name: string; course_code: string };

export type PlannerItem = {
  plannable_type: string;
  plannable_id: number;
  plannable_date: string;
  context_name?: string;
  html_url?: string;
  plannable: { title: string; due_at?: string; points_possible?: number };
};

export type CanvasModuleItem = {
  id: number;
  title: string;
  type: string;
  content_id?: number;
  html_url?: string;
};

export class CanvasClient {
  constructor(private baseUrl: string, private token: string) {}

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`/api/v1${path}`, this.baseUrl);
    url.searchParams.set("per_page", "100");
    for (const [k, v] of Object.entries(params)) url.searchParams.append(k, v);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Canvas ${res.status} on ${path}`);
    return res.json();
  }

  courses() {
    return this.get<CanvasCourse[]>("/courses", {
      enrollment_state: "active",
      "include[]": "term",
    });
  }

  // Alla deadlines (uppgifter, quiz, kalenderhändelser) över alla kurser i ett anrop.
  planner(from: Date, to: Date) {
    return this.get<PlannerItem[]>("/planner/items", {
      start_date: from.toISOString(),
      end_date: to.toISOString(),
    });
  }

  moduleItems(courseId: number) {
    return this.get<{ id: number; name: string; items: CanvasModuleItem[] }[]>(
      `/courses/${courseId}/modules`,
      { "include[]": "items" }
    );
  }

  // Hämtar en fils nedladdnings-URL. Själva innehållet hämtas separat.
  async file(fileId: number) {
    return this.get<{ id: number; display_name: string; url: string; "content-type": string; size: number }>(
      `/files/${fileId}`
    );
  }
}

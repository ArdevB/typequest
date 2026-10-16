import type { LessonPayload, ProgressResponse, RunPayload, SyncPayload } from "@/lib/payloads";
import type { SaveState } from "@/components/progress/ProgressStrip";
import { useAuth } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";

export type SaveResult =
  | { ok: true; data: ProgressResponse & { duplicate?: boolean } }
  | { ok: false; error: string; status: number };

async function post<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ok: false, error: json.error ?? `Request failed (${res.status})`, status: res.status };
    return { ok: true, data: json };
  } catch {
    return { ok: false, error: "You seem to be offline. The run is kept in this browser.", status: 0 };
  }
}

/** Updates the cached profile after the server awards XP. */
function applyProgress(p: ProgressResponse): void {
  const { profile, set } = useAuth.getState();
  if (profile) set({ profile: { ...profile, xp: p.xp, level: p.level, rank: p.rank as typeof profile.rank } });
}

export async function saveRun(payload: RunPayload): Promise<SaveResult> {
  const r = await post<ProgressResponse>("/api/runs", payload);
  if (r.ok) applyProgress(r.data);
  return r;
}

export async function saveLesson(payload: LessonPayload): Promise<SaveResult> {
  const r = await post<ProgressResponse>("/api/lessons", payload);
  if (r.ok) applyProgress(r.data);
  return r;
}

export interface SyncResponse extends ProgressResponse {
  runsSaved: number;
  lessonsSaved: number;
  rejected: number;
}

export async function syncGuestProgress(payload: SyncPayload) {
  const r = await post<SyncResponse>("/api/sync", payload);
  if (r.ok) applyProgress(r.data);
  return r;
}

/**
 * Starts saving a finished run or lesson according to who's playing:
 * signed in → send now; guest → keep it for upload at sign-in; accounts off →
 * keep it too (in case accounts are switched on later). Returns the first
 * state to show; `update` receives the final one.
 */
export function beginSave(opts: {
  valid: boolean;
  send: () => Promise<SaveResult>;
  queue: () => void;
  update: (s: SaveState) => void;
}): SaveState {
  if (!opts.valid) return { state: "skipped" };
  const { status, profile } = useAuth.getState();
  if (status !== "signedIn") {
    opts.queue();
    return status === "disabled" ? { state: "off" } : { state: "guest" };
  }
  const fromXp = profile?.xp ?? 0;
  void opts.send().then((r) => {
    if (!r.ok) {
      if (r.status === 0 || r.status >= 500) opts.queue();
      opts.update({ state: "error", error: r.error });
      return;
    }
    if (r.data.duplicate) return;
    opts.update({ state: "saved", fromXp, data: r.data });
    if (r.data.leveledUp) toast({ title: `Level ${r.data.level}!`, body: "You levelled up. Keep it going.", tone: "level" });
  });
  return { state: "saving", fromXp };
}

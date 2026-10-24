// Offline memory slideshows: open the player with a list of items, or replay a saved slideshow.
import { router } from "expo-router";
import { MediaItem, Slideshow, getState, setState, uid } from "@/src/store";
import { captureTime, monthLabel } from "./dates";

let queued: { title: string; items: MediaItem[] } | null = null;
export const takeQueuedSlideshow = () => queued;

export function playSlideshow(title: string, items: MediaItem[]) {
  if (!items.length) return;
  queued = { title, items: [...items].sort((a, b) => captureTime(a) - captureTime(b)).slice(0, 300) };
  router.push("/slideshow");
}

export function playSaved(id: string) {
  queued = null;
  router.push({ pathname: "/slideshow", params: { id } });
}

export function saveSlideshow(s: Omit<Slideshow, "id" | "created">, id?: string): string {
  const sid = id || uid();
  setState((st) => ({ slideshows: [{ ...s, id: sid, created: Date.now() }, ...st.slideshows.filter((x) => x.id !== sid)].slice(0, 100) }));
  return sid;
}

export const deleteSlideshow = (id: string) => setState((s) => ({ slideshows: s.slideshows.filter((x) => x.id !== id) }));
export const getSlideshow = (id: string) => getState().slideshows.find((s) => s.id === id);

// Monthly memories: every calendar month with at least `min` items, newest month first.
export function groupMonths(items: MediaItem[], min = 3) {
  const map = new Map<string, MediaItem[]>();
  for (const m of items) {
    const t = captureTime(m);
    if (!t) continue;
    const d = new Date(t);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const arr = map.get(k);
    if (arr) arr.push(m);
    else map.set(k, [m]);
  }
  return [...map.entries()]
    .filter(([, v]) => v.length >= min)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, v]) => ({ key, label: monthLabel(captureTime(v[0])), items: v }));
}

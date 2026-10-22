// On-device heuristic intelligence over real metadata (no ML model required, no network).
import { MediaItem } from "@/src/store";

// Events: consecutive media separated by less than `gapH` hours form one event.
export function groupEvents(items: MediaItem[], gapH = 6, min = 4) {
  const sorted = [...items].filter((i) => i.creationTime > 0).sort((a, b) => a.creationTime - b.creationTime);
  const groups: MediaItem[][] = [];
  let cur: MediaItem[] = [];
  for (const it of sorted) {
    if (cur.length && it.creationTime - cur[cur.length - 1].creationTime > gapH * 3600000) {
      if (cur.length >= min) groups.push(cur);
      cur = [];
    }
    cur.push(it);
  }
  if (cur.length >= min) groups.push(cur);
  return groups.reverse();
}

// Bursts: photos captured within `ms` of each other.
export function groupBursts(items: MediaItem[], ms = 2000) {
  const photos = items.filter((i) => i.mediaType === "photo" && i.creationTime > 0).sort((a, b) => a.creationTime - b.creationTime);
  const out: MediaItem[][] = [];
  let cur: MediaItem[] = [];
  for (const p of photos) {
    if (cur.length && p.creationTime - cur[cur.length - 1].creationTime > ms) {
      if (cur.length >= 3) out.push(cur);
      cur = [];
    }
    cur.push(p);
  }
  if (cur.length >= 3) out.push(cur);
  return out.reverse();
}

// Duplicate candidates: identical dimensions + type + duration and capture time within 1 s, or identical filename stem + dimensions.
export function duplicateCandidates(items: MediaItem[]) {
  const map = new Map<string, MediaItem[]>();
  for (const it of items) {
    const stem = it.filename.replace(/\(\d+\)|[-_ ]copy|\.\w+$/gi, "").trim().toLowerCase();
    const k1 = `${it.mediaType}|${it.width}x${it.height}|${Math.round(it.duration)}|${Math.floor(it.creationTime / 1000)}`;
    const k2 = `${it.mediaType}|${it.width}x${it.height}|${stem}`;
    for (const k of [k1, k2]) {
      const arr = map.get(k) || [];
      if (!arr.includes(it)) arr.push(it);
      map.set(k, arr);
    }
  }
  const seen = new Set<string>();
  const groups: MediaItem[][] = [];
  for (const arr of map.values()) {
    if (arr.length < 2) continue;
    const key = arr.map((a) => a.id).sort().join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push(arr);
  }
  return groups;
}

export function onThisDay(items: MediaItem[], now = new Date()) {
  return items.filter((i) => {
    const d = new Date(i.creationTime);
    return d.getMonth() === now.getMonth() && d.getDate() === now.getDate() && d.getFullYear() < now.getFullYear();
  });
}

// Location clusters (~1 km grid) from user-permitted EXIF location index.
export function placeClusters(items: MediaItem[], loc: Record<string, { lat: number; lng: number }>) {
  const map = new Map<string, { lat: number; lng: number; items: MediaItem[] }>();
  for (const it of items) {
    const l = loc[it.id];
    if (!l) continue;
    const k = `${l.lat.toFixed(2)},${l.lng.toFixed(2)}`;
    const g = map.get(k) || { lat: +l.lat.toFixed(2), lng: +l.lng.toFixed(2), items: [] };
    g.items.push(it);
    map.set(k, g);
  }
  return [...map.values()].sort((a, b) => b.items.length - a.items.length);
}

export function monthKey(t: number) {
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

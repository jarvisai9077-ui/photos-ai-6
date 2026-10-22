// RF Action Agent: deterministic local parser → typed tool registry → preview → confirm → execute → history/undo.
// No LLM, no network, no filesystem/shell/database access beyond the typed tools below.
import { router } from "expo-router";
import { AssetMeta, getState, MediaItem, setState, uid, updateMeta } from "@/src/store";
import { allMedia, createAlbum } from "./library";
import { searchMedia } from "./search";
import { setBatch } from "@/src/components/SelectionBar";

export type Plan = {
  tool: string;
  title: string;
  params: Record<string, string>;
  affected: MediaItem[];
  destructive: boolean;
  needsConfirm: boolean;
  run: () => Promise<{ summary: string; undo?: () => void }>;
};

const q = (s: string) => searchMedia(allMedia(), s).map((m) => m.item);
const snapshot = (ids: string[]) => {
  const m = getState().meta;
  const prev: Record<string, AssetMeta> = {};
  ids.forEach((id) => (prev[id] = { ...(m[id] || {}) }));
  return () => setState((s) => ({ meta: { ...s.meta, ...prev } }));
};

export const TOOLS = [
  { name: "create_album", example: "create album Beach from photos last month" },
  { name: "favourite", example: "favourite screenshots today" },
  { name: "archive", example: "archive screenshots 2024" },
  { name: "tag", example: "tag photos last week as trip" },
  { name: "smart_album", example: "smart album portrait videos" },
  { name: "find", example: "find large videos" },
  { name: "find_duplicates", example: "find duplicates" },
  { name: "collage", example: "create collage from favourites" },
  { name: "remove_metadata", example: "remove metadata from photos today" },
  { name: "resize", example: "resize favourites to 1080" },
  { name: "open", example: "open backup / storage / vault / recovery / camera" },
];

export function plan(input: string): Plan | { error: string } {
  const s = input.trim().toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^create album (.+?) (?:from|with) (.+)$/))) {
    const [, name, query] = m;
    const items = q(query);
    return { tool: "create_album", title: `Create album “${name}”`, params: { name, query }, affected: items, destructive: false, needsConfirm: true, run: async () => { await createAlbum(name, items, true); return { summary: `Album “${name}” created with ${items.length} items (copies)` }; } };
  }
  if ((m = s.match(/^(un)?favou?rite (.+)$/))) {
    const items = q(m[2]); const un = !!m[1];
    return { tool: "favourite", title: `${un ? "Unfavourite" : "Favourite"} matching media`, params: { query: m[2] }, affected: items, destructive: false, needsConfirm: true, run: async () => { const undo = snapshot(items.map((i) => i.id)); updateMeta(items.map((i) => i.id), { fav: !un }); return { summary: `${items.length} ${un ? "unfavourited" : "favourited"}`, undo }; } };
  }
  if ((m = s.match(/^archive (.+)$/))) {
    const items = q(m[1]);
    return { tool: "archive", title: "Archive matching media", params: { query: m[1] }, affected: items, destructive: false, needsConfirm: true, run: async () => { const undo = snapshot(items.map((i) => i.id)); updateMeta(items.map((i) => i.id), { archived: true }); return { summary: `${items.length} archived`, undo }; } };
  }
  if ((m = s.match(/^tag (.+) as (.+)$/))) {
    const items = q(m[1]); const tag = m[2].trim();
    return { tool: "tag", title: `Tag as “${tag}”`, params: { query: m[1], tag }, affected: items, destructive: false, needsConfirm: true, run: async () => { const undo = snapshot(items.map((i) => i.id)); updateMeta(items.map((i) => i.id), (cur) => ({ tags: [...new Set([...(cur.tags || []), tag])] })); return { summary: `Tagged ${items.length} as “${tag}”`, undo }; } };
  }
  if ((m = s.match(/^(?:create )?smart album (.+)$/))) {
    const query = m[1];
    return { tool: "smart_album", title: `Create smart album “${query}”`, params: { query }, affected: q(query), destructive: false, needsConfirm: true, run: async () => { const id = uid(); setState((st) => ({ smartAlbums: [{ id, name: query, query, created: Date.now() }, ...st.smartAlbums] })); return { summary: "Smart album created", undo: () => setState((st) => ({ smartAlbums: st.smartAlbums.filter((x) => x.id !== id) })) }; } };
  }
  if (/^find duplicates|duplicates$/.test(s)) {
    return { tool: "find_duplicates", title: "Open duplicate review", params: {}, affected: [], destructive: false, needsConfirm: false, run: async () => { router.push({ pathname: "/collection/[key]", params: { key: "duplicates" } }); return { summary: "Opened duplicate review" }; } };
  }
  if ((m = s.match(/^(?:create )?collage (?:from|of|with) (.+)$/))) {
    const items = q(m[1]).filter((i) => i.mediaType === "photo").slice(0, 9);
    return { tool: "collage", title: "Create collage", params: { query: m[1] }, affected: items, destructive: false, needsConfirm: false, run: async () => { setBatch(items); router.push("/collage"); return { summary: `Collage started with ${items.length} photos` }; } };
  }
  if ((m = s.match(/^(?:remove|strip) (?:metadata|location|exif) (?:from )?(.+)$/))) {
    const items = q(m[1]).filter((i) => i.mediaType === "photo");
    return { tool: "remove_metadata", title: "Privacy export (strip metadata, new copies)", params: { query: m[1] }, affected: items, destructive: false, needsConfirm: false, run: async () => { setBatch(items); router.push("/privacy-export"); return { summary: `Opened Privacy Export Shield with ${items.length} photos` }; } };
  }
  if ((m = s.match(/^resize (.+?) to (\d{2,5})(?:px)?$/))) {
    const items = q(m[1]).filter((i) => i.mediaType === "photo");
    const w = m[2];
    return { tool: "resize", title: `Resize to ${w}px wide (new copies)`, params: { query: m[1], width: w }, affected: items, destructive: false, needsConfirm: false, run: async () => { setBatch(items); router.push({ pathname: "/automation", params: { preset: `resize:${w}` } }); return { summary: `Opened Batch Pipeline with ${items.length} photos` }; } };
  }
  if ((m = s.match(/^open (\w+)/))) {
    const map: Record<string, string> = { backup: "/backup", recovery: "/backup", storage: "/storage", vault: "/vault", camera: "/camera", editor: "/editor", privacy: "/privacy", documents: "/documents", memories: "/memories", settings: "/settings", search: "/search", atlas: "/atlas", health: "/health" };
    const route = map[m[1]];
    if (!route) return { error: `I can open: ${Object.keys(map).join(", ")}` };
    return { tool: "open", title: `Open ${m[1]}`, params: { target: m[1] }, affected: [], destructive: false, needsConfirm: false, run: async () => { router.push(route as any); return { summary: `Opened ${m![1]}` }; } };
  }
  if ((m = s.match(/^(?:find|show|search)(?: me)? (.+)$/))) {
    const items = q(m[1]);
    return { tool: "find", title: `Find “${m[1]}”`, params: { query: m[1] }, affected: items, destructive: false, needsConfirm: false, run: async () => ({ summary: `${items.length} results` }) };
  }
  return { error: "I didn't recognise that command. Try one of the examples." };
}

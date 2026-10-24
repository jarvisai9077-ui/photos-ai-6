// RF Photos local database: a versioned, persisted JSON store kept 100% on-device.
import { useSyncExternalStore } from "react";
import { storage } from "@/src/utils/storage";

export type MediaType = "photo" | "video";
export type MediaItem = {
  id: string;
  uri: string;
  filename: string;
  mediaType: MediaType;
  width: number;
  height: number;
  creationTime: number;
  modificationTime: number;
  duration: number;
  albumId?: string;
  source: "device" | "imported";
  thumb?: string; // poster frame for imported videos
  session?: boolean; // web preview only: large files kept in memory, not persisted
};
export type Slideshow = { id: string; title: string; itemIds: string[]; transition: "fade" | "slide" | "zoom"; seconds: number; created: number };
export type AssetMeta = { fav?: boolean; tags?: string[]; caption?: string; note?: string; archived?: boolean; rating?: number; approval?: "approved" | "rejected" | "pending" };
export type Version = { id: string; sourceId: string; sourceName: string; outputId?: string; outputUri: string; ops: string[]; time: number };
export type ProvEvent = { id: string; assetId: string; kind: "import" | "edit" | "export" | "vault" | "metadata" | "restore"; detail: string; time: number };
export type SmartAlbum = { id: string; name: string; query: string; paused?: boolean; created: number };
export type AgentRun = { id: string; command: string; tool: string; summary: string; status: "done" | "failed" | "cancelled"; time: number; affected: number };
export type DocPage = { uri: string };
export type Doc = { id: string; title: string; text: string; tags: string[]; pages: DocPage[]; pdfUri?: string; created: number };
export type Project = { id: string; kind: "collage" | "story" | "poster" | "contact" | "storyboard"; title: string; template: string; items: string[]; uris: string[]; text: string; bg: string; created: number; updated: number; outputUri?: string };
export type VaultItem = { id: string; uri: string; filename: string; mediaType: MediaType; added: number; originalId?: string };
export type WorkflowStep = { op: "resize" | "rotate" | "flip" | "format" | "album"; value: string };
export type Workflow = { id: string; name: string; steps: WorkflowStep[]; created: number };
export type Job = { id: string; name: string; status: "running" | "done" | "failed" | "cancelled" | "interrupted"; total: number; ok: number; failed: number; started: number; ended?: number; errors: string[] };
export type ImportRecord = { id: string; source: string; method: string; count: number; skipped: number; errors: string[]; time: number };
export type Prefs = {
  theme: "system" | "light" | "dark";
  reducedMotion: boolean;
  gridColumns: number;
  indexLocation: boolean;
  indexNotes: boolean;
  vaultTimeoutMin: number;
  brandName: string;
  brandColor: string;
  watermark: string;
};
export type ClipItem = { id: string; uri: string; label: string; pinned: boolean; time: number };
export type Annotation = { id: string; assetId: string; x: number; y: number; text: string; time: number };
export type ShotPlan = { id: string; title: string; recipe: string; done: boolean };

export type State = {
  schema: number;
  meta: Record<string, AssetMeta>;
  versions: Version[];
  events: ProvEvent[];
  smartAlbums: SmartAlbum[];
  savedSearches: string[];
  agentHistory: AgentRun[];
  documents: Doc[];
  projects: Project[];
  imported: MediaItem[];
  vault: VaultItem[];
  workflows: Workflow[];
  jobs: Job[];
  imports: ImportRecord[];
  locIndex: Record<string, { lat: number; lng: number }>;
  clipboard: ClipItem[];
  annotations: Annotation[];
  shots: ShotPlan[];
  lensFavs: string[];
  slideshows: Slideshow[];
  prefs: Prefs;
};

export const SCHEMA = 1;
const KEY = "rf_photos_db_v1";

const initial: State = {
  schema: SCHEMA,
  meta: {},
  versions: [],
  events: [],
  smartAlbums: [],
  savedSearches: [],
  agentHistory: [],
  documents: [],
  projects: [],
  imported: [],
  vault: [],
  workflows: [],
  jobs: [],
  imports: [],
  locIndex: {},
  clipboard: [],
  annotations: [],
  shots: [],
  lensFavs: [],
  slideshows: [],
  prefs: {
    theme: "system",
    reducedMotion: false,
    gridColumns: 4,
    indexLocation: true,
    indexNotes: true,
    vaultTimeoutMin: 1,
    brandName: "RF Photos",
    brandColor: "#FF5E00",
    watermark: "",
  },
};

let state: State = initial;
let hydrated = false;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function migrate(raw: any): State {
  // Versioned migration: merge unknown/missing keys onto defaults without dropping user data.
  const s = { ...initial, ...(raw || {}) } as State;
  s.prefs = { ...initial.prefs, ...(raw?.prefs || {}) };
  for (const k of Object.keys(initial) as (keyof State)[]) {
    if (Array.isArray(initial[k]) && !Array.isArray(s[k])) (s as any)[k] = [];
  }
  s.schema = SCHEMA;
  return s;
}

export async function hydrate() {
  if (hydrated) return;
  const raw = await storage.getItem<string | null>(KEY, null);
  if (raw) {
    try {
      state = migrate(JSON.parse(raw));
    } catch {
      state = initial;
    }
  }
  // Jobs that were running when the app was closed are marked interrupted (restart recovery).
  state = { ...state, jobs: state.jobs.map((j) => (j.status === "running" ? { ...j, status: "interrupted" } : j)) };
  hydrated = true;
  listeners.forEach((l) => l());
}

export function getState() {
  return state;
}

export function setState(fn: (s: State) => Partial<State>) {
  state = { ...state, ...fn(state) };
  listeners.forEach((l) => l());
  if (!hydrated) return; // never overwrite the saved database with defaults before it has loaded
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 500);
}

function persist() {
  saveTimer = null;
  try {
    // Session-only items (large web-preview files) are never written to disk.
    const out = state.imported.some((i) => i.session) ? { ...state, imported: state.imported.filter((i) => !i.session) } : state;
    storage.setItem(KEY, JSON.stringify(out));
  } catch {
    // serialisation failure must never crash the app; the next change retries
  }
}

export function replaceState(next: State) {
  setState(() => migrate(next));
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selector(state),
    () => selector(state),
  );
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function updateMeta(ids: string[], patch: Partial<AssetMeta> | ((m: AssetMeta) => Partial<AssetMeta>)) {
  setState((s) => {
    const meta = { ...s.meta };
    ids.forEach((id) => {
      const cur = meta[id] || {};
      meta[id] = { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) };
    });
    return { meta };
  });
}

export function logEvent(assetId: string, kind: ProvEvent["kind"], detail: string) {
  setState((s) => ({ events: [{ id: uid(), assetId, kind, detail, time: Date.now() }, ...s.events].slice(0, 2000) }));
}

export function startJob(name: string, total: number): string {
  const id = uid();
  setState((s) => ({ jobs: [{ id, name, status: "running" as const, total, ok: 0, failed: 0, started: Date.now(), errors: [] }, ...s.jobs].slice(0, 200) }));
  return id;
}

export function updateJob(id: string, patch: Partial<Job>) {
  setState((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) }));
}

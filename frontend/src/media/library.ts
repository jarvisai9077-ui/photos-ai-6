// Local media engine: Android MediaStore / iOS Photos (via expo-media-library) + media imported into RF Photos' own storage.
import { AppState, Platform } from "react-native";
import * as ML from "expo-media-library/legacy";
import { isRunningInExpoGo } from "expo";
import * as FS from "expo-file-system/legacy";
import * as VideoThumbnails from "expo-video-thumbnails";
import { useMemo, useSyncExternalStore } from "react";
import { getState, MediaItem, setState, uid, useStore } from "@/src/store";
import { captureTime } from "./dates";

// Expo Go on Android cannot be granted full media access (Google Play policy: its manifest no longer declares
// READ_MEDIA_IMAGES / READ_MEDIA_VIDEO). There, RF Photos works through the system photo picker instead.
export const inExpoGo = isRunningInExpoGo();
export const expoGoAndroid = Platform.OS === "android" && inExpoGo;
export const deviceLibraryAvailable = Platform.OS !== "web" && !expoGoAndroid;

export type LibStatus = "idle" | "loading" | "ready" | "denied" | "expo-go" | "unavailable" | "error";
type LibState = {
  items: MediaItem[];
  albums: ML.Album[];
  status: LibStatus;
  permission: "granted" | "limited" | "denied" | "undetermined";
  canAskAgain: boolean;
  total: number;
  error?: string;
  indexedAt?: number;
};

let lib: LibState = {
  items: [],
  albums: [],
  status: Platform.OS === "web" ? "unavailable" : expoGoAndroid ? "expo-go" : "idle",
  permission: "undetermined",
  canAskAgain: true,
  total: 0,
};
const listeners = new Set<() => void>();
function set(p: Partial<LibState>) {
  lib = { ...lib, ...p };
  listeners.forEach((l) => l());
}
export function useLibrary<T>(sel: (s: LibState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => sel(lib),
    () => sel(lib),
  );
}
export const getLibrary = () => lib;

function toItem(a: ML.Asset): MediaItem {
  return {
    id: a.id,
    uri: a.uri,
    filename: a.filename || "media",
    mediaType: a.mediaType === "video" ? "video" : "photo",
    width: a.width || 0,
    height: a.height || 0,
    creationTime: a.creationTime || a.modificationTime || 0,
    modificationTime: a.modificationTime || 0,
    duration: a.duration || 0,
    albumId: a.albumId,
    source: "device",
  };
}

function permState(p: ML.PermissionResponse): LibState["permission"] {
  if (p.granted) return p.accessPrivileges === "limited" ? "limited" : "granted";
  return p.status === "undetermined" ? "undetermined" : "denied";
}

const errMsg = (e: any) => String(e?.message || e || "Unknown error");

export async function checkPermission() {
  if (!deviceLibraryAvailable) return false;
  try {
    // Android 13+: request photos + videos granularly (READ_MEDIA_IMAGES / READ_MEDIA_VIDEO);
    // Android 12 and lower map this to READ_EXTERNAL_STORAGE automatically.
    const p = await ML.getPermissionsAsync(false, ["photo", "video"]);
    set({ permission: permState(p), canAskAgain: p.canAskAgain });
    return p.granted;
  } catch (e) {
    set({ permission: "denied", canAskAgain: false, status: "error", error: errMsg(e) });
    return false;
  }
}

let requesting = false;
export async function requestPermission(): Promise<LibState["permission"]> {
  if (!deviceLibraryAvailable || requesting) return lib.permission;
  requesting = true;
  try {
    if (lib.permission === "denied" && !lib.canAskAgain) return "denied"; // OS won't show a dialog; caller opens Settings
    const p = await ML.requestPermissionsAsync(false, ["photo", "video"]);
    const perm = permState(p);
    set({ permission: perm, canAskAgain: p.canAskAgain, error: undefined });
    if (p.granted) await indexLibrary(true);
    else set({ status: "denied" });
    return perm;
  } catch (e) {
    set({ permission: "denied", canAskAgain: false, status: "error", error: errMsg(e) });
    return "denied";
  } finally {
    requesting = false;
  }
}

// Limited access (Android 14+ "Select photos and videos" / iOS limited): let the user change the selection.
export async function manageLimitedAccess() {
  if (!deviceLibraryAvailable) return;
  try {
    await ML.presentPermissionsPickerAsync(["photo", "video"]);
  } catch {
    await requestPermission();
  }
  await indexLibrary(true);
}

// Re-check when returning from system Settings so a newly granted/revoked permission is picked up.
let appStateSub: { remove: () => void } | null = null;
export function watchAppState() {
  if (!deviceLibraryAvailable || appStateSub) return;
  appStateSub = AppState.addEventListener("change", async (s) => {
    if (s !== "active") return;
    const before = lib.permission;
    const granted = await checkPermission();
    if (granted && (before !== lib.permission || lib.status !== "ready")) indexLibrary(true);
    else if (!granted && lib.items.length) set({ items: [], albums: [], total: 0, status: "denied" });
  });
}

let indexing: Promise<void> | null = null;
let again = false;
// Paginated indexing. The first page is published immediately so the grid appears at once; later pages are
// published in large batches to keep re-renders low. Re-index requests during a run are coalesced.
export function indexLibrary(force = false): Promise<void> {
  if (!deviceLibraryAvailable) return Promise.resolve();
  if (indexing) {
    if (force) again = true;
    return indexing;
  }
  indexing = runIndex().finally(() => {
    indexing = null;
    if (again) {
      again = false;
      indexLibrary();
    }
  });
  return indexing;
}

async function runIndex() {
  const ok = await checkPermission();
  if (!ok) {
    set({ status: lib.permission === "undetermined" ? "idle" : lib.status === "error" ? "error" : "denied", items: [], albums: [], total: 0 });
    return;
  }
  const hadItems = lib.items.length > 0;
  if (!hadItems) set({ status: "loading", error: undefined });
  try {
    let after: string | undefined;
    const all: MediaItem[] = [];
    for (let page = 0; page < 400; page++) {
      const res = await ML.getAssetsAsync({
        first: page === 0 ? 150 : 1000,
        after,
        mediaType: [ML.MediaType.photo, ML.MediaType.video],
        sortBy: [[ML.SortBy.creationTime, false]],
      });
      for (const a of res.assets) all.push(toItem(a));
      // Fresh launch: show the first page now. Re-index: keep the old list until the new one is complete (no flicker).
      if (!hadItems && (page === 0 || page % 5 === 0)) set({ items: all.slice(), total: res.totalCount, status: "ready" });
      if (!res.hasNextPage) break;
      after = res.endCursor;
    }
    set({ items: all, total: all.length, indexedAt: Date.now(), status: "ready", error: undefined });
  } catch (e) {
    set({ status: lib.items.length ? "ready" : "error", error: errMsg(e) });
  }
  // Albums (Camera, WhatsApp Images/Video, Screenshots, Download, ...) after the grid, they are not needed to paint it.
  try {
    const albums = await ML.getAlbumsAsync({ includeSmartAlbums: true });
    set({ albums: albums.filter((a) => a.assetCount !== 0) });
  } catch {
    // some devices refuse album queries with limited access; the gallery still works
  }
}

let sub: { remove: () => void } | null = null;
let changeTimer: ReturnType<typeof setTimeout> | null = null;
export function watchLibrary() {
  if (!deviceLibraryAvailable || sub) return;
  try {
    // MediaStore fires many change events in a row (e.g. a camera burst); debounce into one re-index.
    sub = ML.addListener(() => {
      if (changeTimer) clearTimeout(changeTimer);
      changeTimer = setTimeout(() => indexLibrary(true), 1200);
    });
  } catch {
    sub = null;
  }
}

export async function albumAssets(albumId: string): Promise<MediaItem[]> {
  const out: MediaItem[] = [];
  let after: string | undefined;
  for (let i = 0; i < 200; i++) {
    const r = await ML.getAssetsAsync({ album: albumId, first: 1000, after, mediaType: [ML.MediaType.photo, ML.MediaType.video], sortBy: [[ML.SortBy.creationTime, false]] });
    r.assets.forEach((a) => out.push(toItem(a)));
    if (!r.hasNextPage) break;
    after = r.endCursor;
  }
  return out;
}

export function allMedia(): MediaItem[] {
  const s = getState();
  const vaultIds = new Set(s.vault.map((v) => v.originalId).filter(Boolean));
  const merged = s.imported.length || vaultIds.size ? [...s.imported, ...lib.items].filter((m) => !vaultIds.has(m.id)) : lib.items;
  return [...merged].sort((a, b) => captureTime(b) - captureTime(a));
}

export function useAllMedia(): MediaItem[] {
  const items = useLibrary((s) => s.items);
  const imported = useStore((s) => s.imported);
  const vault = useStore((s) => s.vault);
  return useMemo(() => allMedia(), [items, imported, vault]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function findItem(id: string): MediaItem | undefined {
  return getState().imported.find((m) => m.id === id) || lib.items.find((m) => m.id === id);
}

export const isScreenshot = (m: MediaItem) => /screenshot|screen_shot|scrn/i.test(m.filename);
export const isScreenRecording = (m: MediaItem) => m.mediaType === "video" && /screen.?record|scr.?rec/i.test(m.filename);

export const libraryWritable = () => deviceLibraryAvailable && (lib.permission === "granted" || lib.permission === "limited");

const IMPORT_DIR = (FS.documentDirectory || "") + "imported/";
const extOf = (name: string, fallback: string) => ((name.split(".").pop() || fallback).toLowerCase().replace(/[^a-z0-9]/g, "") || fallback).slice(0, 5);

// Copy a file into RF Photos' private storage (used without gallery access, in Expo Go, and for imports).
export async function keepInAppStorage(localUri: string, filename: string, mediaType: "photo" | "video"): Promise<string> {
  const info = await FS.getInfoAsync(IMPORT_DIR);
  if (!info.exists) await FS.makeDirectoryAsync(IMPORT_DIR, { intermediates: true });
  const dest = `${IMPORT_DIR}${uid()}.${extOf(filename, mediaType === "video" ? "mp4" : "jpg")}`;
  await FS.copyAsync({ from: localUri, to: dest });
  return dest;
}

// Poster frame for a video stored in app storage (gallery videos get theirs from the system).
export async function makeVideoThumb(uri: string): Promise<string | undefined> {
  if (Platform.OS === "web") return undefined;
  try {
    const r = await VideoThumbnails.getThumbnailAsync(uri, { time: 500, quality: 0.6 });
    const dest = `${IMPORT_DIR}${uid()}_thumb.jpg`;
    await FS.moveAsync({ from: r.uri, to: dest });
    return dest;
  } catch {
    return undefined;
  }
}

export function addImported(item: MediaItem) {
  setState((s) => ({ imported: [item, ...s.imported.filter((i) => i.id !== item.id)] }));
}

// Save a newly created file (camera capture, edit, collage, frame...) to the gallery when allowed,
// otherwise into RF Photos' own storage. Never throws for the fallback path.
export async function saveToLibrary(localUri: string, filename: string, mediaType: "photo" | "video" = "photo", width = 0, height = 0, duration = 0): Promise<MediaItem> {
  const now = Date.now();
  if (libraryWritable()) {
    try {
      const asset = await ML.createAssetAsync(localUri);
      try {
        const album = await ML.getAlbumAsync("RF Photos");
        if (album) await ML.addAssetsToAlbumAsync([asset], album, false);
        else await ML.createAlbumAsync("RF Photos", asset, false);
      } catch {
        // album assignment is best-effort; the asset is already saved
      }
      const item = toItem(asset);
      if (!item.creationTime) item.creationTime = now;
      set({ items: [item, ...lib.items.filter((i) => i.id !== item.id)] });
      return item;
    } catch {
      // fall through to app storage (e.g. limited access refused the write)
    }
  }
  if (Platform.OS !== "web") {
    const uri = await keepInAppStorage(localUri, filename, mediaType);
    const thumb = mediaType === "video" ? await makeVideoThumb(uri) : undefined;
    const item: MediaItem = { id: "imp_" + uid(), uri, thumb, filename, mediaType, width, height, creationTime: now, modificationTime: now, duration, source: "imported" };
    addImported(item);
    return item;
  }
  const item: MediaItem = { id: "imp_" + uid(), uri: localUri, filename, mediaType, width, height, creationTime: now, modificationTime: now, duration, source: "imported", session: localUri.length > 900_000 };
  addImported(item);
  return item;
}

// Returns false when the user cancels the system delete confirmation.
export async function deleteMedia(items: MediaItem[]): Promise<boolean> {
  const dev = items.filter((i) => i.source === "device");
  const imp = items.filter((i) => i.source === "imported");
  if (dev.length) {
    let ok = false;
    try {
      ok = await ML.deleteAssetsAsync(dev.map((d) => d.id));
    } catch (e) {
      if (/cancel|denied|reject/i.test(errMsg(e))) return false;
      throw new Error(`Android refused to delete: ${errMsg(e)}`);
    }
    if (!ok) return false;
    const gone = new Set(dev.map((d) => d.id));
    set({ items: lib.items.filter((i) => !gone.has(i.id)), total: Math.max(0, lib.total - gone.size) });
  }
  if (imp.length) {
    if (Platform.OS !== "web") {
      for (const i of imp) {
        for (const u of [i.uri, i.thumb]) if (u && u.startsWith(FS.documentDirectory || "~")) await FS.deleteAsync(u, { idempotent: true }).catch(() => {});
      }
    }
    const ids = new Set(imp.map((i) => i.id));
    setState((s) => ({ imported: s.imported.filter((i) => !ids.has(i.id)) }));
  }
  return true;
}

export async function assetInfo(id: string) {
  if (!deviceLibraryAvailable || id.startsWith("imp_")) return null;
  try {
    return await ML.getAssetInfoAsync(id);
  } catch {
    return null;
  }
}

export async function createAlbum(name: string, items: MediaItem[], copy = true) {
  const dev = items.filter((i) => i.source === "device");
  if (!deviceLibraryAvailable || !libraryWritable()) throw new Error("Device albums need access to your photos and videos");
  if (!dev.length) throw new Error("Albums can only contain photos and videos from your gallery");
  const album = await ML.createAlbumAsync(name, dev[0].id, copy);
  if (dev.length > 1) await ML.addAssetsToAlbumAsync(dev.slice(1).map((d) => d.id), album, copy);
  indexLibrary(true);
  return album;
}

export async function addToAlbum(albumId: string, items: MediaItem[], copy = true) {
  const dev = items.filter((i) => i.source === "device");
  if (!dev.length) throw new Error("Only gallery photos and videos can be added to device albums");
  const ok = await ML.addAssetsToAlbumAsync(dev.map((d) => d.id), albumId, copy);
  indexLibrary(true);
  return ok;
}

export async function deleteAlbum(albumId: string) {
  const ok = await ML.deleteAlbumsAsync([albumId], false);
  indexLibrary(true);
  return ok;
}

export { ML };

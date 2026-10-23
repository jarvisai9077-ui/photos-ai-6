// Local media engine: Android MediaStore (via expo-media-library) + app-imported media.
import { AppState, Platform } from "react-native";
import * as ML from "expo-media-library/legacy";
import { isRunningInExpoGo } from "expo";
import * as FS from "expo-file-system/legacy";
import { useMemo, useSyncExternalStore } from "react";
import { getState, MediaItem, setState, uid, useStore } from "@/src/store";

export const deviceLibraryAvailable = Platform.OS !== "web";

type LibState = {
  items: MediaItem[];
  albums: ML.Album[];
  status: "idle" | "loading" | "ready" | "denied" | "restricted" | "unavailable" | "error";
  permission: "granted" | "limited" | "denied" | "undetermined";
  canAskAgain: boolean;
  total: number;
  error?: string;
  indexedAt?: number;
};

let lib: LibState = { items: [], albums: [], status: "idle", permission: "undetermined", canAskAgain: true, total: 0 };
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
    filename: a.filename,
    mediaType: a.mediaType === "video" ? "video" : "photo",
    width: a.width,
    height: a.height,
    creationTime: a.creationTime || a.modificationTime || 0,
    modificationTime: a.modificationTime || 0,
    duration: a.duration || 0,
    albumId: a.albumId,
    source: "device",
  };
}

// Expo Go on Android cannot be granted full MediaStore access (Google Play policy: the Expo Go manifest no longer
// declares READ_MEDIA_IMAGES/VIDEO). Permission calls there reject or return denied → we detect and explain it.
export const inExpoGo = isRunningInExpoGo();
export const expoGoAndroid = Platform.OS === "android" && inExpoGo;

function permState(p: ML.PermissionResponse): LibState["permission"] {
  if (p.granted) return p.accessPrivileges === "limited" ? "limited" : "granted";
  return p.status === "undetermined" ? "undetermined" : "denied";
}

export async function checkPermission() {
  if (!deviceLibraryAvailable) {
    set({ status: "unavailable" });
    return false;
  }
  try {
    const p = await ML.getPermissionsAsync(false, ["photo", "video"]);
    set({ permission: permState(p), canAskAgain: p.canAskAgain });
    return p.granted;
  } catch (e: any) {
    set({ permission: "denied", canAskAgain: false, status: "restricted", error: String(e?.message || e) });
    return false;
  }
}

let requesting = false;
export async function requestPermission(): Promise<LibState["permission"]> {
  if (!deviceLibraryAvailable || requesting) return lib.permission;
  requesting = true;
  try {
    // Never re-prompt when the OS will not show a dialog; caller opens Settings instead.
    if (lib.permission === "denied" && !lib.canAskAgain) return "denied";
    const p = await ML.requestPermissionsAsync(false, ["photo", "video"]);
    const perm = permState(p);
    set({ permission: perm, canAskAgain: p.canAskAgain, error: undefined });
    if (p.granted) {
      indexing = false;
      await indexLibrary();
    } else set({ status: "denied" });
    return perm;
  } catch (e: any) {
    set({ permission: "denied", canAskAgain: false, status: "restricted", error: String(e?.message || e) });
    return "denied";
  } finally {
    requesting = false;
  }
}

// Re-check when returning from system Settings so a newly granted permission loads the gallery automatically.
let appStateSub: { remove: () => void } | null = null;
export function watchAppState() {
  if (!deviceLibraryAvailable || appStateSub) return;
  appStateSub = AppState.addEventListener("change", async (s) => {
    if (s !== "active") return;
    const before = lib.permission;
    const granted = await checkPermission();
    if (granted && (before !== "granted" && before !== "limited" || lib.status !== "ready")) indexLibrary();
    else if (granted && before === "limited") indexLibrary();
  });
}

let indexing = false;
// Incremental, paginated indexing. First page is published immediately so the grid renders fast.
export async function indexLibrary() {
  if (!deviceLibraryAvailable) {
    set({ status: "unavailable" });
    return;
  }
  if (indexing) return;
  const ok = await checkPermission();
  if (!ok) {
    if (lib.status !== "restricted") set({ status: lib.permission === "undetermined" ? "idle" : "denied" });
    return;
  }
  indexing = true;
  set({ status: lib.items.length ? lib.status : "loading", error: undefined });
  try {
    try {
      set({ albums: await ML.getAlbumsAsync({ includeSmartAlbums: true }) });
    } catch {
      // albums are optional; with limited access some devices refuse album queries
    }
    let after: string | undefined;
    const all: MediaItem[] = [];
    for (let page = 0; page < 200; page++) {
      const res = await ML.getAssetsAsync({
        first: page === 0 ? 120 : 500,
        after,
        mediaType: [ML.MediaType.photo, ML.MediaType.video],
        sortBy: [[ML.SortBy.creationTime, false]],
      });
      res.assets.forEach((a) => all.push(toItem(a)));
      if (page === 0 || page % 4 === 0 || !res.hasNextPage) set({ items: [...all], total: res.totalCount, status: "ready" });
      if (!res.hasNextPage) break;
      after = res.endCursor;
    }
    set({ items: [...all], indexedAt: Date.now(), status: "ready" });
  } catch (e: any) {
    set({ status: "error", error: String(e?.message || e) });
  } finally {
    indexing = false;
  }
}

let sub: { remove: () => void } | null = null;
export function watchLibrary() {
  if (!deviceLibraryAvailable || sub) return;
  try {
    sub = ML.addListener(() => indexLibrary());
  } catch {
    sub = null;
  }
}

export async function albumAssets(albumId: string): Promise<MediaItem[]> {
  const out: MediaItem[] = [];
  let after: string | undefined;
  for (let i = 0; i < 50; i++) {
    const r = await ML.getAssetsAsync({ album: albumId, first: 500, after, mediaType: [ML.MediaType.photo, ML.MediaType.video], sortBy: [[ML.SortBy.creationTime, false]] });
    r.assets.forEach((a) => out.push(toItem(a)));
    if (!r.hasNextPage) break;
    after = r.endCursor;
  }
  return out;
}

export function allMedia(): MediaItem[] {
  const vaultIds = new Set(getState().vault.map((v) => v.originalId).filter(Boolean));
  const imported = getState().imported;
  const merged = [...imported, ...lib.items].filter((m) => !vaultIds.has(m.id));
  return merged.sort((a, b) => b.creationTime - a.creationTime);
}

export function useAllMedia(): MediaItem[] {
  const items = useLibrary((s) => s.items);
  const imported = useStore((s) => s.imported);
  const vault = useStore((s) => s.vault);
  return useMemo(() => allMedia(), [items, imported, vault]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function findItem(id: string): MediaItem | undefined {
  return allMedia().find((m) => m.id === id) || lib.items.find((m) => m.id === id);
}

export const isScreenshot = (m: MediaItem) => /screenshot|screen_shot|scrn/i.test(m.filename);
export const isScreenRecording = (m: MediaItem) => m.mediaType === "video" && /screen.?record|scr.?rec/i.test(m.filename);

// Save a local file (file:// or data:) into the device library ("RF Photos" album) or, on web, into imported media.
export const libraryWritable = () => deviceLibraryAvailable && (lib.permission === "granted" || lib.permission === "limited");

// Without MediaStore access (permission denied, or Expo Go on Android) files are kept in RF Photos' own storage.
async function keepInAppStorage(localUri: string, filename: string): Promise<string> {
  const dir = FS.documentDirectory + "imported/";
  const info = await FS.getInfoAsync(dir);
  if (!info.exists) await FS.makeDirectoryAsync(dir, { intermediates: true });
  const ext = (filename.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const dest = `${dir}${uid()}.${ext}`;
  await FS.copyAsync({ from: localUri, to: dest });
  return dest;
}

export async function saveToLibrary(localUri: string, filename: string, mediaType: "photo" | "video" = "photo", width = 0, height = 0): Promise<MediaItem> {
  if (deviceLibraryAvailable && !libraryWritable()) {
    const uri = await keepInAppStorage(localUri, filename);
    const item: MediaItem = { id: "imp_" + uid(), uri, filename, mediaType, width, height, creationTime: Date.now(), modificationTime: Date.now(), duration: 0, source: "imported" };
    setState((s) => ({ imported: [item, ...s.imported] }));
    return item;
  }
  if (deviceLibraryAvailable) {
    const asset = await ML.createAssetAsync(localUri);
    try {
      const album = await ML.getAlbumAsync("RF Photos");
      if (album) await ML.addAssetsToAlbumAsync([asset], album, false);
      else await ML.createAlbumAsync("RF Photos", asset, false);
    } catch {
      // album assignment is best-effort; asset is already saved
    }
    const item = toItem(asset);
    set({ items: [item, ...lib.items.filter((i) => i.id !== item.id)] });
    return item;
  }
  const item: MediaItem = { id: "imp_" + uid(), uri: localUri, filename, mediaType, width, height, creationTime: Date.now(), modificationTime: Date.now(), duration: 0, source: "imported" };
  setState((s) => ({ imported: [item, ...s.imported] }));
  return item;
}

export async function deleteMedia(items: MediaItem[]): Promise<boolean> {
  const dev = items.filter((i) => i.source === "device");
  const imp = new Set(items.filter((i) => i.source === "imported").map((i) => i.id));
  if (dev.length) {
    const ok = await ML.deleteAssetsAsync(dev.map((d) => d.id));
    if (!ok) return false;
    const gone = new Set(dev.map((d) => d.id));
    set({ items: lib.items.filter((i) => !gone.has(i.id)) });
  }
  if (imp.size) {
    if (deviceLibraryAvailable) for (const i of items) if (imp.has(i.id) && i.uri.startsWith(FS.documentDirectory || "~")) await FS.deleteAsync(i.uri, { idempotent: true });
    setState((s) => ({ imported: s.imported.filter((i) => !imp.has(i.id)) }));
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
  if (!dev.length) throw new Error("Albums need at least one device photo or video");
  const album = await ML.createAlbumAsync(name, dev[0].id, copy);
  if (dev.length > 1) await ML.addAssetsToAlbumAsync(dev.slice(1).map((d) => d.id), album, copy);
  await indexLibrary();
  return album;
}

export async function addToAlbum(albumId: string, items: MediaItem[], copy = true) {
  const dev = items.filter((i) => i.source === "device");
  if (!dev.length) throw new Error("Only device media can be added to device albums");
  const ok = await ML.addAssetsToAlbumAsync(dev.map((d) => d.id), albumId, copy);
  await indexLibrary();
  return ok;
}

export async function deleteAlbum(albumId: string) {
  const ok = await ML.deleteAlbumsAsync([albumId], false);
  await indexLibrary();
  return ok;
}

export { ML };

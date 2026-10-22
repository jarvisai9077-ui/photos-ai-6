// Local media engine: Android MediaStore (via expo-media-library) + app-imported media.
import { Platform } from "react-native";
import * as ML from "expo-media-library/legacy";
import { useMemo, useSyncExternalStore } from "react";
import { getState, MediaItem, setState, uid, useStore } from "@/src/store";

export const deviceLibraryAvailable = Platform.OS !== "web";

type LibState = {
  items: MediaItem[];
  albums: ML.Album[];
  status: "idle" | "loading" | "ready" | "denied" | "unavailable" | "error";
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

export async function checkPermission() {
  if (!deviceLibraryAvailable) {
    set({ status: "unavailable" });
    return false;
  }
  const p = await ML.getPermissionsAsync(false, ["photo", "video"]);
  const perm = p.granted ? (p.accessPrivileges === "limited" ? "limited" : "granted") : p.status === "undetermined" ? "undetermined" : "denied";
  set({ permission: perm, canAskAgain: p.canAskAgain });
  return p.granted;
}

export async function requestPermission() {
  if (!deviceLibraryAvailable) return false;
  const p = await ML.requestPermissionsAsync(false, ["photo", "video"]);
  const perm = p.granted ? (p.accessPrivileges === "limited" ? "limited" : "granted") : "denied";
  set({ permission: perm, canAskAgain: p.canAskAgain });
  if (p.granted) await indexLibrary();
  else set({ status: "denied" });
  return p.granted;
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
    set({ status: "denied" });
    return;
  }
  indexing = true;
  set({ status: lib.items.length ? lib.status : "loading", error: undefined });
  try {
    const albums = await ML.getAlbumsAsync({ includeSmartAlbums: true });
    set({ albums });
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
      set({ items: [...all], total: res.totalCount, status: "ready" });
      if (!res.hasNextPage) break;
      after = res.endCursor;
    }
    set({ indexedAt: Date.now(), status: "ready" });
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
export async function saveToLibrary(localUri: string, filename: string, mediaType: "photo" | "video" = "photo", width = 0, height = 0): Promise<MediaItem> {
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
  if (imp.size) setState((s) => ({ imported: s.imported.filter((i) => !imp.has(i.id)) }));
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

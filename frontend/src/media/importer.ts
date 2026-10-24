// Import photos/videos through the system photo picker (no gallery permission needed) or the document provider
// (Downloads, Drive, file managers). Files are copied into RF Photos' storage; items already in the gallery are skipped.
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";
import { getState, logEvent, MediaItem, setState, uid } from "@/src/store";
import { addImported, getLibrary, keepInAppStorage, makeVideoThumb } from "./library";
import { jpegExifDate, parseExifDate } from "./dates";

type Picked = { uri: string; name: string; type: "photo" | "video"; w: number; h: number; duration: number; time: number; assetId?: string | null; size?: number; lastModified?: number };
export type ImportResult = { count: number; skipped: number; duplicates: number; errors: string[]; cancelled?: boolean };

const WEB_PERSIST_LIMIT = 900_000; // data: URIs larger than this would overflow browser storage; kept for the session only

export async function importMedia(method: "picker" | "documents" = "picker"): Promise<ImportResult> {
  let picked: Picked[] = [];
  try {
    if (method === "picker") {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], allowsMultipleSelection: true, selectionLimit: 0, quality: 1, exif: true, base64: false });
      if (r.canceled) return { count: 0, skipped: 0, duplicates: 0, errors: [], cancelled: true };
      picked = r.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName || `RF_import_${Date.now()}.${a.type === "video" ? "mp4" : "jpg"}`,
        type: a.type === "video" ? "video" : "photo",
        w: a.width || 0,
        h: a.height || 0,
        duration: a.duration ? a.duration / 1000 : 0,
        time: parseExifDate(a.exif?.DateTimeOriginal) || parseExifDate(a.exif?.DateTimeDigitized) || parseExifDate(a.exif?.DateTime),
        assetId: a.assetId,
        size: a.fileSize,
        lastModified: (a as any).file?.lastModified,
      }));
    } else {
      const r = await DocumentPicker.getDocumentAsync({ type: ["image/*", "video/*"], multiple: true, copyToCacheDirectory: true });
      if (r.canceled) return { count: 0, skipped: 0, duplicates: 0, errors: [], cancelled: true };
      picked = r.assets.map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType?.startsWith("video") || /\.(mp4|mov|m4v|3gp|mkv|webm)$/i.test(a.name) ? "video" : "photo", w: 0, h: 0, duration: 0, time: (a as any).lastModified || 0, size: a.size }));
    }
  } catch (e: any) {
    throw new Error(`Couldn't open the ${method === "picker" ? "photo picker" : "file browser"}: ${e?.message || e}`);
  }

  const inGallery = new Set(getLibrary().items.map((i) => i.id));
  const known = new Set(getState().imported.map((i) => `${i.filename}|${i.width}x${i.height}`));
  let count = 0;
  let duplicates = 0;
  const errors: string[] = [];
  for (const a of picked) {
    try {
      if ((a.assetId && inGallery.has(a.assetId)) || (a.w && known.has(`${a.name}|${a.w}x${a.h}`))) {
        duplicates++;
        continue;
      }
      const item = await toImported(a);
      addImported(item);
      known.add(`${a.name}|${a.w}x${a.h}`);
      logEvent(item.id, "import", `Imported via ${method === "picker" ? "photo picker" : "file browser"} (${a.name})`);
      count++;
    } catch (e: any) {
      errors.push(`${a.name}: ${e?.message || e}`);
    }
  }
  setState((s) => ({ imports: [{ id: uid(), source: method === "picker" ? "Photo picker" : "File browser", method, count, skipped: errors.length + duplicates, errors, time: Date.now() }, ...s.imports].slice(0, 100) }));
  return { count, skipped: errors.length, duplicates, errors };
}

async function toImported(a: Picked): Promise<MediaItem> {
  const now = Date.now();
  const base = { id: "imp_" + uid(), filename: a.name, mediaType: a.type, width: a.w, height: a.h, creationTime: a.time || now, modificationTime: now, duration: a.duration, source: "imported" as const };
  if (Platform.OS === "web") return webImport(a, base);
  const uri = await keepInAppStorage(a.uri, a.name, a.type);
  const thumb = a.type === "video" ? await makeVideoThumb(uri) : undefined;
  return { ...base, uri, thumb };
}

// Web preview: small photos persist as data: URIs; large files and videos stay for this browser session only.
async function webImport(a: Picked, base0: Omit<MediaItem, "uri">): Promise<MediaItem> {
  let base = base0;
  const blob = await (await fetch(a.uri)).blob();
  if (!a.time && a.type === "photo") {
    const t = jpegExifDate(await blob.slice(0, 256 * 1024).arrayBuffer());
    if (t) base = { ...base, creationTime: t };
  }
  if (!a.time && base.creationTime === base.modificationTime && a.lastModified) base = { ...base, creationTime: a.lastModified };
  if (a.type === "video") {
    const meta = await webVideoMeta(a.uri).catch(() => null);
    return { ...base, uri: a.uri, thumb: meta?.thumb, duration: base.duration || meta?.duration || 0, width: base.width || meta?.w || 0, height: base.height || meta?.h || 0, session: true };
  }
  if (blob.size <= WEB_PERSIST_LIMIT * 0.74) {
    const data = await blobToDataUri(blob);
    return { ...base, uri: data };
  }
  return { ...base, uri: a.uri.startsWith("blob:") ? a.uri : URL.createObjectURL(blob), session: true };
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

function webVideoMeta(src: string): Promise<{ thumb?: string; duration: number; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    v.src = src;
    const t = setTimeout(() => reject(new Error("timeout")), 8000);
    v.onloadeddata = () => {
      v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
    };
    v.onseeked = () => {
      clearTimeout(t);
      try {
        const c = document.createElement("canvas");
        const scale = 320 / Math.max(v.videoWidth || 320, 1);
        c.width = Math.round((v.videoWidth || 320) * scale);
        c.height = Math.round((v.videoHeight || 180) * scale);
        c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
        resolve({ thumb: c.toDataURL("image/jpeg", 0.7), duration: v.duration || 0, w: v.videoWidth, h: v.videoHeight });
      } catch {
        resolve({ duration: v.duration || 0, w: v.videoWidth, h: v.videoHeight });
      }
    };
    v.onerror = () => {
      clearTimeout(t);
      reject(new Error("unsupported video"));
    };
  });
}

export function importSummary(r: ImportResult) {
  const parts = [`Imported ${r.count}`];
  if (r.duplicates) parts.push(`${r.duplicates} already in your gallery`);
  if (r.skipped) parts.push(`${r.skipped} failed`);
  return parts.join(" · ");
}

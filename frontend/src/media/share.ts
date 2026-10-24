// Sharing through the system share sheet. Android only lets expo-sharing read files inside the app's own
// folders, so gallery files are first copied into the cache (the root cause of "Share does nothing").
import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import * as FS from "expo-file-system/legacy";
import { MediaItem, uid } from "@/src/store";
import { localUriFor } from "./files";

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", "3gp": "video/3gpp", mkv: "video/x-matroska", webm: "video/webm" };
export function mimeFor(m: MediaItem) {
  const ext = (m.filename.split(".").pop() || "").toLowerCase();
  return MIME[ext] || (m.mediaType === "video" ? "video/mp4" : "image/jpeg");
}

async function shareableUri(m: MediaItem): Promise<string> {
  const src = await localUriFor(m.id, m.uri);
  if (Platform.OS !== "android") return src;
  const own = [FS.documentDirectory, FS.cacheDirectory].filter(Boolean) as string[];
  if (own.some((d) => src.startsWith(d))) return src;
  const dir = FS.cacheDirectory + "share/";
  await FS.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const safe = m.filename.replace(/[^\w.\-]+/g, "_") || `${uid()}.${m.mediaType === "video" ? "mp4" : "jpg"}`;
  const dest = `${dir}${uid()}_${safe}`;
  await FS.copyAsync({ from: src, to: dest });
  return dest;
}

function webDownload(m: MediaItem) {
  const a = document.createElement("a");
  a.href = m.uri;
  a.download = m.filename || "media";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function shareOne(m: MediaItem): Promise<"shared" | "downloaded"> {
  if (Platform.OS === "web") {
    try {
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      if (nav?.share && nav?.canShare) {
        const blob = await (await fetch(m.uri)).blob();
        const file = new File([blob], m.filename || "media", { type: blob.type || mimeFor(m) });
        if (nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], title: m.filename });
          return "shared";
        }
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return "shared";
    }
    webDownload(m);
    return "downloaded";
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this device");
  const uri = await shareableUri(m);
  await Sharing.shareAsync(uri, { mimeType: mimeFor(m), dialogTitle: `Share ${m.filename}` });
  return "shared";
}

// The system share sheet takes one file per call; several items are shared one after another.
export async function shareMany(items: MediaItem[], askNext: (i: number, n: number) => Promise<boolean>) {
  let done = 0;
  for (let i = 0; i < items.length; i++) {
    if (i > 0 && !(await askNext(i + 1, items.length))) break;
    await shareOne(items[i]);
    done++;
  }
  return done;
}

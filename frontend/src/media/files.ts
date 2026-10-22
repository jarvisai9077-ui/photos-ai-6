// Local filesystem + hashing helpers (expo-file-system legacy API).
import { Platform } from "react-native";
import * as FS from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import * as ML from "expo-media-library/legacy";

export { FS };
export const isWeb = Platform.OS === "web";

export async function ensureDir(path: string) {
  if (isWeb) return;
  const info = await FS.getInfoAsync(path);
  if (!info.exists) await FS.makeDirectoryAsync(path, { intermediates: true });
}

// Resolve a readable file:// uri for a device asset (Android returns file:// already; iOS needs localUri).
export async function localUriFor(id: string, uri: string): Promise<string> {
  if (isWeb || uri.startsWith("file://") || uri.startsWith("data:") || id.startsWith("imp_")) return uri;
  try {
    const info = await ML.getAssetInfoAsync(id);
    return info.localUri || uri;
  } catch {
    return uri;
  }
}

export async function fileSize(uri: string): Promise<number | null> {
  if (isWeb) {
    if (uri.startsWith("data:")) return Math.round((uri.length - uri.indexOf(",") - 1) * 0.75);
    return null;
  }
  try {
    const info = await FS.getInfoAsync(uri);
    return info.exists && "size" in info ? (info.size ?? null) : null;
  } catch {
    return null;
  }
}

export const MAX_HASH_BYTES = 40 * 1024 * 1024;

// Real SHA-256 over file bytes (base64-encoded content). Refuses very large files to protect low-RAM devices.
export async function sha256File(uri: string): Promise<string | null> {
  try {
    let b64: string;
    if (uri.startsWith("data:")) b64 = uri.slice(uri.indexOf(",") + 1);
    else if (isWeb) return null;
    else {
      const size = await fileSize(uri);
      if (size != null && size > MAX_HASH_BYTES) return null;
      b64 = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
    }
    return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, b64);
  } catch {
    return null;
  }
}

export const sha256Text = (t: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, t);

export function formatBytes(n: number | null | undefined) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}

export function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

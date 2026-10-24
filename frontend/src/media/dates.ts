// Date helpers shared by the gallery, picker, albums, search and memories so grouping is identical everywhere.
import { format, isSameDay, isToday, isYesterday } from "date-fns";
import { MediaItem } from "@/src/store";

// Capture time with a safe fallback (some files report 0 for DATE_TAKEN).
export const captureTime = (m: MediaItem) => m.creationTime || m.modificationTime || 0;

export function dayKey(t: number) {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// "Today", "Yesterday", otherwise "23 October 2026".
export function dayLabel(t: number) {
  if (!t) return "Unknown date";
  const d = new Date(t);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "d MMMM yyyy");
}

export const monthLabel = (t: number) => format(new Date(t), "MMMM yyyy");
export const sameDay = (a: number, b: number) => isSameDay(new Date(a), new Date(b));

// Newest first, stable for equal timestamps.
export function sortNewest(items: MediaItem[]) {
  return [...items].sort((a, b) => captureTime(b) - captureTime(a) || (a.id < b.id ? -1 : 1));
}

// EXIF "2024:10:23 18:04:11" -> epoch ms (local time). Returns 0 if not parseable.
export function parseExifDate(v: unknown): number {
  if (typeof v !== "string") return 0;
  const m = v.match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return 0;
  const t = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
  return Number.isFinite(t) && t > 0 ? t : 0;
}


// Minimal JPEG EXIF reader (DateTimeOriginal / DateTime) for files where the platform gives no EXIF (web picker).
export function jpegExifDate(buf: ArrayBuffer): number {
  try {
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xffd8) return 0;
    let o = 2;
    while (o + 4 < v.byteLength) {
      const marker = v.getUint16(o);
      const len = v.getUint16(o + 2);
      if (marker === 0xffe1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10; // TIFF header
        const le = v.getUint16(t) === 0x4949;
        const u16 = (p: number) => v.getUint16(p, le);
        const u32 = (p: number) => v.getUint32(p, le);
        const str = (p: number, n: number) => { let s = ""; for (let i = 0; i < n - 1; i++) s += String.fromCharCode(v.getUint8(p + i)); return s; };
        const scan = (ifd: number, want: number[]) => {
          const out: { tag: number; val: string | number }[] = [];
          const n = u16(t + ifd);
          for (let i = 0; i < n; i++) {
            const e = t + ifd + 2 + i * 12;
            const tag = u16(e);
            if (!want.includes(tag)) continue;
            const type = u16(e + 2);
            const cnt = u32(e + 4);
            out.push({ tag, val: type === 2 ? str(t + u32(e + 8), cnt) : u32(e + 8) });
          }
          return out;
        };
        const ifd0 = scan(u32(t + 4), [0x8769, 0x0132]);
        const exifPtr = ifd0.find((x) => x.tag === 0x8769)?.val as number | undefined;
        const orig = exifPtr ? scan(exifPtr, [0x9003])[0]?.val : undefined;
        return parseExifDate(orig) || parseExifDate(ifd0.find((x) => x.tag === 0x0132)?.val);
      }
      if ((marker & 0xff00) !== 0xff00) break;
      o += 2 + len;
    }
  } catch {
    // not a readable JPEG
  }
  return 0;
}

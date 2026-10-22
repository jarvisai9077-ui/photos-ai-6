// Local search engine: parses natural-language queries into filters over real indexed metadata.
import { getState, MediaItem } from "@/src/store";
import { isScreenshot, isScreenRecording } from "./library";

export type Match = { item: MediaItem; reasons: string[] };
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

type Range = { from: number; to: number; label: string };

function parseDate(q: string, now = new Date()): { range?: Range; rest: string } {
  let rest = q;
  const day = 86400000;
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const take = (re: RegExp, r: Range) => {
    rest = rest.replace(re, " ");
    return { range: r, rest };
  };
  if (/\btoday\b/.test(q)) return take(/\btoday\b/, { from: startOfDay, to: startOfDay + day, label: "today" });
  if (/\byesterday\b/.test(q)) return take(/\byesterday\b/, { from: startOfDay - day, to: startOfDay, label: "yesterday" });
  if (/\b(last|past) week\b/.test(q)) return take(/\b(last|past) week\b/, { from: startOfDay - 7 * day, to: startOfDay + day, label: "last 7 days" });
  if (/\b(last|past) month\b/.test(q)) return take(/\b(last|past) month\b/, { from: startOfDay - 30 * day, to: startOfDay + day, label: "last 30 days" });
  if (/\b(last|past) year\b/.test(q)) return take(/\b(last|past) year\b/, { from: new Date(now.getFullYear() - 1, 0, 1).getTime(), to: new Date(now.getFullYear(), 0, 1).getTime(), label: `${now.getFullYear() - 1}` });
  const mm = q.match(new RegExp(`\\b(last |this )?(${MONTHS.join("|")})( (\\d{4}))?\\b`));
  if (mm) {
    const mi = MONTHS.indexOf(mm[2]);
    let year = mm[4] ? parseInt(mm[4], 10) : now.getFullYear();
    if (!mm[4] && (mm[1]?.startsWith("last") || mi > now.getMonth())) year = mi >= now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
    return take(new RegExp(mm[0]), { from: new Date(year, mi, 1).getTime(), to: new Date(year, mi + 1, 1).getTime(), label: `${mm[2]} ${year}` });
  }
  const y = q.match(/\b(19|20)\d{2}\b/);
  if (y) {
    const yr = parseInt(y[0], 10);
    return take(new RegExp(`\\b${yr}\\b`), { from: new Date(yr, 0, 1).getTime(), to: new Date(yr + 1, 0, 1).getTime(), label: `${yr}` });
  }
  return { rest };
}

export function describeQuery(q: string) {
  return parse(q.toLowerCase());
}

function parse(q: string) {
  const { range, rest: r1 } = parseDate(q);
  let rest = r1;
  const flags: string[] = [];
  const flag = (re: RegExp, name: string) => {
    if (re.test(rest)) {
      flags.push(name);
      rest = rest.replace(re, " ");
    }
  };
  flag(/\bscreen ?recordings?\b/, "screenrec");
  flag(/\bscreenshots?\b/, "screenshot");
  flag(/\bvideos?\b|\bclips?\b/, "video");
  flag(/\bphotos?\b|\bpictures?\b|\bimages?\b/, "photo");
  flag(/\bportrait\b|\bvertical\b/, "portrait");
  flag(/\blandscape\b|\bhorizontal\b/, "landscape");
  flag(/\bsquare\b/, "square");
  flag(/\b(large|big|long)\b/, "large");
  flag(/\bfavou?rites?\b|\bstarred\b/, "fav");
  flag(/\barchived?\b/, "archived");
  flag(/\b(with|has) (notes?|annotations?)\b/, "noted");
  flag(/\b(edited|versions?)\b/, "edited");
  flag(/\bdocuments?\b|\breceipts?\b|\binvoices?\b|\bbills?\b/, "document");
  const words = rest
    .replace(/\b(from|in|of|the|a|an|my|show|find|all|containing|contains|with|and|taken|on)\b/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  return { range, flags, words };
}

export function searchMedia(items: MediaItem[], query: string): Match[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const { range, flags, words } = parse(q);
  const st = getState();
  const edited = new Set(st.versions.map((v) => v.outputId).filter(Boolean));
  const noted = new Set(st.annotations.map((a) => a.assetId));
  const out: Match[] = [];
  for (const it of items) {
    const meta = st.meta[it.id] || {};
    if (meta.archived && !flags.includes("archived")) continue;
    const reasons: string[] = [];
    if (range) {
      if (it.creationTime < range.from || it.creationTime >= range.to) continue;
      reasons.push(`date: ${range.label}`);
    }
    let ok = true;
    for (const f of flags) {
      const pass =
        (f === "video" && it.mediaType === "video") ||
        (f === "photo" && it.mediaType === "photo") ||
        (f === "screenshot" && isScreenshot(it)) ||
        (f === "screenrec" && isScreenRecording(it)) ||
        (f === "portrait" && it.height > it.width) ||
        (f === "landscape" && it.width > it.height) ||
        (f === "square" && it.width === it.height && it.width > 0) ||
        (f === "large" && (it.mediaType === "video" ? it.duration >= 60 : it.width * it.height >= 12e6)) ||
        (f === "fav" && !!meta.fav) ||
        (f === "archived" && !!meta.archived) ||
        (f === "noted" && (!!meta.note || noted.has(it.id))) ||
        (f === "edited" && edited.has(it.id)) ||
        f === "document";
      if (!pass) {
        ok = false;
        break;
      }
      if (f !== "document") reasons.push(f === "large" ? (it.mediaType === "video" ? "video ≥ 60s" : "≥ 12 MP") : f);
    }
    if (!ok) continue;
    for (const w of words) {
      const hay: [string, string][] = [
        ["filename", it.filename.toLowerCase()],
        ["tag", (meta.tags || []).join(" ").toLowerCase()],
        ["caption", (meta.caption || "").toLowerCase()],
      ];
      if (st.prefs.indexNotes) hay.push(["note", (meta.note || "").toLowerCase() + " " + st.annotations.filter((a) => a.assetId === it.id).map((a) => a.text.toLowerCase()).join(" ")]);
      const hit = hay.find(([, h]) => h.includes(w));
      if (!hit) {
        ok = false;
        break;
      }
      reasons.push(`${hit[0]} contains “${w}”`);
    }
    if (!ok) continue;
    if (flags.includes("document") && !words.length && !reasons.length) continue;
    out.push({ item: it, reasons });
  }
  return out;
}

export function searchDocuments(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/).filter((w) => w.length > 1 && !["documents", "document", "containing", "with"].includes(w));
  return getState().documents.filter((d) => words.length > 0 && words.every((w) => (d.title + " " + d.text + " " + d.tags.join(" ")).toLowerCase().includes(w)));
}

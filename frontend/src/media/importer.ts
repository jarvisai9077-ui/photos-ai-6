// Import from device storage / document providers, with an import source tracker.
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";
import { logEvent, setState, uid } from "@/src/store";
import { saveToLibrary } from "./library";

export async function importMedia(method: "picker" | "documents"): Promise<{ count: number; skipped: number; errors: string[] }> {
  let assets: { uri: string; name: string; type: "photo" | "video"; w: number; h: number }[] = [];
  if (method === "picker") {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], allowsMultipleSelection: true, quality: 1, base64: false });
    if (r.canceled) return { count: 0, skipped: 0, errors: [] };
    assets = r.assets.map((a) => ({ uri: a.uri, name: a.fileName || `import_${Date.now()}.jpg`, type: a.type === "video" ? "video" : "photo", w: a.width, h: a.height }));
  } else {
    const r = await DocumentPicker.getDocumentAsync({ type: ["image/*", "video/*"], multiple: true, copyToCacheDirectory: true });
    if (r.canceled) return { count: 0, skipped: 0, errors: [] };
    assets = r.assets.map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType?.startsWith("video") ? "video" : "photo", w: 0, h: 0 }));
  }
  let count = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const a of assets) {
    try {
      // On web the picker may return a blob: uri that dies on reload, convert to data: so it persists locally.
      let uri = a.uri;
      if (Platform.OS === "web" && uri.startsWith("blob:")) uri = await blobToDataUri(uri);
      const item = await saveToLibrary(uri, a.name, a.type, a.w, a.h);
      logEvent(item.id, "import", `Imported via ${method === "picker" ? "photo picker" : "document provider"} (${a.name})`);
      count++;
    } catch (e: any) {
      skipped++;
      errors.push(`${a.name}: ${e?.message || e}`);
    }
  }
  setState((s) => ({ imports: [{ id: uid(), source: method === "picker" ? "Photo picker" : "Document provider", method, count, skipped, errors, time: Date.now() }, ...s.imports] }));
  return { count, skipped, errors };
}

async function blobToDataUri(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  return await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

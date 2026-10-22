// Privacy Export Shield: inspect metadata → re-encode clean copy → verify output → share.
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeedback } from "@/src/components/feedback";
import { getBatch } from "@/src/components/SelectionBar";
import { Badge, Button, Card, Header, Screen, Body } from "@/src/components/ui";
import { localUriFor } from "@/src/media/files";
import { assetInfo, saveToLibrary } from "@/src/media/library";
import { pickMedia } from "@/src/media/picker";
import { logEvent, MediaItem } from "@/src/store";
import { makeStyles, radius, spacing } from "@/src/theme";

type Row = { item: MediaItem; hasGps: boolean | null; exifKeys: number | null; out?: { uri: string; verified: string; ok: boolean } };

export default function PrivacyExport() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const fb = useFeedback();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async (items: MediaItem[]) => {
    const out: Row[] = [];
    for (const it of items.filter((i) => i.mediaType === "photo")) {
      const info = await assetInfo(it.id);
      out.push({ item: it, hasGps: info ? !!info.location : null, exifKeys: info?.exif ? Object.keys(info.exif).length : null });
    }
    setRows(out);
  };
  useEffect(() => { load(getBatch()); }, []);

  const run = async () => {
    setBusy(true);
    const next = [...rows];
    for (let i = 0; i < next.length; i++) {
      const r = next[i];
      try {
        const clean = await manipulateAsync(await localUriFor(r.item.id, r.item.uri), [], { format: SaveFormat.JPEG, compress: 0.95 });
        const saved = await saveToLibrary(clean.uri, r.item.filename.replace(/\.\w+$/, "") + "_clean.jpg", "photo", clean.width, clean.height);
        const info = await assetInfo(saved.id);
        let verified = "Saved (verification of EXIF needs the Android media library)";
        let ok = true;
        if (info) {
          const gps = info.location || Object.keys(info.exif || {}).some((k) => /gps/i.test(k));
          ok = !gps;
          verified = gps ? "WARNING: location still present in output" : `Verified: no location in output (${Object.keys(info.exif || {}).length} EXIF fields remain)`;
        }
        logEvent(r.item.id, "export", `Privacy export: ${verified}`);
        next[i] = { ...r, out: { uri: saved.uri, verified, ok } };
      } catch (e: any) {
        next[i] = { ...r, out: { uri: "", verified: `Failed: ${e?.message || e}`, ok: false } };
      }
      setRows([...next]);
    }
    setBusy(false);
    fb.toast("Clean copies created — originals unchanged", "success");
  };

  return (
    <Screen>
      <Header title="Privacy Export Shield" subtitle="Remove location & camera metadata before sharing" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
        <Body muted>RF Photos re-encodes each photo into a new JPEG, which drops EXIF (GPS, camera serials, timestamps embedded in the file). The output is then re-read and checked. Your original is never modified.</Body>
        <Button testID="privacy-export-pick" label={rows.length ? "Change photos" : "Choose photos"} icon="images-outline" variant="secondary" onPress={async () => load(await pickMedia({ type: "photo", max: 30, title: "Photos to clean" }))} />
        {rows.map((r, i) => (
          <Card key={r.item.id} testID={`privacy-row-${i}`} style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={st.thumb}><Image source={{ uri: r.item.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" /></View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={st.name} numberOfLines={1}>{r.item.filename}</Text>
              <Badge label={r.hasGps === null ? "Metadata unreadable here" : r.hasGps ? "Contains location" : "No location"} kind={r.hasGps ? "warning" : "info"} />
              {r.exifKeys !== null && <Body muted>{r.exifKeys} EXIF fields in original</Body>}
              {r.out && <Body testID={`privacy-verified-${i}`} style={{ fontWeight: "600" }}>{r.out.verified}</Body>}
              {r.out?.uri ? <Button testID={`privacy-share-${i}`} label="Share clean copy" variant="secondary" style={{ minHeight: 36 }} onPress={async () => (await Sharing.isAvailableAsync()) ? Sharing.shareAsync(r.out!.uri) : fb.toast("Sharing unavailable", "error")} /> : null}
            </View>
          </Card>
        ))}
        {rows.length > 0 && <Button testID="privacy-export-run" label={`Create ${rows.length} clean copies`} icon="shield-checkmark" loading={busy} onPress={run} />}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  thumb: { width: 64, height: 64, borderRadius: radius.md, overflow: "hidden", backgroundColor: c.surfaceTertiary },
  name: { color: c.onSurface, fontWeight: "700" },
}));

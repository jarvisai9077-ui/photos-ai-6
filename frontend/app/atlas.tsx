// Visual Travel Atlas: groups media by EXIF location (user-permitted). Shows coordinates; never infers place names.
import React, { useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeedback } from "@/src/components/feedback";
import { openViewer } from "@/src/components/MediaGrid";
import { Button, EmptyState, Header, Press, Progress, Screen, Body } from "@/src/components/ui";
import { placeClusters } from "@/src/media/analysis";
import { assetInfo, deviceLibraryAvailable, useAllMedia } from "@/src/media/library";
import { setState, useStore } from "@/src/store";
import { storage } from "@/src/utils/storage";
import { makeStyles, radius, spacing } from "@/src/theme";

export default function Atlas() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const fb = useFeedback();
  const all = useAllMedia();
  const loc = useStore((s) => s.locIndex);
  const enabled = useStore((s) => s.prefs.indexLocation);
  const [prog, setProg] = useState<number | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const cancel = useRef(false);
  const clusters = useMemo(() => placeClusters(all, loc), [all, loc]);
  React.useEffect(() => { storage.getItem<string>("rf_place_labels", "{}").then((v) => setLabels(JSON.parse(v || "{}"))); }, []);

  const scan = async () => {
    if (!enabled) return fb.toast("Location indexing is off in Privacy Center", "info");
    cancel.current = false;
    const photos = all.filter((m) => m.source === "device" && !(m.id in loc)).slice(0, 500);
    const found: Record<string, { lat: number; lng: number }> = {};
    for (let i = 0; i < photos.length; i++) {
      if (cancel.current) break;
      const info = await assetInfo(photos[i].id);
      if (info?.location) found[photos[i].id] = { lat: info.location.latitude, lng: info.location.longitude };
      if (i % 10 === 0 || i === photos.length - 1) setProg((i + 1) / photos.length);
    }
    setState((s) => ({ locIndex: { ...s.locIndex, ...found } }));
    setProg(null);
    fb.toast(`${Object.keys(found).length} of ${photos.length} scanned items had location`, "success");
  };
  const label = async (k: string) => {
    const v = await fb.prompt({ title: "Label this place", message: "Your own label, stored locally.", initial: labels[k] || "" });
    if (v === null) return;
    const next = { ...labels, [k]: v };
    setLabels(next);
    storage.setItem("rf_place_labels", JSON.stringify(next));
  };

  return (
    <Screen>
      <Header title="Travel Atlas" subtitle={`${Object.keys(loc).length} located items · ${clusters.length} places`} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
        <Body muted>Places are ~1 km clusters of GPS coordinates stored in your photos. No map tiles or geocoding services are contacted, so places show coordinates or your own labels.</Body>
        {prog !== null ? (
          <View style={{ gap: spacing.sm }}><Progress value={prog} /><Button testID="atlas-cancel" label="Stop" variant="ghost" onPress={() => (cancel.current = true)} /></View>
        ) : (
          <Button testID="atlas-scan-button" label="Scan location metadata (500 at a time)" icon="locate-outline" onPress={scan} disabled={!deviceLibraryAvailable} />
        )}
        {clusters.length === 0 && <EmptyState testID="atlas-empty" icon="map-outline" tint="pastelMint" title="No places yet" message={deviceLibraryAvailable ? "Scan to read GPS from your photos." : "Location metadata is read from the Android media library."} />}
        {clusters.map((c) => {
          const k = `${c.lat},${c.lng}`;
          return (
            <View key={k} style={st.card} testID={`place-${k}`}>
              <Press testID={`place-open-${k}`} onPress={() => openViewer(c.items, 0)} style={st.thumb}><Image source={{ uri: c.items[0].uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" /></Press>
              <View style={{ flex: 1 }}>
                <Text style={st.title}>{labels[k] || `${c.lat.toFixed(2)}°, ${c.lng.toFixed(2)}°`}</Text>
                <Body muted>{c.items.length} items · {new Date(Math.min(...c.items.map((i) => i.creationTime))).toLocaleDateString()} – {new Date(Math.max(...c.items.map((i) => i.creationTime))).toLocaleDateString()}</Body>
                <Press testID={`place-label-${k}`} onPress={() => label(k)}><Text style={st.link}>{labels[k] ? "Edit label" : "Add label"}</Text></Press>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  card: { flexDirection: "row", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, alignItems: "center" },
  thumb: { width: 72, height: 72, borderRadius: radius.md, overflow: "hidden", backgroundColor: c.surfaceTertiary },
  title: { color: c.onSurface, fontWeight: "700", fontSize: 16 },
  link: { color: c.brandPrimary, fontWeight: "600", marginTop: 4 },
}));

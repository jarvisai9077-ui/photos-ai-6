import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge, Button, Card, Header, Screen, SectionTitle, Body } from "@/src/components/ui";
import { assetInfo, findItem } from "@/src/media/library";
import { fileSize, formatBytes, formatDuration, localUriFor, sha256File } from "@/src/media/files";
import { setState, useStore } from "@/src/store";
import { makeStyles, spacing } from "@/src/theme";

function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a; }

export default function Inspector() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const item = findItem(id);
  const allVersions = useStore((s) => s.versions);
  const allEvents = useStore((s) => s.events);
  const versions = useMemo(() => allVersions.filter((v) => v.sourceId === id || v.outputId === id), [allVersions, id]);
  const events = useMemo(() => allEvents.filter((e) => e.assetId === id), [allEvents, id]);
  const indexLoc = useStore((s) => s.prefs.indexLocation);
  const [info, setInfo] = useState<any>(null);
  const [size, setSize] = useState<number | null>(null);
  const [hash, setHash] = useState<string | null | undefined>(undefined);
  const [hashing, setHashing] = useState(false);

  useEffect(() => {
    if (!item) return;
    assetInfo(item.id).then((i) => {
      setInfo(i);
      if (i?.location && indexLoc) setState((s) => ({ locIndex: { ...s.locIndex, [item.id]: { lat: i.location!.latitude, lng: i.location!.longitude } } }));
    });
    localUriFor(item.id, item.uri).then(fileSize).then(setSize);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return <Screen><Header title="Inspector" /><Body muted style={{ padding: spacing.lg }}>Media not found — it may have been moved or deleted.</Body></Screen>;

  const exif: Record<string, any> = info?.exif || {};
  const g = gcd(item.width, item.height) || 1;
  const rows: [string, string][] = [
    ["Filename", item.filename],
    ["Reference", info?.localUri || item.uri.slice(0, 80)],
    ["Type", item.mediaType],
    ["Format", (item.filename.split(".").pop() || "?").toUpperCase()],
    ["Resolution", `${item.width} × ${item.height}${item.width ? ` (${((item.width * item.height) / 1e6).toFixed(1)} MP)` : ""}`],
    ["Aspect ratio", item.width ? `${item.width / g}:${item.height / g}` : "—"],
    ["Orientation", item.width === item.height ? "square" : item.width > item.height ? "landscape" : "portrait"],
    ["File size", formatBytes(size)],
    ["Captured", item.creationTime ? new Date(item.creationTime).toLocaleString() : "—"],
    ["Modified", item.modificationTime ? new Date(item.modificationTime).toLocaleString() : "—"],
    ["Source", item.source === "device" ? "Device MediaStore" : "Imported into RF Photos"],
  ];
  if (item.mediaType === "video") rows.push(["Duration", formatDuration(item.duration)]);
  const ex = (k: string, label: string, fmt?: (v: any) => string) => exif[k] != null && rows.push([label, fmt ? fmt(exif[k]) : String(exif[k])]);
  ex("Make", "Camera make"); ex("Model", "Camera model"); ex("LensModel", "Lens"); ex("ISOSpeedRatings", "ISO"); ex("ExposureTime", "Shutter", (v) => (v < 1 ? `1/${Math.round(1 / v)} s` : `${v} s`)); ex("FNumber", "Aperture", (v) => `f/${v}`); ex("FocalLength", "Focal length", (v) => `${v} mm`); ex("ColorSpace", "Colour space"); ex("Flash", "Flash");
  if (info?.location) rows.push(["GPS", `${info.location.latitude.toFixed(5)}, ${info.location.longitude.toFixed(5)}`]);

  const doHash = async () => {
    setHashing(true);
    setHash(await sha256File(await localUriFor(item.id, item.uri)));
    setHashing(false);
  };

  return (
    <Screen>
      <Header title="Media Inspector" subtitle={item.filename} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}>
        <Card testID="inspector-details">
          {rows.map(([k, v]) => (
            <View key={k} style={st.kv}><Text style={st.k}>{k}</Text><Text style={st.v} selectable>{v}</Text></View>
          ))}
          {!info && item.source === "device" && <Body muted>Loading EXIF…</Body>}
          {item.source === "imported" && <Body muted>EXIF is not available for imported web files.</Body>}
        </Card>
        <Card>
          <Text style={st.cardTitle}>Integrity hash (SHA-256)</Text>
          <Body muted testID="inspector-hash" style={{ marginVertical: spacing.sm }}>{hash === undefined ? "Not computed yet. Hashing reads the full file locally." : hash === null ? "Hash unavailable (file too large for in-memory hashing or not readable)." : hash}</Body>
          <Button testID="inspector-hash-button" label="Compute hash" icon="finger-print" variant="secondary" loading={hashing} onPress={doHash} />
        </Card>
        <SectionTitle title="Visual Time Machine" />
        <Card testID="inspector-versions">
          {versions.length === 0 ? <Body muted>No edited versions exist for this item.</Body> : versions.map((v) => (
            <View key={v.id} style={st.kv}><Text style={st.k}>{new Date(v.time).toLocaleString()}</Text><Text style={st.v}>{v.sourceId === id ? "Edited copy → " : "Edited from original: "}{v.ops.join(", ")}</Text></View>
          ))}
          {versions.length > 0 && <Button testID="inspector-compare-button" label="Open Before/After Lab" variant="secondary" onPress={() => router.push({ pathname: "/timemachine", params: { id } })} style={{ marginTop: spacing.sm }} />}
        </Card>
        <SectionTitle title="Provenance log" />
        <Card>
          {events.length === 0 ? <Body muted>No import/edit/export events recorded by RF Photos for this item.</Body> : events.map((e) => (
            <View key={e.id} style={st.kv}><Badge label={e.kind} kind="brand" /><Text style={[st.v, { marginLeft: spacing.sm }]}>{e.detail} · {new Date(e.time).toLocaleString()}</Text></View>
          ))}
          <Body muted style={{ marginTop: spacing.sm }}>Metadata and hashes describe the file; they do not prove authenticity.</Body>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  kv: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: c.divider, alignItems: "center" },
  k: { color: c.muted, fontSize: 13, width: 110 },
  v: { color: c.onSurface, fontSize: 13, flex: 1 },
  cardTitle: { color: c.onSurface, fontWeight: "700", fontSize: 16 },
}));

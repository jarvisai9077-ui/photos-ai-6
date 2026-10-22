// Visual Time Machine + Smart Before/After Lab: compare original vs saved versions (slider / side-by-side).
import React, { useMemo, useState } from "react";
import { PanResponder, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chip, ChipRow, EmptyState, Header, Press, Screen, Body } from "@/src/components/ui";
import { findItem } from "@/src/media/library";
import { useStore, Version } from "@/src/store";
import { makeStyles, radius, spacing } from "@/src/theme";

export default function TimeMachine() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const { width } = useWindowDimensions();
  const versions = useStore((s) => s.versions);
  const list = useMemo(() => (id ? versions.filter((v) => v.sourceId === id || v.outputId === id) : versions), [versions, id]);
  const [cur, setCur] = useState<Version | null>(list[0] || null);
  const [mode, setMode] = useState<"slider" | "side">("slider");
  const [split, setSplit] = useState(0.5);
  const W = Math.min(width - spacing.lg * 2, 700);
  const H = W;
  const pr = useMemo(() => PanResponder.create({ onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderGrant: (e) => setSplit(Math.max(0, Math.min(1, e.nativeEvent.locationX / W))), onPanResponderMove: (e) => setSplit(Math.max(0, Math.min(1, e.nativeEvent.locationX / W))) }), [W]);
  const orig = cur ? findItem(cur.sourceId) : undefined;

  return (
    <Screen>
      <Header title="Before / After Lab" subtitle={`${list.length} version(s) recorded`} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
        {!cur ? (
          <EmptyState testID="timemachine-empty" icon="git-compare-outline" title="No versions yet" message="Every edit you save in the Editor or Batch Pipeline creates a new version here. Originals are always kept." action="Open editor" onAction={() => router.push("/editor")} />
        ) : (
          <>
            <ChipRow>
              <Chip testID="compare-mode-slider" label="Slider" active={mode === "slider"} onPress={() => setMode("slider")} />
              <Chip testID="compare-mode-side" label="Side by side" active={mode === "side"} onPress={() => setMode("side")} />
            </ChipRow>
            {!orig && <Body muted>The original file is no longer in the library (moved or deleted) — showing the edited version only.</Body>}
            {mode === "slider" ? (
              <View testID="compare-slider" style={[st.stage, { width: W, height: H }]} {...pr.panHandlers}>
                <Image source={{ uri: cur.outputUri }} style={{ width: W, height: H }} contentFit="contain" />
                {orig && <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: W * split, overflow: "hidden" }} pointerEvents="none"><Image source={{ uri: orig.uri }} style={{ width: W, height: H }} contentFit="contain" /></View>}
                <View style={[st.handle, { left: W * split - 1 }]} pointerEvents="none" />
                <Text style={[st.tag, { left: 8 }]}>BEFORE</Text>
                <Text style={[st.tag, { right: 8 }]}>AFTER</Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 4 }}>
                {[orig?.uri, cur.outputUri].map((u, i) => <View key={i} style={[st.stage, { width: (W - 4) / 2, height: (W - 4) / 2 }]}>{u ? <Image source={{ uri: u }} style={{ width: "100%", height: "100%" }} contentFit="contain" /> : null}<Text style={[st.tag, { left: 6 }]}>{i ? "AFTER" : "BEFORE"}</Text></View>)}
              </View>
            )}
            <Body>Edits: {cur.ops.join(", ")}</Body>
            <Body muted>Source: {cur.sourceName} · saved {new Date(cur.time).toLocaleString()}</Body>
            {orig && <Press testID="compare-open-original" onPress={() => router.push({ pathname: "/editor", params: { id: orig.id } })}><Text style={st.link}>Re-edit from original</Text></Press>}
          </>
        )}
        {list.length > 0 && <Text style={st.h}>Version timeline</Text>}
        {list.map((v) => (
          <Press key={v.id} testID={`version-${v.id}`} onPress={() => setCur(v)} style={[st.row, cur?.id === v.id && st.rowOn]}>
            <View style={st.thumb}><Image source={{ uri: v.outputUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" /></View>
            <View style={{ flex: 1 }}><Text style={st.name} numberOfLines={1}>{v.sourceName}</Text><Body muted numberOfLines={1}>{new Date(v.time).toLocaleString()} · {v.ops.join(", ")}</Body></View>
          </Press>
        ))}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  stage: { backgroundColor: "#000000", borderRadius: radius.md, overflow: "hidden" },
  handle: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: c.brandPrimary },
  tag: { position: "absolute", top: 8, color: "#FFFFFF", fontSize: 11, fontWeight: "800", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  h: { color: c.onSurface, fontWeight: "700", fontSize: 18, marginTop: spacing.md },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm, borderWidth: 2, borderColor: "transparent" },
  rowOn: { borderColor: c.brandPrimary },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, overflow: "hidden", backgroundColor: c.surfaceTertiary },
  name: { color: c.onSurface, fontWeight: "600" },
  link: { color: c.brandPrimary, fontWeight: "700" },
}));

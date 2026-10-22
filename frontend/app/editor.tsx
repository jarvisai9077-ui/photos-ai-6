import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, useWindowDimensions, View, PanResponder } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { manipulateAsync, FlipType, SaveFormat, Action } from "expo-image-manipulator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeedback } from "@/src/components/feedback";
import { Ionicons, Press, Button, Body } from "@/src/components/ui";
import { findItem, saveToLibrary } from "@/src/media/library";
import { localUriFor } from "@/src/media/files";
import { pickMedia } from "@/src/media/picker";
import { ColorStage, renderColor, colorEngine } from "@/src/editor/ColorStage";
import { Adjust, adjustMatrix, FILTERS, isIdentity, mul, ZERO } from "@/src/editor/matrix";
import { logEvent, MediaItem, setState, uid } from "@/src/store";
import { makeStyles, radius, spacing } from "@/src/theme";

type Geo = { rotate: number; flipH: boolean; flipV: boolean; ratio: string; resize: number };
type EditState = { geo: Geo; adj: Adjust; filter: string };
const INIT: EditState = { geo: { rotate: 0, flipH: false, flipV: false, ratio: "free", resize: 0 }, adj: ZERO, filter: "none" };
const RATIOS = ["free", "1:1", "4:5", "3:4", "9:16", "16:9", "3:2"];
const ADJ: { key: keyof Adjust; label: string }[] = [
  { key: "exposure", label: "Exposure" }, { key: "brightness", label: "Brightness" }, { key: "contrast", label: "Contrast" },
  { key: "saturation", label: "Saturation" }, { key: "temperature", label: "Temperature" }, { key: "tint", label: "Tint" }, { key: "fade", label: "Fade" },
];

function Slider({ value, onChange, testID }: { value: number; onChange: (v: number) => void; testID: string }) {
  const st = useStyles();
  const [w, setW] = useState(1);
  const pr = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => onChange(Math.max(-1, Math.min(1, (e.nativeEvent.locationX / w) * 2 - 1))),
    onPanResponderMove: (e) => onChange(Math.max(-1, Math.min(1, (e.nativeEvent.locationX / w) * 2 - 1))),
  }), [w, onChange]);
  return (
    <View testID={testID} style={st.slider} onLayout={(e) => setW(e.nativeEvent.layout.width)} {...pr.panHandlers}>
      <View style={st.track} pointerEvents="none" />
      <View style={[st.fill, { left: value >= 0 ? "50%" : `${((value + 1) / 2) * 100}%`, width: `${(Math.abs(value) / 2) * 100}%` }]} pointerEvents="none" />
      <View style={[st.knob, { left: `${((value + 1) / 2) * 100}%` }]} pointerEvents="none" />
    </View>
  );
}

function geoActions(g: Geo, w: number, h: number): Action[] {
  const acts: Action[] = [];
  if (g.rotate) acts.push({ rotate: g.rotate });
  if (g.flipH) acts.push({ flip: FlipType.Horizontal });
  if (g.flipV) acts.push({ flip: FlipType.Vertical });
  const rw = g.rotate % 180 ? h : w;
  const rh = g.rotate % 180 ? w : h;
  if (g.ratio !== "free" && rw && rh) {
    const [a, b] = g.ratio.split(":").map(Number);
    const target = a / b;
    let cw = rw, ch = Math.round(rw / target);
    if (ch > rh) { ch = rh; cw = Math.round(rh * target); }
    acts.push({ crop: { originX: Math.round((rw - cw) / 2), originY: Math.round((rh - ch) / 2), width: cw, height: ch } });
  }
  if (g.resize) acts.push({ resize: { width: g.resize } });
  return acts;
}

export default function Editor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const st = useStyles();
  const fb = useFeedback();
  const [src, setSrc] = useState<MediaItem | undefined>(id ? findItem(id) : undefined);
  const [srcUri, setSrcUri] = useState<string | null>(null);
  const [geoUri, setGeoUri] = useState<string | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [hist, setHist] = useState<EditState[]>([INIT]);
  const [pos, setPos] = useState(0);
  const [tab, setTab] = useState<"crop" | "adjust" | "filters">("adjust");
  const [adjKey, setAdjKey] = useState<keyof Adjust>("exposure");
  const [before, setBefore] = useState(false);
  const [busy, setBusy] = useState(false);
  const cur = hist[pos];

  useEffect(() => {
    if (!src) return;
    localUriFor(src.id, src.uri).then(async (u) => {
      setSrcUri(u);
      try {
        const r = await manipulateAsync(u, [], { format: SaveFormat.JPEG, compress: 1 });
        setDims({ w: r.width, h: r.height });
      } catch {
        setDims({ w: src.width, h: src.height });
      }
    });
  }, [src]);

  useEffect(() => {
    if (!srcUri || !dims.w) return;
    const acts = geoActions(cur.geo, dims.w, dims.h);
    if (!acts.length) { setGeoUri(srcUri); return; }
    let live = true;
    manipulateAsync(srcUri, acts.map((a) => ("resize" in a ? { resize: { width: Math.min(1400, (a as any).resize.width) } } : a)), { format: SaveFormat.JPEG, compress: 0.9 })
      .then((r) => live && setGeoUri(r.uri))
      .catch((e) => fb.toast(`Geometry failed: ${e?.message || e}`, "error"));
    return () => { live = false; };
  }, [srcUri, dims, cur.geo]); // eslint-disable-line react-hooks/exhaustive-deps

  const matrix = useMemo(() => mul(adjustMatrix(cur.adj), FILTERS.find((f) => f.id === cur.filter)!.m), [cur.adj, cur.filter]);
  const push = (patch: Partial<EditState>, merge = false) => {
    const next = { ...cur, ...patch };
    if (merge && pos > 0) { setHist([...hist.slice(0, pos), next]); return; }
    setHist([...hist.slice(0, pos + 1), next].slice(-60));
    setPos(Math.min(pos + 1, 59));
  };
  const opsList = () => {
    const o: string[] = [];
    if (cur.geo.rotate) o.push(`rotate ${cur.geo.rotate}°`);
    if (cur.geo.flipH) o.push("flip H");
    if (cur.geo.flipV) o.push("flip V");
    if (cur.geo.ratio !== "free") o.push(`crop ${cur.geo.ratio}`);
    if (cur.geo.resize) o.push(`resize ${cur.geo.resize}px`);
    ADJ.forEach((a) => cur.adj[a.key] && o.push(`${a.label.toLowerCase()} ${(cur.adj[a.key] * 100).toFixed(0)}`));
    if (cur.filter !== "none") o.push(`filter ${cur.filter}`);
    return o;
  };

  const save = async () => {
    if (!src || !srcUri) return;
    const ops = opsList();
    if (!ops.length) return fb.toast("No edits to save", "info");
    setBusy(true);
    try {
      const full = await manipulateAsync(srcUri, geoActions(cur.geo, dims.w, dims.h), { format: SaveFormat.JPEG, compress: 0.95 });
      let out = full.uri;
      if (!isIdentity(matrix)) out = await renderColor(full.uri, matrix);
      const name = src.filename.replace(/\.\w+$/, "") + `_rfedit_${Date.now()}.jpg`;
      const saved = await saveToLibrary(out, name, "photo", full.width, full.height);
      setState((s) => ({ versions: [{ id: uid(), sourceId: src.id, sourceName: src.filename, outputId: saved.id, outputUri: saved.uri, ops, time: Date.now() }, ...s.versions] }));
      logEvent(src.id, "edit", `Edited copy saved: ${ops.join(", ")}`);
      logEvent(saved.id, "edit", `Created from ${src.filename}`);
      fb.toast("Saved as a new copy — original untouched", "success");
      router.back();
    } catch (e: any) {
      fb.toast(`Save failed: ${e?.message || e}`, "error");
    } finally {
      setBusy(false);
    }
  };

  if (!src) {
    return (
      <View style={[st.root, { paddingTop: insets.top + spacing.xl, padding: spacing.xl, gap: spacing.lg }]}>
        <Text style={st.title}>Photo Editor</Text>
        <Body style={{ color: "#C7C7CC" }}>Pick a photo to edit. Edits are non-destructive: RF Photos always saves a new copy and records the version.</Body>
        <Button testID="editor-pick-button" label="Choose photo" icon="images-outline" onPress={async () => { const r = await pickMedia({ max: 1, type: "photo", title: "Choose a photo" }); if (r[0]) setSrc(r[0]); }} />
        <Button testID="editor-close-button" label="Close" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  const stageH = height - insets.top - insets.bottom - 280;
  return (
    <View style={st.root} testID="editor-screen">
      <View style={[st.top, { paddingTop: insets.top + spacing.sm }]}>
        <Press testID="editor-cancel-button" onPress={() => router.back()} style={st.icon}><Ionicons name="close" size={24} color="#FFFFFF" /></Press>
        <Press testID="editor-undo-button" disabled={pos === 0} onPress={() => setPos(pos - 1)} style={st.icon}><Ionicons name="arrow-undo" size={22} color="#FFFFFF" /></Press>
        <Press testID="editor-redo-button" disabled={pos >= hist.length - 1} onPress={() => setPos(pos + 1)} style={st.icon}><Ionicons name="arrow-redo" size={22} color="#FFFFFF" /></Press>
        <Press testID="editor-reset-button" onPress={() => push(INIT)} style={st.icon}><Ionicons name="refresh" size={22} color="#FFFFFF" /></Press>
        <Press testID="editor-before-after-button" onPress={() => setBefore((b) => !b)} style={[st.icon, before && { backgroundColor: "#FF5E00" }]}><Ionicons name="contrast" size={22} color="#FFFFFF" /></Press>
        <View style={{ flex: 1 }} />
        <Press testID="editor-save-button" onPress={save} disabled={busy} style={st.save}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={st.saveText}>Save copy</Text>}</Press>
      </View>
      <View style={[st.stage, { height: stageH }]}>
        {!geoUri ? <ActivityIndicator color="#FF5E00" /> : before ? <Image source={{ uri: srcUri! }} style={{ width, height: stageH }} contentFit="contain" /> : <ColorStage uri={geoUri} w={width} h={stageH} matrix={matrix} />}
        {before && <Text style={st.beforeLabel}>ORIGINAL</Text>}
      </View>
      <View style={[st.panel, { paddingBottom: insets.bottom + spacing.sm }]}>
        {tab === "adjust" && (
          <View style={{ gap: spacing.sm }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
              {ADJ.map((a) => (
                <Press key={a.key} testID={`adjust-${a.key}`} onPress={() => setAdjKey(a.key)} style={[st.pill, adjKey === a.key && st.pillOn]}>
                  <Text style={st.pillText}>{a.label}{cur.adj[a.key] ? ` ${Math.round(cur.adj[a.key] * 100)}` : ""}</Text>
                </Press>
              ))}
            </ScrollView>
            <View style={{ paddingHorizontal: spacing.xl }}>
              <Slider testID="adjust-slider" value={cur.adj[adjKey]} onChange={(v) => push({ adj: { ...cur.adj, [adjKey]: Math.round(v * 100) / 100 } }, hist.length > 1 && JSON.stringify(Object.keys(cur.adj).filter((k) => cur.adj[k as keyof Adjust] !== hist[Math.max(0, pos - 1)].adj[k as keyof Adjust])) === JSON.stringify([adjKey]))} />
              <Text style={st.engine}>Colour engine: {colorEngine} · preview approximates final output</Text>
            </View>
          </View>
        )}
        {tab === "filters" && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
            {FILTERS.map((f) => (
              <Press key={f.id} testID={`filter-preset-${f.id}`} onPress={() => push({ filter: f.id })} style={[st.pill, cur.filter === f.id && st.pillOn]}>
                <Text style={st.pillText}>{f.name}</Text>
              </Press>
            ))}
          </ScrollView>
        )}
        {tab === "crop" && (
          <View style={{ gap: spacing.sm }}>
            <View style={st.cropRow}>
              <Press testID="crop-rotate-button" onPress={() => push({ geo: { ...cur.geo, rotate: (cur.geo.rotate + 90) % 360 } })} style={st.tool}><Ionicons name="refresh-circle-outline" size={24} color="#FFFFFF" /><Text style={st.toolText}>Rotate</Text></Press>
              <Press testID="crop-fliph-button" onPress={() => push({ geo: { ...cur.geo, flipH: !cur.geo.flipH } })} style={st.tool}><Ionicons name="swap-horizontal" size={24} color="#FFFFFF" /><Text style={st.toolText}>Flip H</Text></Press>
              <Press testID="crop-flipv-button" onPress={() => push({ geo: { ...cur.geo, flipV: !cur.geo.flipV } })} style={st.tool}><Ionicons name="swap-vertical" size={24} color="#FFFFFF" /><Text style={st.toolText}>Flip V</Text></Press>
              <Press testID="crop-resize-button" onPress={async () => { const v = await fb.prompt({ title: "Output width (px)", message: `Current width ${dims.w}px. Height keeps the aspect ratio. Empty = original.`, placeholder: "e.g. 2048", initial: cur.geo.resize ? String(cur.geo.resize) : "" }); const n = parseInt(v || "0", 10); push({ geo: { ...cur.geo, resize: n > 0 ? n : 0 } }); }} style={st.tool}><Ionicons name="resize" size={24} color="#FFFFFF" /><Text style={st.toolText}>{cur.geo.resize ? `${cur.geo.resize}px` : "Resize"}</Text></Press>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
              {RATIOS.map((r) => (
                <Press key={r} testID={`crop-ratio-${r.replace(":", "x")}`} onPress={() => push({ geo: { ...cur.geo, ratio: r } })} style={[st.pill, cur.geo.ratio === r && st.pillOn]}><Text style={st.pillText}>{r === "free" ? "Original" : r}</Text></Press>
              ))}
            </ScrollView>
          </View>
        )}
        <View style={st.tabs}>
          {(["crop", "adjust", "filters"] as const).map((t) => (
            <Press key={t} testID={`editor-tab-${t}`} onPress={() => setTab(t)} style={[st.tab, tab === t && st.tabOn]}>
              <Text style={[st.tabText, tab === t && { color: "#FFFFFF" }]}>{t === "crop" ? "Crop" : t === "adjust" ? "Adjust" : "Filters"}</Text>
            </Press>
          ))}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  root: { flex: 1, backgroundColor: "#000000" },
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: "800" },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, gap: 2 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  save: { backgroundColor: "#FF5E00", borderRadius: radius.pill, paddingHorizontal: spacing.lg, height: 40, justifyContent: "center", marginRight: spacing.sm },
  saveText: { color: "#FFFFFF", fontWeight: "700" },
  stage: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  beforeLabel: { position: "absolute", top: spacing.md, color: "#FFFFFF", fontWeight: "800", letterSpacing: 1.2, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: "hidden" },
  panel: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(28,28,30,0.96)", borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: spacing.lg, gap: spacing.md },
  pill: { height: 36, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: "#2C2C2E", justifyContent: "center", flexShrink: 0 },
  pillOn: { backgroundColor: "#FF5E00" },
  pillText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  slider: { height: 44, justifyContent: "center" },
  track: { height: 4, borderRadius: 2, backgroundColor: "#48484A" },
  fill: { position: "absolute", height: 4, backgroundColor: "#FF5E00", borderRadius: 2 },
  knob: { position: "absolute", width: 24, height: 24, borderRadius: 12, backgroundColor: "#FFFFFF", marginLeft: -12 },
  engine: { color: "#8E8E93", fontSize: 11, textAlign: "center", marginTop: 2 },
  cropRow: { flexDirection: "row", justifyContent: "space-around" },
  tool: { alignItems: "center", gap: 4, width: 72, minHeight: 52 },
  toolText: { color: "#FFFFFF", fontSize: 12 },
  tabs: { flexDirection: "row", marginHorizontal: spacing.lg, backgroundColor: "#2C2C2E", borderRadius: radius.pill, padding: 4 },
  tab: { flex: 1, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  tabOn: { backgroundColor: "#FF5E00" },
  tabText: { color: "#8E8E93", fontWeight: "700", fontSize: 14 },
}));

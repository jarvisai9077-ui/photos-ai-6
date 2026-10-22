// Creation Studio: real template layouts rendered as views and captured at high resolution with view-shot.
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useFeedback } from "@/src/components/feedback";
import { getBatch, setBatch } from "@/src/components/SelectionBar";
import { Button, Chip, ChipRow, Header, Screen, Body } from "@/src/components/ui";
import { saveToLibrary } from "@/src/media/library";
import { pickMedia } from "@/src/media/picker";
import { Project, setState, uid, useStore, getState } from "@/src/store";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

type Cell = { x: number; y: number; w: number; h: number };
type Tpl = { id: string; name: string; ratio: number; cells: Cell[]; kind: Project["kind"]; titleArea?: boolean };
const g = (cols: number, rows: number, top = 0): Cell[] => Array.from({ length: cols * rows }, (_, i) => ({ x: (i % cols) / cols, y: top + (Math.floor(i / cols) / rows) * (1 - top), w: 1 / cols, h: (1 - top) / rows }));
export const TEMPLATES: Tpl[] = [
  { id: "duo", name: "Duo", ratio: 1, kind: "collage", cells: g(2, 1) },
  { id: "trio", name: "Trio", ratio: 1, kind: "collage", cells: [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }] },
  { id: "quad", name: "Grid 4", ratio: 1, kind: "collage", cells: g(2, 2) },
  { id: "six", name: "Grid 6", ratio: 2 / 3, kind: "collage", cells: g(2, 3) },
  { id: "nine", name: "Grid 9", ratio: 1, kind: "collage", cells: g(3, 3) },
  { id: "story", name: "Story 9:16", ratio: 9 / 16, kind: "story", cells: [{ x: 0, y: 0, w: 1, h: 0.62 }, { x: 0, y: 0.62, w: 0.5, h: 0.38 }, { x: 0.5, y: 0.62, w: 0.5, h: 0.38 }] },
  { id: "poster", name: "Poster", ratio: 4 / 5, kind: "poster", cells: [{ x: 0, y: 0.22, w: 1, h: 0.78 }], titleArea: true },
  { id: "banner", name: "Banner 16:9", ratio: 16 / 9, kind: "poster", cells: [{ x: 0.4, y: 0, w: 0.6, h: 1 }], titleArea: true },
  { id: "contact", name: "Contact sheet", ratio: 0.707, kind: "contact", cells: g(4, 5, 0.08), titleArea: true },
  { id: "film", name: "Storyboard", ratio: 0.707, kind: "storyboard", cells: g(2, 3, 0.08), titleArea: true },
];
const BGS = ["#FFFFFF", "#1C1C1E", "#FFF0E6", "#ECE8FB", "#E1F1F7", "#FCE6EC", "#E2F6EC", "#FF5E00"];

export default function Collage() {
  const { project: projectId } = useLocalSearchParams<{ project?: string }>();
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const { colors } = useTheme();
  const fb = useFeedback();
  const { width } = useWindowDimensions();
  const brand = useStore((s) => s.prefs);
  const existing = projectId ? getState().projects.find((p) => p.id === projectId) : undefined;
  const [tpl, setTpl] = useState<Tpl>(TEMPLATES.find((t) => t.id === existing?.template) || TEMPLATES[2]);
  const [uris, setUris] = useState<string[]>(existing?.uris || getBatch().map((b) => b.uri));
  const [ids, setIds] = useState<string[]>(existing?.items || getBatch().map((b) => b.id));
  const [text, setText] = useState(existing?.text || "");
  const [bg, setBg] = useState(existing?.bg || "#FFFFFF");
  const [gap, setGap] = useState(6);
  const [mark, setMark] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<View>(null);
  useEffect(() => () => { setBatch([]); }, []);

  const W = Math.min(width - spacing.lg * 2, 560);
  const H = W / tpl.ratio;
  const dark = bg === "#1C1C1E" || bg === "#FF5E00";

  const pick = async () => {
    const r = await pickMedia({ max: tpl.cells.length, type: "photo", title: `Pick up to ${tpl.cells.length}` });
    if (r.length) { setUris(r.map((x) => x.uri)); setIds(r.map((x) => x.id)); }
  };
  const persist = (outputUri?: string) => {
    const id = existing?.id || uid();
    const p: Project = { id, kind: tpl.kind, title: text || `${tpl.name} ${new Date().toLocaleDateString()}`, template: tpl.id, items: ids, uris, text, bg, created: existing?.created || Date.now(), updated: Date.now(), outputUri };
    setState((s) => ({ projects: [p, ...s.projects.filter((x) => x.id !== id)] }));
  };
  const exportIt = async () => {
    if (!uris.length) return fb.toast("Add photos first", "info");
    setBusy(true);
    try {
      const scale = 2160 / W;
      const out = await captureRef(ref, { format: "jpg", quality: 0.95, width: Math.round(W * scale), height: Math.round(H * scale), result: "tmpfile" });
      const saved = await saveToLibrary(out, `RF_${tpl.id}_${Date.now()}.jpg`, "photo", Math.round(W * scale), Math.round(H * scale));
      persist(saved.uri);
      fb.toast(`Exported ${Math.round(W * scale)}×${Math.round(H * scale)} to your library`, "success");
    } catch (e: any) {
      fb.toast(`Export failed: ${e?.message || e}`, "error");
    } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Header title="Creation Studio" subtitle={`${tpl.name} · ${uris.length}/${tpl.cells.length} photos`} />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <ChipRow>
          {TEMPLATES.map((t) => <Chip key={t.id} testID={`template-${t.id}`} label={t.name} active={tpl.id === t.id} onPress={() => setTpl(t)} />)}
        </ChipRow>
        <View style={{ alignItems: "center", paddingVertical: spacing.md }}>
          <View ref={ref} collapsable={false} testID="collage-canvas" style={{ width: W, height: H, backgroundColor: bg, borderRadius: 2, overflow: "hidden" }}>
            {tpl.titleArea && (
              <View style={{ position: "absolute", left: 0, right: tpl.id === "banner" ? W * 0.6 : 0, top: 0, height: tpl.id === "banner" ? H : H * (tpl.kind === "poster" ? 0.22 : 0.08), justifyContent: "center", paddingHorizontal: 14 }}>
                <Text numberOfLines={3} style={{ color: dark ? "#FFFFFF" : "#1C1C1E", fontWeight: "800", fontSize: tpl.kind === "poster" ? 26 : 14 }}>{text || "Your title"}</Text>
              </View>
            )}
            {tpl.cells.map((c, i) => (
              <View key={i} style={{ position: "absolute", left: c.x * W + gap / 2, top: c.y * H + gap / 2, width: c.w * W - gap, height: c.h * H - gap, backgroundColor: dark ? "#2C2C2E" : "#EEEFF2", borderRadius: gap ? 8 : 0, overflow: "hidden" }}>
                {uris[i] ? <Image source={{ uri: uris[i] }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
                {tpl.kind === "storyboard" && <Text style={st.scene}>Scene {i + 1}</Text>}
              </View>
            ))}
            {!tpl.titleArea && !!text && <Text style={[st.overlayText, { color: "#FFFFFF" }]}>{text}</Text>}
            {mark && <Text style={[st.mark, { color: brand.brandColor }]}>{brand.watermark || brand.brandName}</Text>}
          </View>
        </View>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          <Button testID="collage-pick-button" label={uris.length ? "Change photos" : "Add photos"} icon="images-outline" variant="secondary" onPress={pick} />
          <TextInput testID="collage-text-input" value={text} onChangeText={setText} placeholder="Title / text overlay" placeholderTextColor={colors.muted} style={st.input} />
          <Text style={st.label}>Background</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {BGS.map((b) => <Button key={b} testID={`collage-bg-${b.slice(1)}`} label="" onPress={() => setBg(b)} variant="ghost" style={{ width: 40, minHeight: 40, height: 40, paddingHorizontal: 0, backgroundColor: b, borderWidth: bg === b ? 3 : 1, borderColor: bg === b ? colors.brandPrimary : colors.border }} />)}
          </ScrollView>
          <ChipRow>
            {[0, 6, 12].map((v) => <Chip key={v} testID={`collage-gap-${v}`} label={v ? `Gap ${v}` : "No gap"} active={gap === v} onPress={() => setGap(v)} />)}
            <Chip testID="collage-watermark-toggle" label="Watermark" icon="water-outline" active={mark} onPress={() => setMark(!mark)} />
          </ChipRow>
          <Body muted>Exports at 2160 px wide (JPEG). Projects stay editable in Create › Projects.</Body>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Button testID="collage-save-project-button" label="Save project" variant="ghost" style={{ flex: 1 }} onPress={() => { persist(); fb.toast("Project saved", "success"); }} />
            <View style={{ flex: 1 }}><Button testID="collage-export-button" label="Export" icon="download-outline" loading={busy} onPress={exportIt} /></View>
          </View>
          {existing && <Button testID="collage-delete-project-button" label="Delete project" variant="danger" onPress={async () => { if (await fb.confirm({ title: "Delete project?", message: "Exported images stay in your library.", destructive: true, confirmLabel: "Delete" })) { setState((s) => ({ projects: s.projects.filter((p) => p.id !== existing.id) })); router.back(); } }} />}
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  input: { backgroundColor: c.surfaceSecondary, color: c.onSurface, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 48, fontSize: 15, borderWidth: 1, borderColor: c.border },
  label: { color: c.onSurface, fontWeight: "700", fontSize: 15 },
  overlayText: { position: "absolute", left: 12, right: 12, bottom: 14, fontSize: 22, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 6 },
  mark: { position: "absolute", right: 10, bottom: 6, fontSize: 11, fontWeight: "800", opacity: 0.9 },
  scene: { position: "absolute", left: 6, top: 4, color: "#FFFFFF", fontSize: 10, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4 },
}));

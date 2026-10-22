import React, { useEffect, useRef, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { CameraView, useCameraPermissions, useMicrophonePermissions, CameraType, FlashMode } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeedback } from "@/src/components/feedback";
import { Button, Ionicons, Press } from "@/src/components/ui";
import { saveToLibrary } from "@/src/media/library";
import { logEvent } from "@/src/store";
import { makeStyles, radius, spacing } from "@/src/theme";

// Recipes only change settings this camera API genuinely exposes (lens, flash, zoom, grid, timer, mode).
const RECIPES: { id: string; name: string; facing: CameraType; flash: FlashMode; zoom: number; grid: boolean; timer: number; mode: "photo" | "video"; tip: string }[] = [
  { id: "auto", name: "Auto", facing: "back", flash: "auto", zoom: 0, grid: false, timer: 0, mode: "photo", tip: "Default capture" },
  { id: "portrait", name: "Portrait", facing: "back", flash: "off", zoom: 0.05, grid: true, timer: 0, mode: "photo", tip: "Slight zoom flattens features; place eyes on the top third" },
  { id: "landscape", name: "Landscape", facing: "back", flash: "off", zoom: 0, grid: true, timer: 0, mode: "photo", tip: "Keep the horizon on a grid line" },
  { id: "night", name: "Night", facing: "back", flash: "off", zoom: 0, grid: false, timer: 3, mode: "photo", tip: "3 s timer reduces shake; brace the phone" },
  { id: "food", name: "Food", facing: "back", flash: "off", zoom: 0.02, grid: true, timer: 0, mode: "photo", tip: "Shoot from 45° or straight above" },
  { id: "document", name: "Document", facing: "back", flash: "auto", zoom: 0, grid: true, timer: 0, mode: "photo", tip: "Fill the frame and align page edges with the grid" },
  { id: "group", name: "Group", facing: "back", flash: "auto", zoom: 0, grid: true, timer: 10, mode: "photo", tip: "10 s timer so you can join in" },
  { id: "selfie", name: "Selfie", facing: "front", flash: "off", zoom: 0, grid: false, timer: 3, mode: "photo", tip: "Front camera with 3 s timer" },
  { id: "social", name: "Social clip", facing: "back", flash: "off", zoom: 0, grid: true, timer: 0, mode: "video", tip: "Vertical video for stories" },
];

export default function Camera() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const fb = useFeedback();
  const [cam, requestCam] = useCameraPermissions();
  const [mic, requestMic] = useMicrophonePermissions();
  const ref = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [zoom, setZoom] = useState(0);
  const [grid, setGrid] = useState(false);
  const [timer, setTimer] = useState(0);
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [recipe, setRecipe] = useState("auto");
  const [count, setCount] = useState(0);
  const [recording, setRecording] = useState(false);
  const [ready, setReady] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (!count) return;
    const t = setTimeout(() => setCount(count - 1), 1000);
    return () => clearTimeout(t);
  }, [count]);

  if (!cam) return <View style={st.root} />;
  if (!cam.granted) {
    return (
      <View style={[st.root, st.center, { padding: spacing.xl }]} testID="camera-permission-state">
        <Ionicons name="camera-outline" size={56} color="#FF5E00" />
        <Text style={st.permTitle}>Camera access</Text>
        <Text style={st.permMsg}>RF Photos uses the camera to capture photos, videos and document scans. Captures are saved only on this device.</Text>
        {cam.canAskAgain ? <Button testID="camera-allow-button" label="Allow camera" onPress={requestCam} style={{ marginTop: spacing.xl }} /> : <Button testID="camera-settings-button" label="Open Settings" onPress={() => Linking.openSettings()} style={{ marginTop: spacing.xl }} />}
        <Button testID="camera-close-button" label="Not now" variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
      </View>
    );
  }

  const applyRecipe = (id: string) => {
    const r = RECIPES.find((x) => x.id === id)!;
    setRecipe(id); setFacing(r.facing); setFlash(r.flash); setZoom(r.zoom); setGrid(r.grid); setTimer(r.timer); setMode(r.mode);
    fb.toast(r.tip, "info");
  };

  const takeOne = async () => {
    const p = await ref.current?.takePictureAsync({ quality: 1, exif: true });
    if (!p) throw new Error("Capture returned nothing");
    const item = await saveToLibrary(p.uri, `RF_${Date.now()}.jpg`, "photo", p.width, p.height);
    logEvent(item.id, "import", `Captured with RF Camera (${recipe} recipe)`);
    setLast(p.uri);
  };

  const shoot = async () => {
    if (!ready) return fb.toast("Camera is still starting", "info");
    if (mode === "video") return toggleVideo();
    const run = async () => {
      try {
        if (burst) { for (let i = 0; i < 5; i++) await takeOne(); fb.toast("Burst of 5 saved — review in Memories › Bursts", "success"); }
        else { await takeOne(); }
      } catch (e: any) { fb.toast(`Capture failed: ${e?.message || e}`, "error"); }
    };
    if (timer) { setCount(timer); setTimeout(run, timer * 1000); } else run();
  };

  const toggleVideo = async () => {
    if (recording) { ref.current?.stopRecording(); return; }
    if (!mic?.granted) {
      const r = mic?.canAskAgain === false ? null : await requestMic();
      if (!r?.granted) {
        const go = await fb.confirm({ title: "Microphone needed", message: "Video recording needs microphone access for sound. You can enable it in Settings.", confirmLabel: "Open Settings" });
        if (go) Linking.openSettings();
        return;
      }
    }
    try {
      setRecording(true);
      const v = await ref.current?.recordAsync({ maxDuration: 600 });
      setRecording(false);
      if (v?.uri) { const item = await saveToLibrary(v.uri, `RF_${Date.now()}.mp4`, "video"); logEvent(item.id, "import", "Recorded with RF Camera"); fb.toast("Video saved", "success"); }
    } catch (e: any) { setRecording(false); fb.toast(`Recording failed: ${e?.message || e}`, "error"); }
  };

  const flashIcon = flash === "on" ? "flash" : flash === "auto" ? "flash-outline" : "flash-off";
  return (
    <View style={st.root} testID="camera-screen">
      <CameraView ref={ref} style={{ flex: 1 }} facing={facing} flash={flash} zoom={zoom} mode={mode === "video" ? "video" : "picture"} onCameraReady={() => setReady(true)} onMountError={(e) => fb.toast(`Camera unavailable: ${e.message}`, "error")} />
      {grid && (
        <View pointerEvents="none" style={st.grid}>
          {[1, 2].map((i) => <View key={`v${i}`} style={[st.gl, { left: `${(i * 100) / 3}%`, top: 0, bottom: 0, width: 1 }]} />)}
          {[1, 2].map((i) => <View key={`h${i}`} style={[st.gl, { top: `${(i * 100) / 3}%`, left: 0, right: 0, height: 1 }]} />)}
        </View>
      )}
      {count > 0 && <Text testID="camera-countdown" style={st.count}>{count}</Text>}
      <View style={[st.top, { paddingTop: insets.top + spacing.sm }]}>
        <Press testID="camera-back-button" onPress={() => router.back()} style={st.icon}><Ionicons name="close" size={26} color="#FFFFFF" /></Press>
        <Press testID="camera-flash-button" onPress={() => setFlash(flash === "off" ? "on" : flash === "on" ? "auto" : "off")} style={st.icon}><Ionicons name={flashIcon as any} size={22} color="#FFFFFF" /></Press>
        <Press testID="camera-grid-button" onPress={() => setGrid(!grid)} style={[st.icon, grid && st.on]}><Ionicons name="grid-outline" size={22} color="#FFFFFF" /></Press>
        <Press testID="camera-timer-button" onPress={() => setTimer(timer === 0 ? 3 : timer === 3 ? 10 : 0)} style={[st.icon, timer > 0 && st.on]}><Ionicons name="timer-outline" size={22} color="#FFFFFF" />{timer > 0 && <Text style={st.small}>{timer}s</Text>}</Press>
        <Press testID="camera-burst-button" onPress={() => setBurst(!burst)} style={[st.icon, burst && st.on]}><Ionicons name="layers-outline" size={22} color="#FFFFFF" /></Press>
      </View>
      <View style={[st.bottom, { paddingBottom: insets.bottom + spacing.md }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          {RECIPES.map((r) => (
            <Press key={r.id} testID={`camera-recipe-${r.id}`} onPress={() => applyRecipe(r.id)} style={[st.recipe, recipe === r.id && st.recipeOn]}><Text style={st.recipeText}>{r.name}</Text></Press>
          ))}
        </ScrollView>
        <View style={st.zoomRow}>
          {[0, 0.1, 0.3].map((z) => (
            <Press key={z} testID={`camera-zoom-${z}`} onPress={() => setZoom(z)} style={[st.zoom, Math.abs(zoom - z) < 0.01 && st.recipeOn]}><Text style={st.recipeText}>{z === 0 ? "1×" : z === 0.1 ? "2×" : "4×"}</Text></Press>
          ))}
        </View>
        <View style={st.modeRow}>
          {(["photo", "video"] as const).map((m) => (
            <Press key={m} testID={`camera-mode-${m}`} onPress={() => !recording && setMode(m)}><Text style={[st.mode, mode === m && { color: "#FF5E00" }]}>{m.toUpperCase()}</Text></Press>
          ))}
        </View>
        <View style={st.shutterRow}>
          <Press testID="camera-last-capture" onPress={() => router.push("/")} style={st.thumb}>{last ? <View style={st.thumbDot} /> : <Ionicons name="images-outline" size={22} color="#FFFFFF" />}</Press>
          <Press testID="camera-shutter-button" onPress={shoot} style={st.shutter}><View style={[st.shutterInner, mode === "video" && { backgroundColor: "#FF3B30" }, recording && { borderRadius: 8, width: 30, height: 30 }]} /></Press>
          <Press testID="camera-flip-button" onPress={() => setFacing(facing === "back" ? "front" : "back")} style={st.thumb}><Ionicons name="camera-reverse-outline" size={26} color="#FFFFFF" /></Press>
        </View>
        <Text style={st.note}>Manual ISO, shutter, RAW and HDR are not exposed by this camera API and are not shown.</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  root: { flex: 1, backgroundColor: "#000000" },
  center: { alignItems: "center", justifyContent: "center" },
  permTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800", marginTop: spacing.lg },
  permMsg: { color: "#C7C7CC", fontSize: 15, textAlign: "center", marginTop: spacing.sm, lineHeight: 21 },
  grid: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  gl: { position: "absolute", backgroundColor: "rgba(255,255,255,0.4)" },
  count: { position: "absolute", alignSelf: "center", top: "40%", color: "#FFFFFF", fontSize: 96, fontWeight: "800" },
  top: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.md, backgroundColor: "rgba(0,0,0,0.3)", paddingBottom: spacing.sm },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  on: { backgroundColor: "rgba(255,94,0,0.8)" },
  small: { position: "absolute", bottom: 2, color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)", paddingTop: spacing.md, gap: spacing.md },
  recipe: { height: 34, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", flexShrink: 0 },
  recipeOn: { backgroundColor: "#FF5E00" },
  recipeText: { color: "#FFFFFF", fontWeight: "600", fontSize: 13 },
  zoomRow: { flexDirection: "row", justifyContent: "center", gap: spacing.sm },
  zoom: { width: 44, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  modeRow: { flexDirection: "row", justifyContent: "center", gap: spacing.xl },
  mode: { color: "#FFFFFF", fontWeight: "800", letterSpacing: 1.2, padding: spacing.sm },
  shutterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  thumb: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  thumbDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#FF5E00" },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#FFFFFF" },
  note: { color: "rgba(255,255,255,0.6)", fontSize: 11, textAlign: "center", paddingHorizontal: spacing.lg },
}));

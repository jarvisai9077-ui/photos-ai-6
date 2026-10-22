// Best Moment Extractor: real frame extraction from a video at even intervals (expo-video-thumbnails), user picks frames to save.
import React, { useRef, useState } from "react";
import { Platform, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import * as VideoThumbnails from "expo-video-thumbnails";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeedback } from "@/src/components/feedback";
import { getBatch } from "@/src/components/SelectionBar";
import { Button, EmptyState, Header, Press, Progress, Screen, Body, Ionicons } from "@/src/components/ui";
import { formatDuration, localUriFor } from "@/src/media/files";
import { saveToLibrary } from "@/src/media/library";
import { pickMedia } from "@/src/media/picker";
import { logEvent, MediaItem } from "@/src/store";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Moments() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const { colors } = useTheme();
  const fb = useFeedback();
  const { width } = useWindowDimensions();
  const [video, setVideo] = useState<MediaItem | null>(getBatch()[0]?.mediaType === "video" ? getBatch()[0] : null);
  const [frames, setFrames] = useState<{ uri: string; t: number; w: number; h: number }[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [prog, setProg] = useState<number | null>(null);
  const cancel = useRef(false);
  const N = 12;

  const extract = async (v: MediaItem) => {
    if (Platform.OS === "web") return fb.toast("Frame extraction runs on Android/iOS (not in the web preview)", "info");
    cancel.current = false;
    setFrames([]); setSel([]); setProg(0);
    const src = await localUriFor(v.id, v.uri);
    const dur = Math.max(1, v.duration) * 1000;
    const out: { uri: string; t: number; w: number; h: number }[] = [];
    for (let i = 0; i < N; i++) {
      if (cancel.current) break;
      const t = Math.round((dur * (i + 0.5)) / N);
      try { const r = await VideoThumbnails.getThumbnailAsync(src, { time: t, quality: 1 }); out.push({ uri: r.uri, t, w: r.width, h: r.height }); setFrames([...out]); } catch {}
      setProg((i + 1) / N);
    }
    setProg(null);
    if (!out.length) fb.toast("Couldn't decode frames from this video (unsupported codec?)", "error");
  };
  const saveSel = async () => {
    for (const i of sel) {
      const f = frames[i];
      const item = await saveToLibrary(f.uri, `RF_frame_${Math.round(f.t / 100) / 10}s_${Date.now()}.jpg`, "photo", f.w, f.h);
      if (video) logEvent(item.id, "edit", `Frame at ${formatDuration(f.t / 1000)} from ${video.filename}`);
    }
    fb.toast(`${sel.length} frame(s) saved — video untouched`, "success");
    setSel([]);
  };
  const size = (Math.min(width, 900) - spacing.lg * 2 - 8) / 3;

  return (
    <Screen>
      <Header title="Best Moments" subtitle={video ? `${video.filename} · ${formatDuration(video.duration)}` : "Extract stills from a video"} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 100 }}>
        <Body muted>RF Photos samples {N} frames evenly across the video. Automatic quality ranking needs a local vision model (not bundled) — you choose the best frames.</Body>
        <Button testID="moments-pick-button" label={video ? "Choose another video" : "Choose video"} icon="film-outline" variant="secondary" onPress={async () => { const r = await pickMedia({ max: 1, type: "video", title: "Choose a video" }); if (r[0]) { setVideo(r[0]); extract(r[0]); } }} />
        {video && !frames.length && prog === null && <Button testID="moments-extract-button" label="Extract frames" icon="images-outline" onPress={() => extract(video)} />}
        {prog !== null && <View style={{ gap: spacing.sm }}><Progress value={prog} /><Button testID="moments-cancel" label="Cancel" variant="ghost" onPress={() => (cancel.current = true)} /></View>}
        {!video && <EmptyState testID="moments-empty" icon="film-outline" tint="pastelPowderBlue" title="Pick a video" message="Turn your favourite moment into a full-resolution still." />}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          {frames.map((f, i) => (
            <Press key={i} testID={`moment-frame-${i}`} onPress={() => setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]))} style={[st.frame, { width: size, height: size }, sel.includes(i) && { borderColor: colors.brandPrimary }]}>
              <Image source={{ uri: f.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              <Text style={st.t}>{formatDuration(f.t / 1000)}</Text>
              {sel.includes(i) && <Ionicons name="checkmark-circle" size={22} color={colors.brandPrimary} style={{ position: "absolute", top: 4, right: 4 }} />}
            </Press>
          ))}
        </View>
      </ScrollView>
      {sel.length > 0 && <View style={[st.fab, { bottom: insets.bottom + spacing.lg }]}><Button testID="moments-save-button" label={`Save ${sel.length} frame(s)`} icon="download-outline" onPress={saveSel} /></View>}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  frame: { borderRadius: radius.sm, overflow: "hidden", borderWidth: 3, borderColor: "transparent", backgroundColor: c.surfaceTertiary },
  t: { position: "absolute", left: 4, bottom: 4, color: "#FFFFFF", fontSize: 11, fontWeight: "700", textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 4 },
  fab: { position: "absolute", left: spacing.lg, right: spacing.lg },
}));

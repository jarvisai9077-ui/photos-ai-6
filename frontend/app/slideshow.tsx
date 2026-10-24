// Offline memory slideshow: photos with Ken Burns motion and fade / slide / zoom transitions; videos play inline.
// Everything runs on-device. The slideshow plays inside RF Photos; it is not exported as a video file.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEventListener } from "expo";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Easing, FadeIn, FadeOut, SlideInRight, SlideOutLeft, ZoomIn, ZoomOut, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeedback } from "@/src/components/feedback";
import { Button, EmptyState, Ionicons, Screen } from "@/src/components/ui";
import { localUriFor } from "@/src/media/files";
import { findItem } from "@/src/media/library";
import { pickMedia } from "@/src/media/picker";
import { getSlideshow, saveSlideshow, takeQueuedSlideshow } from "@/src/media/slideshow";
import { captureTime, dayLabel } from "@/src/media/dates";
import { MediaItem, Slideshow, useStore } from "@/src/store";

type Transition = Slideshow["transition"];
const TRANSITIONS: { id: Transition; label: string }[] = [
  { id: "fade", label: "Fade" },
  { id: "slide", label: "Slide" },
  { id: "zoom", label: "Zoom" },
];
const SPEEDS = [3, 5, 8];
const MAX_VIDEO_SECONDS = 15;

function anims(t: Transition, reduced: boolean) {
  if (reduced || t === "fade") return { entering: FadeIn.duration(reduced ? 250 : 700), exiting: FadeOut.duration(reduced ? 250 : 700) };
  if (t === "slide") return { entering: SlideInRight.duration(600), exiting: SlideOutLeft.duration(600) };
  return { entering: ZoomIn.duration(650), exiting: ZoomOut.duration(500) };
}

function KenBurns({ uri, seconds, paused, flip, reduced }: { uri: string; seconds: number; paused: boolean; flip: boolean; reduced: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    if (paused) cancelAnimation(p);
    else p.value = withTiming(1, { duration: Math.max(300, (1 - p.value) * seconds * 1000), easing: Easing.linear });
  }, [paused, seconds, reduced, p]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + p.value * 0.12 }, { translateX: (flip ? -1 : 1) * p.value * 14 }] }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={0} />
    </Animated.View>
  );
}

function VideoSlide({ item, muted, paused, onEnd }: { item: MediaItem; muted: boolean; paused: boolean; onEnd: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    localUriFor(item.id, item.uri).then((u) => on && setSrc(u)).catch(() => on && setSrc(item.uri));
    return () => { on = false; };
  }, [item.id, item.uri]);
  const player = useVideoPlayer(src ? { uri: src } : null, (pl) => { pl.loop = false; });
  useEventListener(player, "playToEnd", onEnd);
  useEventListener(player, "statusChange", ({ status }) => { if (status === "error") setTimeout(onEnd, 800); });
  useEffect(() => { player.muted = muted; }, [muted, player]);
  useEffect(() => {
    if (!src) return;
    try { if (paused) player.pause(); else player.play(); } catch { /* player released */ }
  }, [paused, src, player]);
  // Long clips are capped so the memory keeps moving.
  useEffect(() => {
    if (paused || !src) return;
    const t = setTimeout(onEnd, Math.min(MAX_VIDEO_SECONDS, Math.max(1, item.duration || MAX_VIDEO_SECONDS)) * 1000 + 600);
    return () => clearTimeout(t);
  }, [paused, src, item.duration, onEnd]);
  return src ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} surfaceType="textureView" /> : null;
}

export default function SlideshowScreen() {
  const { id, fresh } = useLocalSearchParams<{ id?: string; fresh?: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const fb = useFeedback();
  const reduced = useStore((s) => s.prefs.reducedMotion);
  const init = useMemo(() => {
    const saved = id ? getSlideshow(id) : undefined;
    if (saved) return { savedId: saved.id, title: saved.title, items: saved.itemIds.map((x) => findItem(x)).filter(Boolean) as MediaItem[], transition: saved.transition, seconds: saved.seconds };
    const q = fresh ? null : takeQueuedSlideshow();
    return { savedId: undefined as string | undefined, title: q?.title || "My memories", items: q?.items || [], transition: "fade" as Transition, seconds: 5 };
  }, [id, fresh]);
  const [items, setItems] = useState<MediaItem[]>(init.items);
  const [title, setTitle] = useState(init.title);
  const [savedId, setSavedId] = useState(init.savedId);
  const [transition, setTransition] = useState<Transition>(init.transition);
  const [seconds, setSeconds] = useState(init.seconds);
  const [idx, setIdx] = useState(-1); // -1 = title card
  const [playing, setPlaying] = useState(true);
  const [ended, setEnded] = useState(false);
  const [controls, setControls] = useState(true);
  const [muted, setMuted] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cur = idx >= 0 ? items[idx] : undefined;
  const next = useCallback(() => {
    setIdx((i) => {
      if (i + 1 >= items.length) { setEnded(true); setPlaying(false); return i; }
      return i + 1;
    });
  }, [items.length]);
  const prev = () => { setEnded(false); setIdx((i) => Math.max(-1, i - 1)); };

  // Photos and the title card advance on a timer; videos advance when they finish.
  useEffect(() => {
    if (!playing || ended || !items.length || cur?.mediaType === "video") return;
    const t = setTimeout(next, idx === -1 ? 2500 : seconds * 1000);
    return () => clearTimeout(t);
  }, [playing, ended, idx, seconds, cur?.mediaType, items.length, next]);

  // Preload the next photo so transitions never show a blank frame.
  useEffect(() => {
    const n = items[idx + 1];
    if (n && n.mediaType === "photo") Image.prefetch(n.uri).catch(() => {});
  }, [idx, items]);

  const poke = () => {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 3500);
  };
  useEffect(() => { poke(); return () => { if (hideTimer.current) clearTimeout(hideTimer.current); }; }, []);

  const choose = async () => {
    const r = await pickMedia({ max: 200, title: "Choose photos & videos" });
    if (r.length) { setItems([...r].sort((a, b) => captureTime(a) - captureTime(b))); setTitle("My memories"); setSavedId(undefined); setIdx(-1); setEnded(false); setPlaying(true); }
  };
  const replay = () => { setEnded(false); setIdx(-1); setPlaying(true); };
  const save = async () => {
    const name = await fb.prompt({ title: savedId ? "Rename slideshow" : "Save slideshow", message: "Saved on this device. It plays here in RF Photos.", placeholder: "Title", initial: title });
    if (!name) return;
    setTitle(name);
    setSavedId(saveSlideshow({ title: name, itemIds: items.map((m) => m.id), transition, seconds }, savedId));
    fb.toast("Slideshow saved", "success");
  };

  if (!items.length) {
    return (
      <Screen style={{ backgroundColor: "#000" }}>
        <View style={{ flex: 1, justifyContent: "center", paddingTop: insets.top }}>
          <EmptyState testID="slideshow-empty" icon="film-outline" title="Make a memory slideshow" message={id ? "The photos in this slideshow are no longer on this device." : "Choose photos and videos. RF Photos plays them with smooth transitions, entirely offline."} action="Choose photos" onAction={choose} />
          <Button testID="slideshow-close-empty" label="Close" variant="ghost" onPress={() => router.back()} style={{ marginHorizontal: 32, marginTop: 8 }} />
        </View>
      </Screen>
    );
  }

  const a = anims(transition, reduced);
  const first = items[0];
  const last = items[items.length - 1];
  const range = dayLabel(captureTime(first)) === dayLabel(captureTime(last)) ? dayLabel(captureTime(first)) : `${dayLabel(captureTime(first))} – ${dayLabel(captureTime(last))}`;

  return (
    <View style={st.root} testID="slideshow-screen">
      <Pressable testID="slideshow-stage" style={StyleSheet.absoluteFill} onPress={poke}>
        {idx === -1 ? (
          <Animated.View key="title" entering={FadeIn.duration(500)} exiting={FadeOut.duration(500)} style={[StyleSheet.absoluteFill, st.center]}>
            <Image source={{ uri: first.thumb || first.uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={18} />
            <LinearGradient colors={["rgba(0,0,0,0.25)", "rgba(0,0,0,0.75)"]} style={StyleSheet.absoluteFill} />
            <Text style={st.kicker}>RF PHOTOS · MEMORIES</Text>
            <Text testID="slideshow-title" style={st.title}>{title}</Text>
            <Text style={st.range}>{range} · {items.length} {items.length === 1 ? "item" : "items"}</Text>
          </Animated.View>
        ) : cur ? (
          <Animated.View key={cur.id + idx} entering={a.entering} exiting={a.exiting} style={StyleSheet.absoluteFill}>
            {cur.mediaType === "video" ? (
              <VideoSlide item={cur} muted={muted} paused={!playing} onEnd={next} />
            ) : (
              <KenBurns uri={cur.uri} seconds={seconds} paused={!playing} flip={idx % 2 === 1} reduced={reduced} />
            )}
          </Animated.View>
        ) : null}
      </Pressable>

      <View pointerEvents="none" style={[st.progressWrap, { top: insets.top + 6 }]}>
        <View style={st.progressTrack}><View style={[st.progressFill, { width: `${((Math.max(0, idx) + (ended ? 1 : 0)) / items.length) * 100}%` }]} /></View>
      </View>

      {ended && (
        <View style={[StyleSheet.absoluteFill, st.center, { backgroundColor: "rgba(0,0,0,0.7)" }]} testID="slideshow-ended">
          <Text style={st.title}>That&apos;s a wrap</Text>
          <Text style={st.range}>{title}</Text>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
            <Button testID="slideshow-replay" label="Replay" icon="refresh" onPress={replay} />
            <Button testID="slideshow-save-end" label={savedId ? "Saved" : "Save"} icon="bookmark-outline" variant="secondary" onPress={save} />
          </View>
        </View>
      )}

      {controls && !ended && (
        <>
          <View style={[st.top, { paddingTop: insets.top + 14 }]}>
            <Pressable testID="slideshow-close" onPress={() => router.back()} style={st.icon} accessibilityLabel="Close"><Ionicons name="close" size={26} color="#FFF" /></Pressable>
            <View style={{ flex: 1 }}>
              <Text style={st.topTitle} numberOfLines={1}>{title}</Text>
              <Text style={st.topSub}>{idx < 0 ? "Title" : `${idx + 1} / ${items.length}`}{cur ? ` · ${dayLabel(captureTime(cur))}` : ""}</Text>
            </View>
            <Pressable testID="slideshow-mute" onPress={() => setMuted((m) => !m)} style={st.icon} accessibilityLabel={muted ? "Unmute" : "Mute"}><Ionicons name={muted ? "volume-mute" : "volume-high"} size={22} color="#FFF" /></Pressable>
            <Pressable testID="slideshow-save" onPress={save} style={st.icon} accessibilityLabel="Save slideshow"><Ionicons name={savedId ? "bookmark" : "bookmark-outline"} size={22} color="#FFF" /></Pressable>
          </View>
          <View style={[st.bottom, { paddingBottom: insets.bottom + 16 }]}>
            <View style={st.chips}>
              {TRANSITIONS.map((t) => (
                <Pressable key={t.id} testID={`slideshow-transition-${t.id}`} onPress={() => { setTransition(t.id); poke(); }} style={[st.chip, transition === t.id && st.chipOn]}><Text style={st.chipText}>{t.label}</Text></Pressable>
              ))}
              <View style={{ width: 8 }} />
              {SPEEDS.map((s) => (
                <Pressable key={s} testID={`slideshow-speed-${s}`} onPress={() => { setSeconds(s); poke(); }} style={[st.chip, seconds === s && st.chipOn]}><Text style={st.chipText}>{s}s</Text></Pressable>
              ))}
            </View>
            <View style={[st.transport, { width: Math.min(width, 420) }]}>
              <Pressable testID="slideshow-prev" onPress={() => { prev(); poke(); }} style={st.icon} accessibilityLabel="Previous"><Ionicons name="play-skip-back" size={26} color="#FFF" /></Pressable>
              <Pressable testID="slideshow-play" onPress={() => { setPlaying((p) => !p); poke(); }} style={st.play} accessibilityLabel={playing ? "Pause" : "Play"}><Ionicons name={playing ? "pause" : "play"} size={30} color="#FFF" /></Pressable>
              <Pressable testID="slideshow-next" onPress={() => { next(); poke(); }} style={st.icon} accessibilityLabel="Next"><Ionicons name="play-skip-forward" size={26} color="#FFF" /></Pressable>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  kicker: { color: "#FFB27F", fontSize: 12, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: "#FFF", fontSize: 34, fontWeight: "800", textAlign: "center", marginTop: 8, letterSpacing: -0.6 },
  range: { color: "rgba(255,255,255,0.85)", fontSize: 15, marginTop: 8, textAlign: "center" },
  progressWrap: { position: "absolute", left: 16, right: 16 },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden" },
  progressFill: { height: 3, backgroundColor: "#FF5E00" },
  top: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 12, backgroundColor: "rgba(0,0,0,0.35)" },
  topTitle: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  topSub: { color: "rgba(255,255,255,0.75)", fontSize: 12 },
  icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", backgroundColor: "rgba(0,0,0,0.4)", paddingTop: 12, gap: 8 },
  chips: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center", paddingHorizontal: 12 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.16)", justifyContent: "center" },
  chipOn: { backgroundColor: "#FF5E00" },
  chipText: { color: "#FFF", fontWeight: "600", fontSize: 13 },
  transport: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FF5E00", alignItems: "center", justifyContent: "center" },
});

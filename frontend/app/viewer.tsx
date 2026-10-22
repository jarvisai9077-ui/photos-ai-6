import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Text, useWindowDimensions, View, ScrollView, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Sharing from "expo-sharing";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { getViewerList } from "@/src/components/MediaGrid";
import { useFeedback } from "@/src/components/feedback";
import { Ionicons, IconName, Press, Button } from "@/src/components/ui";
import { deleteMedia } from "@/src/media/library";
import { localUriFor } from "@/src/media/files";
import { moveToVault } from "@/src/media/vault";
import { MediaItem, setState, uid, updateMeta, useStore } from "@/src/store";
import { setBatch } from "@/src/components/SelectionBar";
import { makeStyles, radius, spacing } from "@/src/theme";

function ZoomableImage({ uri, w, h, onZoomChange }: { uri: string; w: number; h: number; onZoomChange: (z: boolean) => void }) {
  const scale = useSharedValue(1);
  const base = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const report = useCallback((z: boolean) => onZoomChange(z), [onZoomChange]);
  const pinch = Gesture.Pinch()
    .onUpdate((e) => { scale.value = Math.max(1, Math.min(5, base.value * e.scale)); })
    .onEnd(() => { base.value = scale.value; if (scale.value <= 1.01) { tx.value = withTiming(0); ty.value = withTiming(0); } })
    .runOnJS(true)
    .onFinalize(() => report(scale.value > 1.01));
  const pan = Gesture.Pan()
    .minPointers(1)
    .enabled(true)
    .onStart(() => { sx.value = tx.value; sy.value = ty.value; })
    .onUpdate((e) => { if (scale.value > 1.01) { tx.value = sx.value + e.translationX; ty.value = sy.value + e.translationY; } })
    .manualActivation(false);
  const dbl = Gesture.Tap().numberOfTaps(2).onEnd(() => {
    const z = scale.value > 1.01 ? 1 : 2.5;
    scale.value = withTiming(z); base.value = z; tx.value = withTiming(0); ty.value = withTiming(0);
  }).runOnJS(true).onFinalize(() => report(base.value > 1.01));
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }] }));
  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, Gesture.Exclusive(dbl, pan))}>
      <Animated.View style={[{ width: w, height: h }, style]}>
        <Image source={{ uri }} style={{ width: w, height: h }} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
}

function VideoPage({ uri, w, h, active }: { uri: string; w: number; h: number; active: boolean }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = false; });
  useEffect(() => { if (!active) player.pause(); }, [active, player]);
  return <VideoView testID="viewer-video" player={player} style={{ width: w, height: h }} contentFit="contain" nativeControls allowsPictureInPicture={false} />;
}

export default function Viewer() {
  const { index } = useLocalSearchParams<{ index: string }>();
  const list = useRef<MediaItem[]>(getViewerList()).current;
  const [i, setI] = useState(Math.min(Number(index) || 0, Math.max(0, list.length - 1)));
  const [chrome, setChrome] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const [sheet, setSheet] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const fb = useFeedback();
  const meta = useStore((s) => s.meta);
  const annotations = useStore((s) => s.annotations);
  const cur = list[i];
  const m = cur ? meta[cur.id] || {} : {};
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [caption, setCaption] = useState("");
  const listRef = useRef<FlatList<MediaItem>>(null);

  useEffect(() => {
    setNote(m.note || ""); setTags((m.tags || []).join(", ")); setCaption(m.caption || "");
  }, [cur?.id, sheet]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cur) {
    return (
      <View style={[st.root, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={st.white}>Nothing to show</Text>
        <Button testID="viewer-close-empty" label="Close" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  const share = async () => {
    if (!(await Sharing.isAvailableAsync())) return fb.toast("Sharing isn't available here", "error");
    await Sharing.shareAsync(await localUriFor(cur.id, cur.uri));
  };
  const del = async () => {
    if (!(await fb.confirm({ title: "Delete this item?", message: "It will be removed from your device. Android may ask you to confirm.", destructive: true, confirmLabel: "Delete" }))) return;
    try { if (await deleteMedia([cur])) { fb.toast("Deleted", "success"); router.back(); } } catch (e: any) { fb.toast(e?.message || "Delete failed", "error"); }
  };
  const saveDetails = () => {
    updateMeta([cur.id], { note: note.trim(), caption: caption.trim(), tags: tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) });
    setSheet(false);
    fb.toast("Saved locally", "success");
  };
  const addAnnotation = async () => {
    const t = await fb.prompt({ title: "Add annotation", message: "Stored separately — the original file is never modified.", placeholder: "Annotation text" });
    if (t) setState((s) => ({ annotations: [{ id: uid(), assetId: cur.id, x: 0.5, y: 0.5, text: t, time: Date.now() }, ...s.annotations] }));
  };
  const toClipboard = () => {
    setState((s) => ({ clipboard: [{ id: uid(), uri: cur.uri, label: cur.filename, pinned: false, time: Date.now() }, ...s.clipboard].slice(0, 100) }));
    fb.toast("Added to Visual Clipboard", "success");
  };

  const actions: { icon: IconName; id: string; run: () => void }[] = [
    { icon: m.fav ? "heart" : "heart-outline", id: "favourite", run: () => updateMeta([cur.id], { fav: !m.fav }) },
    { icon: "share-outline", id: "share", run: share },
    { icon: "options-outline", id: "edit", run: () => { if (cur.mediaType === "video") { setBatch([cur]); router.push("/moments"); } else router.push({ pathname: "/editor", params: { id: cur.id } }); } },
    { icon: "information-circle-outline", id: "info", run: () => router.push({ pathname: "/inspector", params: { id: cur.id } }) },
    { icon: "create-outline", id: "notes", run: () => setSheet(true) },
    { icon: "trash-outline", id: "delete", run: del },
  ];
  const curNotes = annotations.filter((a) => a.assetId === cur.id);

  return (
    <View style={st.root} testID="viewer-screen">
      <FlatList
        ref={listRef}
        data={list}
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed}
        initialScrollIndex={i}
        getItemLayout={(_, idx) => ({ length: width, offset: width * idx, index: idx })}
        keyExtractor={(x) => x.id}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / width))}
        windowSize={3}
        renderItem={({ item, index: idx }) => (
          <Press testID={`viewer-page-${idx}`} haptic={false} onPress={() => setChrome((c) => !c)} style={{ width, height, alignItems: "center", justifyContent: "center" }}>
            {item.mediaType === "video" ? (Math.abs(idx - i) === 0 ? <VideoPage uri={item.uri} w={width} h={height * 0.8} active={idx === i} /> : <Image source={{ uri: item.uri }} style={{ width, height }} contentFit="contain" />) : <ZoomableImage uri={item.uri} w={width} h={height} onZoomChange={setZoomed} />}
          </Press>
        )}
      />
      {chrome && (
        <>
          <View style={[st.top, { paddingTop: insets.top + spacing.sm }]}>
            <Press testID="viewer-close-button" onPress={() => router.back()} style={st.circle}><Ionicons name="chevron-back" size={24} color="#FFFFFF" /></Press>
            <View style={{ flex: 1, paddingHorizontal: spacing.sm }}>
              <Text style={st.title} numberOfLines={1}>{new Date(cur.creationTime).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</Text>
              <Text style={st.sub} numberOfLines={1}>{new Date(cur.creationTime).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · {i + 1}/{list.length}</Text>
            </View>
            <Press testID="viewer-clipboard-button" onPress={toClipboard} style={st.circle}><Ionicons name="clipboard-outline" size={20} color="#FFFFFF" /></Press>
            <Press testID="viewer-vault-button" onPress={async () => { if (await fb.confirm({ title: "Move to Vault?", message: "A private copy is stored inside RF Photos and hidden from the gallery.", confirmLabel: "Move" })) { const r = await moveToVault([cur]); fb.toast(r.ok ? "Moved to Vault" : "Vault copy failed", r.ok ? "success" : "error"); if (r.ok) router.back(); } }} style={st.circle}><Ionicons name="lock-closed-outline" size={20} color="#FFFFFF" /></Press>
          </View>
          <View style={[st.bottom, { paddingBottom: insets.bottom + spacing.sm }]}>
            {(!!m.caption || curNotes.length > 0) && <Text testID="viewer-caption" style={st.caption} numberOfLines={2}>{m.caption || curNotes[0]?.text}</Text>}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 3, paddingHorizontal: spacing.lg }} style={{ marginBottom: spacing.sm }}>
              {list.slice(Math.max(0, i - 10), i + 11).map((x) => {
                const idx = list.indexOf(x);
                return (
                  <Press key={x.id} testID={`filmstrip-${idx}`} haptic={false} onPress={() => { setI(idx); listRef.current?.scrollToIndex({ index: idx, animated: false }); }} style={[st.film, idx === i && st.filmActive]}>
                    <Image source={{ uri: x.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  </Press>
                );
              })}
            </ScrollView>
            <View style={st.actions}>
              {actions.map((a) => (
                <Press key={a.id} testID={`viewer-${a.id}-button`} onPress={a.run} style={st.action} accessibilityLabel={a.id}>
                  <Ionicons name={a.icon} size={24} color={a.id === "favourite" && m.fav ? "#FF5E00" : "#FFFFFF"} />
                </Press>
              ))}
            </View>
          </View>
        </>
      )}
      {sheet && (
        <KeyboardAvoidingView behavior="padding" style={st.sheetWrap}>
          <Press testID="viewer-sheet-scrim" haptic={false} onPress={() => setSheet(false)} style={{ flex: 1 }}><View style={{ flex: 1 }} /></Press>
          <View style={[st.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
            <Text style={st.sheetTitle}>Notes, tags & caption</Text>
            <TextInput testID="viewer-caption-input" value={caption} onChangeText={setCaption} placeholder="Caption" placeholderTextColor="#8E8E93" style={st.input} />
            <TextInput testID="viewer-tags-input" value={tags} onChangeText={setTags} placeholder="Tags, comma separated (e.g. trip, beach)" placeholderTextColor="#8E8E93" style={st.input} autoCapitalize="none" />
            <TextInput testID="viewer-note-input" value={note} onChangeText={setNote} placeholder="Private note (searchable)" placeholderTextColor="#8E8E93" style={[st.input, { minHeight: 80, textAlignVertical: "top" }]} multiline />
            {curNotes.map((a) => <Text key={a.id} style={st.sub}>• {a.text}</Text>)}
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <Button testID="viewer-annotate-button" label="Annotation" icon="pin-outline" variant="ghost" onPress={addAnnotation} style={{ flex: 1 }} />
              <View style={{ flex: 1 }}><Button testID="viewer-save-details-button" label="Save" onPress={saveDetails} /></View>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: "#000000" },
  white: { color: "#FFFFFF" },
  top: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, backgroundColor: "rgba(0,0,0,0.35)" },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  title: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  sub: { color: "rgba(255,255,255,0.75)", fontSize: 12 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)", paddingTop: spacing.sm },
  caption: { color: "#FFFFFF", fontSize: 14, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  film: { width: 36, height: 48, borderRadius: 6, overflow: "hidden", opacity: 0.7 },
  filmActive: { opacity: 1, borderWidth: 2, borderColor: "#FF5E00" },
  actions: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: spacing.sm },
  action: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  sheetWrap: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: c.scrim },
  sheet: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, gap: spacing.sm },
  sheetTitle: { color: c.onSurface, fontSize: 20, fontWeight: "700", marginBottom: spacing.sm },
  input: { backgroundColor: c.surfaceTertiary, color: c.onSurface, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 15, minHeight: 48 },
}));

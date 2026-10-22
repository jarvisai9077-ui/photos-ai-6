import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MediaGrid, openViewer } from "@/src/components/MediaGrid";
import { SelectionBar } from "@/src/components/SelectionBar";
import { useFeedback } from "@/src/components/feedback";
import { Button, EmptyState, Header, IconButton, Screen, Body } from "@/src/components/ui";
import { Image } from "expo-image";
import { albumAssets, deleteAlbum, isScreenshot, useAllMedia } from "@/src/media/library";
import { duplicateCandidates } from "@/src/media/analysis";
import { searchMedia } from "@/src/media/search";
import { MediaItem, setState, updateMeta, useStore } from "@/src/store";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Collection() {
  const { key, title: titleParam } = useLocalSearchParams<{ key: string; title?: string }>();
  const insets = useSafeAreaInsets();
  const fb = useFeedback();
  const st = useStyles();
  const { colors } = useTheme();
  const all = useAllMedia();
  const meta = useStore((s) => s.meta);
  const smart = useStore((s) => s.smartAlbums);
  const [albumItems, setAlbumItems] = useState<MediaItem[] | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const albumId = key?.startsWith("album:") ? key.slice(6) : null;
  const rule = key?.startsWith("smart:") ? smart.find((s) => s.id === key.slice(6)) : undefined;

  useEffect(() => {
    if (albumId) albumAssets(albumId).then(setAlbumItems).catch(() => setAlbumItems([]));
  }, [albumId]);

  const { title, items } = useMemo(() => {
    const live = all.filter((m) => !meta[m.id]?.archived);
    switch (key) {
      case "favourites": return { title: "Favourites", items: live.filter((m) => meta[m.id]?.fav) };
      case "videos": return { title: "Videos", items: live.filter((m) => m.mediaType === "video") };
      case "screenshots": return { title: "Screenshots", items: live.filter(isScreenshot) };
      case "large": return { title: "Large videos", items: live.filter((m) => m.mediaType === "video" && m.duration >= 60).sort((a, b) => b.duration - a.duration) };
      case "archive": return { title: "Archive", items: all.filter((m) => meta[m.id]?.archived) };
      case "imported": return { title: "Recently imported", items: live.filter((m) => m.source === "imported") };
      case "duplicates": return { title: "Duplicate review", items: [] };
      default:
        if (albumId) return { title: titleParam || "Album", items: albumItems || [] };
        if (rule) return { title: rule.name, items: rule.paused ? [] : searchMedia(all, rule.query).map((r) => r.item) };
        return { title: "Collection", items: [] };
    }
  }, [key, all, meta, albumItems, albumId, rule, titleParam]);

  const dups = useMemo(() => (key === "duplicates" ? duplicateCandidates(all) : []), [key, all]);
  const toggle = (m: MediaItem) => setSelected((s) => { const n = new Set(s); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; });
  const end = () => { setSelecting(false); setSelected(new Set()); };

  const right = (
    <View style={{ flexDirection: "row" }}>
      {key === "archive" && selecting && <IconButton testID="collection-unarchive-button" name="arrow-undo-outline" label="Unarchive" onPress={() => { updateMeta([...selected], { archived: false }); fb.toast("Restored to Photos", "success"); end(); }} />}
      {rule && <IconButton testID="collection-pause-rule-button" name={rule.paused ? "play-outline" : "pause-outline"} label="Pause rule" onPress={() => setState((s) => ({ smartAlbums: s.smartAlbums.map((r) => (r.id === rule.id ? { ...r, paused: !r.paused } : r)) }))} />}
      {rule && <IconButton testID="collection-delete-rule-button" name="trash-outline" label="Delete rule" onPress={async () => { if (await fb.confirm({ title: "Delete smart album?", message: "Only the rule is deleted. No photos are touched.", destructive: true, confirmLabel: "Delete rule" })) { setState((s) => ({ smartAlbums: s.smartAlbums.filter((r) => r.id !== rule.id) })); router.back(); } }} />}
      {albumId && <IconButton testID="collection-delete-album-button" name="trash-outline" label="Delete album" onPress={async () => { if (await fb.confirm({ title: "Delete album?", message: "Removes the album. Media stays on your device.", destructive: true, confirmLabel: "Delete album" })) { try { await deleteAlbum(albumId); router.back(); } catch (e: any) { fb.toast(e?.message || "Failed", "error"); } } }} />}
      {key !== "duplicates" && <IconButton testID="collection-select-button" name={selecting ? "close" : "checkmark-circle-outline"} onPress={() => (selecting ? end() : setSelecting(true))} />}
    </View>
  );

  if (key === "duplicates") {
    return (
      <Screen>
        <Header title="Duplicate review" subtitle={`${dups.length} candidate groups · nothing is deleted automatically`} />
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
          <Body muted>Candidates share type, resolution and capture second, or the same filename stem. Open one to compare, then delete manually if you are sure.</Body>
          {dups.length === 0 && <EmptyState testID="duplicates-empty" icon="copy-outline" title="No duplicates found" message="Your indexed library has no metadata-identical items." />}
          {dups.map((g, gi) => (
            <View key={gi} style={st.group} testID={`dup-group-${gi}`}>
              <Text style={st.groupTitle}>{g.length} items · {g[0].width}×{g[0].height}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {g.map((m, i) => (
                  <View key={m.id}>
                    <View style={st.dupThumbWrap}>
                      <Image source={{ uri: m.uri }} style={st.dupThumb} contentFit="cover" />
                    </View>
                    <Text style={st.dupName} numberOfLines={1}>{m.filename}</Text>
                    <Button testID={`dup-view-${gi}-${i}`} label="Open" variant="secondary" onPress={() => openViewer(g, i)} style={{ minHeight: 36, marginTop: 4 }} />
                  </View>
                ))}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title={title} subtitle={`${items.length} items${rule ? ` · rule: ${rule.query}${rule.paused ? " (paused)" : ""}` : ""}`} right={right} />
      {albumId && albumItems === null ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <MediaGrid testID="collection-grid" items={items} selecting={selecting} selected={selected} onToggle={toggle} onPressItem={(m, i) => openViewer(items, i)} bottomPad={(selecting ? 150 : 24) + insets.bottom} empty={<EmptyState testID="collection-empty" icon="images-outline" title="Nothing here yet" message={rule?.paused ? "This rule is paused." : "Items that match will appear automatically."} />} />
      )}
      {selecting && <SelectionBar items={items.filter((m) => selected.has(m.id))} onDone={end} bottom={0} />}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  group: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  groupTitle: { color: c.onSurface, fontWeight: "700", fontSize: 15 },
  dupThumbWrap: { width: 120, height: 120, borderRadius: radius.md, overflow: "hidden", backgroundColor: c.surfaceTertiary },
  dupThumb: { width: "100%", height: "100%" },
  dupName: { color: c.muted, fontSize: 12, width: 120, marginTop: 4 },
}));

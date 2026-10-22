import React, { useMemo, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MediaGrid, openViewer } from "@/src/components/MediaGrid";
import { SelectionBar } from "@/src/components/SelectionBar";
import { useFeedback } from "@/src/components/feedback";
import { Chip, ChipRow, EmptyState, Glass, IconButton, Ionicons, IconName, Press, Screen } from "@/src/components/ui";
import { indexLibrary, isScreenshot, requestPermission, useAllMedia, useLibrary, deviceLibraryAvailable } from "@/src/media/library";
import { importMedia } from "@/src/media/importer";
import { groupEvents, onThisDay } from "@/src/media/analysis";
import { MediaItem, useStore } from "@/src/store";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const FILTERS = ["All", "Photos", "Videos", "Favourites", "Screenshots", "Recent"] as const;

export default function PhotosHome() {
  const insets = useSafeAreaInsets();
  const bottomChrome = usesNativeTabs ? insets.bottom : 0;
  const st = useStyles();
  const { colors } = useTheme();
  const fb = useFeedback();
  const all = useAllMedia();
  const status = useLibrary((s) => s.status);
  const permission = useLibrary((s) => s.permission);
  const canAskAgain = useLibrary((s) => s.canAskAgain);
  const total = useLibrary((s) => s.total);
  const libError = useLibrary((s) => s.error);
  const meta = useStore((s) => s.meta);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    const base = all.filter((m) => !meta[m.id]?.archived);
    const week = Date.now() - 7 * 86400000;
    switch (filter) {
      case "Photos": return base.filter((m) => m.mediaType === "photo");
      case "Videos": return base.filter((m) => m.mediaType === "video");
      case "Favourites": return base.filter((m) => meta[m.id]?.fav);
      case "Screenshots": return base.filter(isScreenshot);
      case "Recent": return base.filter((m) => m.creationTime >= week);
      default: return base;
    }
  }, [all, meta, filter]);

  const memory = useMemo(() => {
    const otd = onThisDay(all);
    if (otd.length) return { title: "On this day", sub: `${otd.length} items from past years`, items: otd };
    const ev = groupEvents(all)[0];
    if (ev) return { title: new Date(ev[0].creationTime).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }), sub: `${ev.length} items · recent event`, items: ev };
    return null;
  }, [all]);

  const toggle = (m: MediaItem) => setSelected((s) => { const n = new Set(s); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n; });
  const endSelect = () => { setSelecting(false); setSelected(new Set()); };
  const doImport = async () => {
    const r = await importMedia("picker");
    if (r.count || r.skipped) fb.toast(`Imported ${r.count}${r.skipped ? `, skipped ${r.skipped}` : ""}`, r.skipped ? "error" : "success");
  };

  const quick: { icon: IconName; label: string; route: string; tint: string }[] = [
    { icon: "camera", label: "Camera", route: "/camera", tint: colors.pastelPeach },
    { icon: "color-wand", label: "Create", route: "/create", tint: colors.pastelLavender },
    { icon: "albums", label: "Albums", route: "/albums", tint: colors.pastelPowderBlue },
    { icon: "document-text", label: "Docs", route: "/documents", tint: colors.pastelMint },
    { icon: "sparkles", label: "Agent", route: "/agent", tint: colors.pastelBlushPink },
    { icon: "pie-chart", label: "Storage", route: "/storage", tint: colors.pastelCream },
  ];

  const header = (
    <View>
      <View style={st.quickRow}>
        {quick.map((q) => (
          <Press key={q.label} testID={`quick-${q.label.toLowerCase()}`} onPress={() => router.push(q.route as any)} style={st.quick}>
            <View style={[st.quickIcon, { backgroundColor: q.tint }]}><Ionicons name={q.icon} size={22} color={colors.brandPrimary} /></View>
            <Text style={st.quickLabel}>{q.label}</Text>
          </Press>
        ))}
      </View>
      {memory && (
        <Press testID="memory-card" onPress={() => openViewer(memory.items, 0)} style={st.memory}>
          <Image source={{ uri: memory.items[0].uri }} style={st.memoryImg} contentFit="cover" />
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.65)"]} style={st.memoryScrim} />
          <View style={st.memoryText}>
            <Text style={st.memoryKicker}>MEMORIES</Text>
            <Text style={st.memoryTitle}>{memory.title}</Text>
            <Text style={st.memorySub}>{memory.sub}</Text>
          </View>
        </Press>
      )}
      <View style={st.gridHead}>
        <Text style={st.gridTitle}>Library</Text>
        <Text testID="library-count" style={st.gridCount}>{visible.length} items{deviceLibraryAvailable && total > all.length ? ` · indexing ${all.length}/${total}` : ""}</Text>
      </View>
    </View>
  );

  let empty: React.ReactElement;
  if (deviceLibraryAvailable && (permission === "undetermined" || status === "idle")) {
    empty = <EmptyState testID="permission-state" icon="images-outline" title="Show your photos" message="RF Photos reads your device photos and videos locally to build your gallery. Nothing ever leaves your phone." action="Allow access" onAction={requestPermission} />;
  } else if (deviceLibraryAvailable && permission === "denied") {
    empty = <EmptyState testID="permission-denied-state" icon="lock-closed-outline" title="Photo access is off" message="Allow access to your photos and videos to browse them in RF Photos. You can still import files manually." action={canAskAgain ? "Try again" : "Open Settings"} onAction={() => (canAskAgain ? requestPermission() : Linking.openSettings())} />;
  } else if (status === "error") {
    empty = <EmptyState testID="error-state" icon="warning-outline" title="Couldn't read your library" message={libError || "The media library returned an error."} action="Retry" onAction={indexLibrary} />;
  } else if (filter !== "All") {
    empty = <EmptyState testID="filter-empty-state" icon="search-outline" title={`No ${filter.toLowerCase()} yet`} message="Nothing in your library matches this filter." />;
  } else {
    empty = <EmptyState testID="empty-library-state" icon="camera-outline" title="No photos yet" message={Platform.OS === "web" ? "The web preview can't read a device gallery. Import photos to try RF Photos here — on Android your whole library appears automatically." : "Start capturing your memories or import files."} action="Import photos" onAction={doImport} />;
  }

  return (
    <Screen>
      <Glass style={[st.top, { paddingTop: insets.top + spacing.sm }]}>
        <View style={st.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={st.brandKicker}>RF ALPHABET</Text>
            <Text testID="home-title" style={st.title}>RF Photos</Text>
          </View>
          <IconButton testID="home-import-button" name="add-circle-outline" label="Import" onPress={doImport} />
          <IconButton testID="home-select-button" name={selecting ? "close" : "checkmark-circle-outline"} label="Select" onPress={() => (selecting ? endSelect() : setSelecting(true))} />
          <IconButton testID="home-settings-button" name="settings-outline" label="Settings" onPress={() => router.push("/settings")} />
        </View>
        <Press testID="home-search-bar" onPress={() => router.push("/search")} style={st.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <Text style={st.searchText}>Search “videos last october”, tags, notes…</Text>
        </Press>
        <ChipRow>
          {FILTERS.map((f) => <Chip key={f} testID={`filter-${f.toLowerCase()}`} label={f} active={filter === f} onPress={() => setFilter(f)} />)}
        </ChipRow>
      </Glass>
      <MediaGrid
        testID="home-media-grid"
        items={visible}
        header={filter === "All" && visible.length ? header : <View style={st.gridHead}><Text style={st.gridCount}>{visible.length} items</Text></View>}
        empty={empty}
        selecting={selecting}
        selected={selected}
        onToggle={toggle}
        bottomPad={(selecting ? 150 : 24) + bottomChrome}
        onRefresh={deviceLibraryAvailable ? indexLibrary : undefined}
        refreshing={false}
      />
      {selecting && <SelectionBar items={visible.filter((m) => selected.has(m.id))} onDone={endSelect} bottom={bottomChrome} />}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  top: { borderBottomWidth: 0.5, borderBottomColor: c.border },
  titleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingRight: spacing.sm },
  brandKicker: { color: c.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: c.onSurface, fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  search: { marginHorizontal: spacing.lg, marginTop: spacing.sm, height: 46, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  searchText: { color: c.muted, fontSize: 15, flex: 1 },
  quickRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  quick: { alignItems: "center", width: 58, gap: 6 },
  quickIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  quickLabel: { color: c.onSurface, fontSize: 12, fontWeight: "500" },
  memory: { marginHorizontal: spacing.lg, marginTop: spacing.xl, height: 180, borderRadius: radius.xl, overflow: "hidden", backgroundColor: c.surfaceTertiary },
  memoryImg: { width: "100%", height: "100%" },
  memoryScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 120 },
  memoryText: { position: "absolute", left: spacing.lg, bottom: spacing.lg },
  memoryKicker: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, opacity: 0.85 },
  memoryTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  memorySub: { color: "#FFFFFF", fontSize: 13, opacity: 0.9 },
  gridHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.sm },
  gridTitle: { color: c.onSurface, fontSize: 20, fontWeight: "700" },
  gridCount: { color: c.muted, fontSize: 13 },
}));

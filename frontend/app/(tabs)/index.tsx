import React, { useMemo, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MediaGrid, openViewer } from "@/src/components/MediaGrid";
import { SelectionBar } from "@/src/components/SelectionBar";
import { useSelection } from "@/src/components/useSelection";
import { useFeedback } from "@/src/components/feedback";
import { Chip, ChipRow, EmptyState, Glass, IconButton, Ionicons, IconName, Press, Screen } from "@/src/components/ui";
import { indexLibrary, isScreenshot, manageLimitedAccess, requestPermission, useAllMedia, useLibrary, deviceLibraryAvailable } from "@/src/media/library";
import { importMedia, importSummary } from "@/src/media/importer";
import { groupEvents, onThisDay } from "@/src/media/analysis";
import { playSlideshow } from "@/src/media/slideshow";
import { useStore } from "@/src/store";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const FILTERS = ["All", "Photos", "Videos", "Favourites", "Screenshots", "Recent"] as const;

function LegalLinks() {
  const st = useStyles();
  return (
    <View style={st.legalRow}>
      <Press testID="home-privacy-policy-link" onPress={() => router.push("/legal/privacy-policy")} style={st.legalBtn}><Text style={st.legalText}>Privacy Policy</Text></Press>
      <Text style={st.legalDot}>·</Text>
      <Press testID="home-terms-link" onPress={() => router.push("/legal/terms")} style={st.legalBtn}><Text style={st.legalText}>Terms & Conditions</Text></Press>
    </View>
  );
}

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
  const indexed = useLibrary((s) => s.items.length);
  const libError = useLibrary((s) => s.error);
  const meta = useStore((s) => s.meta);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);

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
  const sel = useSelection(visible);

  const memory = useMemo(() => {
    const otd = onThisDay(all);
    if (otd.length) return { title: "On this day", sub: `${otd.length} items from past years`, items: otd };
    const ev = groupEvents(all)[0];
    if (ev) return { title: new Date(ev[0].creationTime).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }), sub: `${ev.length} items · recent event`, items: ev };
    return null;
  }, [all]);

  const doImport = async () => {
    if (importing) return;
    setImporting(true);
    try {
      const r = await importMedia("picker");
      if (!r.cancelled) fb.toast(importSummary(r), r.skipped ? "error" : "success");
    } catch (e: any) {
      fb.toast(e?.message || "Import failed", "error");
    } finally {
      setImporting(false);
    }
  };
  const refresh = async () => {
    setRefreshing(true);
    try { await indexLibrary(true); } finally { setRefreshing(false); }
  };

  const quick: { icon: IconName; label: string; route: string; tint: string }[] = [
    { icon: "camera", label: "Camera", route: "/camera", tint: colors.pastelPeach },
    { icon: "color-wand", label: "Create", route: "/create", tint: colors.pastelLavender },
    { icon: "albums", label: "Albums", route: "/albums", tint: colors.pastelPowderBlue },
    { icon: "document-text", label: "Docs", route: "/documents", tint: colors.pastelMint },
    { icon: "sparkles", label: "Agent", route: "/agent", tint: colors.pastelBlushPink },
    { icon: "pie-chart", label: "Storage", route: "/storage", tint: colors.pastelCream },
  ];

  const limitedBanner = deviceLibraryAvailable && permission === "limited" ? (
    <Press testID="limited-access-banner" onPress={manageLimitedAccess} style={st.banner}>
      <Ionicons name="information-circle" size={20} color={colors.brandPrimary} />
      <Text style={st.bannerText}>RF Photos can see only the photos you selected. Tap to choose more or allow all.</Text>
    </Press>
  ) : null;

  const header = (
    <View>
      {limitedBanner}
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
          <Image source={{ uri: memory.items[0].thumb || memory.items[0].uri }} style={st.memoryImg} contentFit="cover" />
          <LinearGradient colors={["transparent", "rgba(0,0,0,0.65)"]} style={st.memoryScrim} />
          <View style={st.memoryText}>
            <Text style={st.memoryKicker}>MEMORIES</Text>
            <Text style={st.memoryTitle}>{memory.title}</Text>
            <Text style={st.memorySub}>{memory.sub}</Text>
          </View>
          <Press testID="memory-play-button" onPress={() => playSlideshow(memory.title, memory.items)} style={st.memoryPlay} accessibilityLabel="Play memory slideshow">
            <Ionicons name="play" size={22} color="#FFFFFF" />
          </Press>
        </Press>
      )}
      <View style={st.gridHead}>
        <Text style={st.gridTitle}>Library</Text>
        <Text testID="library-count" style={st.gridCount}>{visible.length} items{deviceLibraryAvailable && status !== "ready" && total > indexed ? ` · indexing ${indexed}/${total}` : ""}</Text>
      </View>
    </View>
  );

  let empty: React.ReactElement;
  if (status === "expo-go" && filter === "All") {
    empty = (
      <View>
        <EmptyState testID="expo-go-state" icon="images-outline" title="Import your photos" message="In this preview app Android doesn't allow full gallery access. Choose photos and videos from your phone to add them. The installed RF Photos app shows your whole gallery automatically." action={importing ? "Importing…" : "Choose photos & videos"} onAction={doImport} />
        <LegalLinks />
      </View>
    );
  } else if (deviceLibraryAvailable && (permission === "undetermined" || status === "idle")) {
    empty = (
      <View>
        <EmptyState testID="permission-state" icon="images-outline" title="Show your photos & videos" message="RF Photos reads the photos and videos on this phone (Camera, WhatsApp, Screenshots, Downloads and other folders) to build your gallery. Everything is processed on this device and nothing is uploaded." action="Allow access" onAction={requestPermission} />
        <LegalLinks />
      </View>
    );
  } else if (deviceLibraryAvailable && permission === "denied") {
    empty = (
      <View>
        <EmptyState testID="permission-denied-state" icon="lock-closed-outline" title="Photo access is off" message={canAskAgain ? "Allow access to see your gallery here, or import individual files instead." : "Android won't ask again. Open Settings › Permissions › Photos and videos and choose Allow, or import individual files instead."} action={canAskAgain ? "Allow access" : "Open Settings"} onAction={() => (canAskAgain ? requestPermission() : Linking.openSettings())} />
        <Press testID="permission-import-instead" onPress={doImport} style={st.altBtn}><Text style={st.legalText}>Import files instead</Text></Press>
        <LegalLinks />
      </View>
    );
  } else if (status === "loading") {
    empty = <EmptyState testID="loading-state" icon="images-outline" title="Reading your gallery…" message="Your photos appear in a moment." />;
  } else if (status === "error" && !all.length) {
    empty = <EmptyState testID="error-state" icon="warning-outline" title="Couldn't read your gallery" message={libError || "The media library returned an error."} action="Try again" onAction={() => indexLibrary(true)} />;
  } else if (filter !== "All") {
    empty = <EmptyState testID="filter-empty-state" icon="search-outline" title={`No ${filter.toLowerCase()} yet`} message="Nothing in your library matches this filter." />;
  } else {
    empty = <EmptyState testID="empty-library-state" icon="camera-outline" title="No photos yet" message={Platform.OS === "web" ? "The web preview can't read a phone gallery. Import photos and videos to try RF Photos here." : "Take a photo or import files to get started."} action={importing ? "Importing…" : "Import photos"} onAction={doImport} />;
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
          <IconButton testID="home-select-button" name={sel.selecting ? "close" : "checkmark-circle-outline"} label={sel.selecting ? "Cancel selection" : "Select"} onPress={() => (sel.selecting ? sel.end() : sel.start())} />
          <IconButton testID="home-settings-button" name="settings-outline" label="Settings" onPress={() => router.push("/settings")} />
        </View>
        <Press testID="home-search-bar" onPress={() => router.push("/search")} style={st.search}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <Text style={st.searchText} numberOfLines={1}>Search “videos last october”, tags, notes…</Text>
        </Press>
        <ChipRow>
          {FILTERS.map((f) => <Chip key={f} testID={`filter-${f.toLowerCase()}`} label={f} active={filter === f} onPress={() => setFilter(f)} />)}
        </ChipRow>
      </Glass>
      <MediaGrid
        testID="home-media-grid"
        items={visible}
        header={filter === "All" && visible.length ? header : visible.length ? <View>{limitedBanner}<View style={st.gridHead}><Text style={st.gridCount}>{visible.length} items</Text></View></View> : null}
        empty={empty}
        selecting={sel.selecting}
        selected={sel.selected}
        onToggle={sel.toggle}
        onToggleMany={sel.toggleMany}
        onLongPress={(m) => (sel.selecting ? sel.toggle(m) : sel.start(m))}
        bottomPad={(sel.selecting ? 170 : 24) + bottomChrome}
        onRefresh={deviceLibraryAvailable ? refresh : undefined}
        refreshing={refreshing}
      />
      {sel.selecting && <SelectionBar items={sel.items} total={visible.length} onDone={sel.end} onSelectAll={sel.selectAll} onClear={sel.clear} bottom={bottomChrome} />}
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
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: c.brandTertiary },
  bannerText: { color: c.onBrandTertiary, fontSize: 13, fontWeight: "500", flex: 1 },
  quickRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingTop: spacing.lg },
  quick: { alignItems: "center", width: 58, gap: 6 },
  quickIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  quickLabel: { color: c.onSurface, fontSize: 11, fontWeight: "500" },
  memory: { marginHorizontal: spacing.lg, marginTop: spacing.xl, height: 180, borderRadius: radius.xl, overflow: "hidden", backgroundColor: c.surfaceTertiary },
  memoryImg: { width: "100%", height: "100%" },
  memoryScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: 120 },
  memoryText: { position: "absolute", left: spacing.lg, bottom: spacing.lg, right: 80 },
  memoryKicker: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", letterSpacing: 1.2, opacity: 0.85 },
  memoryTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  memorySub: { color: "#FFFFFF", fontSize: 13, opacity: 0.9 },
  memoryPlay: { position: "absolute", right: spacing.lg, bottom: spacing.lg, width: 52, height: 52, borderRadius: 26, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  gridHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xs },
  gridTitle: { color: c.onSurface, fontSize: 20, fontWeight: "700" },
  gridCount: { color: c.muted, fontSize: 13 },
  legalRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: spacing.sm },
  legalBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  legalText: { color: c.brandPrimary, fontSize: 14, fontWeight: "600" },
  legalDot: { color: c.muted },
  altBtn: { alignSelf: "center", minHeight: 44, justifyContent: "center", marginTop: spacing.sm },
}));

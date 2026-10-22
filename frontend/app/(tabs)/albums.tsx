import React, { useMemo } from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Header, Ionicons, IconName, Press, Screen, SectionTitle, Body } from "@/src/components/ui";
import { useFeedback } from "@/src/components/feedback";
import { deviceLibraryAvailable, isScreenshot, useAllMedia, useLibrary } from "@/src/media/library";
import { duplicateCandidates } from "@/src/media/analysis";
import { setState, uid, useStore } from "@/src/store";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, ThemeColors, useTheme } from "@/src/theme";

export default function Albums() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const { colors } = useTheme();
  const fb = useFeedback();
  const { width } = useWindowDimensions();
  const all = useAllMedia();
  const albums = useLibrary((s) => s.albums);
  const meta = useStore((s) => s.meta);
  const smart = useStore((s) => s.smartAlbums);
  const vaultCount = useStore((s) => s.vault.length);
  const cardW = (Math.min(width, 900) - spacing.lg * 2 - spacing.md) / 2;

  const counts = useMemo(() => ({
    fav: all.filter((m) => meta[m.id]?.fav).length,
    videos: all.filter((m) => m.mediaType === "video").length,
    shots: all.filter(isScreenshot).length,
    archive: all.filter((m) => meta[m.id]?.archived).length,
    dups: duplicateCandidates(all).length,
    imported: all.filter((m) => m.source === "imported").length,
  }), [all, meta]);

  const coverFor = (albumId: string) => all.find((m) => m.albumId === albumId)?.uri;
  const smartCards: { key: string; title: string; count: string; icon: IconName; tint: keyof ThemeColors }[] = [
    { key: "favourites", title: "Favourites", count: `${counts.fav}`, icon: "heart", tint: "pastelBlushPink" },
    { key: "videos", title: "Videos", count: `${counts.videos}`, icon: "videocam", tint: "pastelPowderBlue" },
    { key: "screenshots", title: "Screenshots", count: `${counts.shots}`, icon: "phone-portrait", tint: "pastelLavender" },
    { key: "duplicates", title: "Duplicate review", count: `${counts.dups} groups`, icon: "copy", tint: "pastelPeach" },
    { key: "large", title: "Large videos", count: "≥ 60 s", icon: "film", tint: "pastelMint" },
    { key: "archive", title: "Archive", count: `${counts.archive}`, icon: "archive", tint: "pastelCream" },
    { key: "imported", title: "Recently imported", count: `${counts.imported}`, icon: "download", tint: "pastelPowderBlue" },
  ];

  const newSmart = async () => {
    const q = await fb.prompt({ title: "New smart album", message: "Smart albums are saved searches that update automatically. Example: “portrait videos 2024” or “screenshots last month”.", placeholder: "Rule (search query)" });
    if (!q) return;
    const name = (await fb.prompt({ title: "Name it", placeholder: "Album name", initial: q })) || q;
    setState((s) => ({ smartAlbums: [{ id: uid(), name, query: q, created: Date.now() }, ...s.smartAlbums] }));
    fb.toast("Smart album created", "success");
  };

  return (
    <Screen>
      <Header title="Albums" back={false} subtitle={deviceLibraryAvailable ? `${albums.length} device albums` : "Device albums appear on Android"} right={<Press testID="albums-new-smart-button" onPress={newSmart} style={st.addBtn}><Ionicons name="add" size={22} color={colors.onBrandPrimary} /></Press>} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl + (usesNativeTabs ? insets.bottom : 0) }}>
        <SectionTitle title="Smart collections" />
        <View style={st.grid}>
          {smartCards.map((c) => (
            <Press key={c.key} testID={`smart-${c.key}`} onPress={() => router.push({ pathname: "/collection/[key]", params: { key: c.key } })} style={[st.smart, { width: cardW, backgroundColor: colors[c.tint] }]}>
              <Ionicons name={c.icon} size={24} color={colors.brandPrimary} />
              <Text style={st.smartTitle}>{c.title}</Text>
              <Text style={st.smartCount}>{c.count}</Text>
            </Press>
          ))}
          <Press testID="smart-vault" onPress={() => router.push("/vault")} style={[st.smart, { width: cardW, backgroundColor: colors.surfaceInverse }]}>
            <Ionicons name="lock-closed" size={24} color={colors.brandPrimary} />
            <Text style={[st.smartTitle, { color: colors.onSurfaceInverse }]}>Private Vault</Text>
            <Text style={[st.smartCount, { color: colors.onSurfaceInverse }]}>{vaultCount} protected</Text>
          </Press>
        </View>

        <SectionTitle title="Your smart albums" action="New" onAction={newSmart} testID="smart-albums-new" />
        {smart.length === 0 ? (
          <Body muted style={{ paddingHorizontal: spacing.lg }}>No rules yet. Create one from a search like “videos last month”.</Body>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {smart.map((s) => (
              <Press key={s.id} testID={`user-smart-${s.id}`} onPress={() => router.push({ pathname: "/collection/[key]", params: { key: `smart:${s.id}` } })} style={st.ruleRow}>
                <LinearGradient colors={[colors.pastelLavender, colors.pastelPeach]} style={st.ruleIcon}><Ionicons name="sparkles" size={18} color={colors.brandPrimary} /></LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={st.albumTitle}>{s.name}{s.paused ? " (paused)" : ""}</Text>
                  <Text style={st.albumCount}>Rule: {s.query}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Press>
            ))}
          </View>
        )}

        <SectionTitle title="Device albums" />
        {!deviceLibraryAvailable ? (
          <Body muted style={{ paddingHorizontal: spacing.lg }}>Folders like Camera, Screenshots and Downloads are read from Android MediaStore on your device.</Body>
        ) : albums.length === 0 ? (
          <Body muted style={{ paddingHorizontal: spacing.lg }}>No albums found yet.</Body>
        ) : (
          <View style={st.grid}>
            {albums.filter((a) => a.assetCount > 0).map((a) => {
              const cover = coverFor(a.id);
              return (
                <Press key={a.id} testID={`album-${a.id}`} onPress={() => router.push({ pathname: "/collection/[key]", params: { key: `album:${a.id}`, title: a.title } })} style={{ width: cardW }}>
                  <View style={[st.cover, { width: cardW, height: cardW }]}>
                    {cover ? <Image source={{ uri: cover }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Ionicons name="images-outline" size={32} color={colors.muted} />}
                  </View>
                  <Text style={st.albumTitle} numberOfLines={1}>{a.title}</Text>
                  <Text style={st.albumCount}>{a.assetCount}</Text>
                </Press>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center", marginRight: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, paddingHorizontal: spacing.lg },
  smart: { height: 112, borderRadius: radius.lg, padding: spacing.lg, justifyContent: "flex-end", gap: 2 },
  smartTitle: { color: c.onPastel, fontSize: 16, fontWeight: "700", marginTop: spacing.sm },
  smartCount: { color: c.onPastel, opacity: 0.7, fontSize: 13 },
  cover: { borderRadius: radius.lg, backgroundColor: c.surfaceTertiary, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  albumTitle: { color: c.onSurface, fontSize: 15, fontWeight: "600", marginTop: spacing.sm },
  albumCount: { color: c.muted, fontSize: 13 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md },
  ruleIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
}));

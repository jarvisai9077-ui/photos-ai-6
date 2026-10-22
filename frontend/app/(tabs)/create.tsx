import React from "react";
import { ScrollView, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Header, Ionicons, IconName, Press, Screen, SectionTitle } from "@/src/components/ui";
import { useStore } from "@/src/store";
import { usesNativeTabs } from "@/src/navigation";
import { makeStyles, radius, spacing, ThemeColors, useTheme } from "@/src/theme";
import { setBatch } from "@/src/components/SelectionBar";

const TOOLS: { id: string; title: string; sub: string; icon: IconName; route: string; tint: keyof ThemeColors }[] = [
  { id: "editor", title: "Photo Editor", sub: "Crop, rotate, colour, filters", icon: "options", route: "/editor", tint: "pastelPeach" },
  { id: "collage", title: "Collage & Posters", sub: "Templates, text, export", icon: "grid", route: "/collage", tint: "pastelLavender" },
  { id: "scanner", title: "Document Studio", sub: "Scan pages → PDF", icon: "document-text", route: "/documents", tint: "pastelMint" },
  { id: "moments", title: "Best Moments", sub: "Frames from videos", icon: "film", route: "/moments", tint: "pastelPowderBlue" },
  { id: "camera", title: "Camera", sub: "Photo, video, recipes", icon: "camera", route: "/camera", tint: "pastelBlushPink" },
  { id: "batch", title: "Batch Pipeline", sub: "Resize, convert, export", icon: "construct", route: "/automation", tint: "pastelCream" },
  { id: "compare", title: "Before / After Lab", sub: "Compare versions", icon: "git-compare", route: "/timemachine", tint: "pastelPeach" },
  { id: "brand", title: "Brand Kit", sub: "Watermark & colours", icon: "color-palette", route: "/brand", tint: "pastelLavender" },
];

export default function Create() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const projects = useStore((s) => s.projects);
  const cardW = (Math.min(width, 900) - spacing.lg * 2 - spacing.md) / 2;

  return (
    <Screen>
      <Header title="Create" back={false} subtitle="Creation Studio · everything runs on-device" />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl + (usesNativeTabs ? insets.bottom : 0) }}>
        <Press testID="create-hero-collage" onPress={() => { setBatch([]); router.push("/collage"); }} style={st.heroWrap}>
          <LinearGradient colors={[colors.pastelPeach, colors.pastelBlushPink, colors.pastelLavender]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.hero}>
            <View style={{ flex: 1 }}>
              <Text style={st.heroKicker}>CREATION STUDIO</Text>
              <Text style={st.heroTitle}>Start a collage</Text>
              <Text style={st.heroSub}>Grids, stories, posters & contact sheets</Text>
            </View>
            <View style={st.heroBtn}><Ionicons name="arrow-forward" size={22} color={colors.onBrandPrimary} /></View>
          </LinearGradient>
        </Press>
        <SectionTitle title="Tools" />
        <View style={st.grid}>
          {TOOLS.map((t) => (
            <Press key={t.id} testID={`create-tool-${t.id}`} onPress={() => { setBatch([]); router.push(t.route as any); }} style={[st.tool, { width: cardW }]}>
              <View style={[st.toolIcon, { backgroundColor: colors[t.tint] }]}><Ionicons name={t.icon} size={22} color={colors.brandPrimary} /></View>
              <Text style={st.toolTitle}>{t.title}</Text>
              <Text style={st.toolSub}>{t.sub}</Text>
            </Press>
          ))}
        </View>
        <SectionTitle title="Projects" action={projects.length ? `${projects.length}` : undefined} />
        {projects.length === 0 ? (
          <Text style={[st.toolSub, { paddingHorizontal: spacing.lg }]}>Saved designs appear here and stay editable.</Text>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {projects.map((p) => (
              <Press key={p.id} testID={`project-${p.id}`} onPress={() => router.push({ pathname: "/collage", params: { project: p.id } })} style={st.project}>
                <Ionicons name="layers" size={20} color={colors.brandPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={st.toolTitle}>{p.title}</Text>
                  <Text style={st.toolSub}>{p.template} · {p.uris.length} photos · {new Date(p.updated).toLocaleDateString()}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Press>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  heroWrap: { marginHorizontal: spacing.lg, marginTop: spacing.lg },
  hero: { borderRadius: radius.xl, padding: spacing.xl, flexDirection: "row", alignItems: "center", minHeight: 150 },
  heroKicker: { color: c.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  heroTitle: { color: c.onPastel, fontSize: 26, fontWeight: "800", marginTop: 4, letterSpacing: -0.5 },
  heroSub: { color: c.onPastel, opacity: 0.75, fontSize: 14, marginTop: 4 },
  heroBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, paddingHorizontal: spacing.lg },
  tool: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, minHeight: 128, shadowColor: c.shadow, shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  toolIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  toolTitle: { color: c.onSurface, fontSize: 15, fontWeight: "700" },
  toolSub: { color: c.muted, fontSize: 13, marginTop: 2 },
  project: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg },
}));

// Shared layout for the Privacy Policy and Terms & Conditions screens.
import React from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Header, Ionicons, Press, Screen } from "./ui";
import { useFeedback } from "./feedback";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export const SUPPORT_EMAIL = "jarvisai9077@gmail.com";
export const LEGAL_EFFECTIVE = "24 October 2026";

export type LegalSection = { title: string; body?: string[]; bullets?: string[] };

export function LegalDoc({ title, intro, sections, other, testID }: { title: string; intro: string; sections: LegalSection[]; other: { label: string; route: "/legal/privacy-policy" | "/legal/terms" }; testID: string }) {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const { colors } = useTheme();
  const fb = useFeedback();
  const email = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`RF Photos – ${title}`)}`;
    try {
      await Linking.openURL(url);
    } catch {
      fb.toast(`No email app found. Write to ${SUPPORT_EMAIL}`, "info");
    }
  };
  return (
    <Screen>
      <Header title={title} subtitle={`Effective ${LEGAL_EFFECTIVE}`} />
      <ScrollView testID={testID} contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl, gap: spacing.lg, maxWidth: 820, alignSelf: "center", width: "100%" }}>
        <View style={st.hero}>
          <Image source={require("@/assets/images/logo.png")} style={st.logo} contentFit="contain" accessibilityLabel="RF Photos logo" />
          <View style={{ flex: 1 }}>
            <Text style={st.heroTitle}>RF Photos</Text>
            <Text style={st.heroSub}>by RF Alphabet</Text>
          </View>
        </View>
        <Text style={st.intro}>{intro}</Text>
        <View style={st.toc}>
          {sections.map((s, i) => (
            <Text key={s.title} style={st.tocItem}>{i + 1}. {s.title}</Text>
          ))}
        </View>
        {sections.map((s, i) => (
          <View key={s.title} style={st.section} testID={`legal-section-${i + 1}`}>
            <Text style={st.h}>{i + 1}. {s.title}</Text>
            {s.body?.map((p, k) => <Text key={k} style={st.p}>{p}</Text>)}
            {s.bullets?.map((b, k) => (
              <View key={k} style={st.bulletRow}>
                <View style={[st.dot, { backgroundColor: colors.brandPrimary }]} />
                <Text style={[st.p, { flex: 1 }]}>{b}</Text>
              </View>
            ))}
          </View>
        ))}
        <View style={st.contact}>
          <Text style={st.h}>Contact & support</Text>
          <Text style={st.p}>Questions, requests or complaints about RF Photos: email us and we will reply as soon as possible, and within 30 days.</Text>
          <Press testID="legal-email-button" onPress={email} style={st.emailBtn}>
            <Ionicons name="mail-outline" size={18} color={colors.onBrandPrimary} />
            <Text style={st.emailText}>{SUPPORT_EMAIL}</Text>
          </Press>
        </View>
        <Press testID="legal-other-link" onPress={() => router.replace(other.route)} style={st.otherBtn}>
          <Text style={st.otherText}>Read the {other.label}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.brandPrimary} />
        </Press>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  hero: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg },
  logo: { width: 56, height: 56, borderRadius: 14 },
  heroTitle: { color: c.onSurface, fontSize: 20, fontWeight: "800" },
  heroSub: { color: c.muted, fontSize: 13 },
  intro: { color: c.onSurface, fontSize: 15, lineHeight: 23 },
  toc: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: 4 },
  tocItem: { color: c.onSurfaceSecondary, fontSize: 14, lineHeight: 21 },
  section: { gap: spacing.sm },
  h: { color: c.onSurface, fontSize: 18, fontWeight: "700", letterSpacing: -0.2 },
  p: { color: c.onSurfaceSecondary, fontSize: 15, lineHeight: 23 },
  bulletRow: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  contact: { backgroundColor: c.brandTertiary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  emailBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: c.brandPrimary, minHeight: 48, borderRadius: radius.pill, paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  emailText: { color: c.onBrandPrimary, fontSize: 15, fontWeight: "600" },
  otherBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, minHeight: 48 },
  otherText: { color: c.brandPrimary, fontSize: 15, fontWeight: "600" },
}));

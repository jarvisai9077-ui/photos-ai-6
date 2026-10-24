import React from "react";
import { Linking, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import Constants from "expo-constants";
import { SUPPORT_EMAIL } from "@/src/components/LegalDoc";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, Chip, ChipRow, Header, Row, Screen, SectionTitle, ToggleRow, Body } from "@/src/components/ui";
import { setState, useStore } from "@/src/store";
import { lockVault } from "@/src/media/vault";
import { spacing } from "@/src/theme";

export default function Settings() {
  const insets = useSafeAreaInsets();
  const prefs = useStore((s) => s.prefs);
  const set = (k: keyof typeof prefs, v: any) => setState((s) => ({ prefs: { ...s.prefs, [k]: v } }));
  return (
    <Screen>
      <Header title="Settings" />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <SectionTitle title="Appearance" />
        <ChipRow>
          {(["system", "light", "dark"] as const).map((t) => <Chip key={t} testID={`theme-${t}`} label={t[0].toUpperCase() + t.slice(1)} active={prefs.theme === t} onPress={() => set("theme", t)} />)}
        </ChipRow>
        <Body muted style={{ paddingHorizontal: spacing.lg }}>Grid columns</Body>
        <ChipRow>{[3, 4, 5].map((n) => <Chip key={n} testID={`grid-cols-${n}`} label={`${n} columns`} active={prefs.gridColumns === n} onPress={() => set("gridColumns", n)} />)}</ChipRow>
        <SectionTitle title="Accessibility" />
        <Card style={{ marginHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
          <ToggleRow testID="settings-reduced-motion" icon="pulse-outline" title="Reduce motion" subtitle="Disable press animations" value={prefs.reducedMotion} onChange={(v) => set("reducedMotion", v)} />
        </Card>
        <SectionTitle title="Vault" />
        <Body muted style={{ paddingHorizontal: spacing.lg }}>Auto-lock after</Body>
        <ChipRow>{[1, 5, 15].map((n) => <Chip key={n} testID={`vault-timeout-${n}`} label={`${n} min`} active={prefs.vaultTimeoutMin === n} onPress={() => { set("vaultTimeoutMin", n); lockVault(); }} />)}</ChipRow>
        <SectionTitle title="More" />
        <Card style={{ marginHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
          <Row testID="settings-privacy" icon="shield-checkmark-outline" title="Privacy Center" onPress={() => router.push("/privacy")} />
          <Row testID="settings-backup" icon="save-outline" title="Backup & Recovery" onPress={() => router.push("/backup")} />
          <Row testID="settings-brand" icon="color-palette-outline" title="Brand Kit" onPress={() => router.push("/brand")} />
          <Row testID="settings-status" icon="checkmark-done-outline" title="Feature Status Report" onPress={() => router.push("/status")} />
        </Card>
        <SectionTitle title="Legal & support" />
        <Card style={{ marginHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
          <Row testID="settings-privacy-policy" icon="document-lock-outline" title="Privacy Policy" subtitle="What RF Photos accesses and stores" onPress={() => router.push("/legal/privacy-policy")} />
          <Row testID="settings-terms" icon="reader-outline" title="Terms & Conditions" subtitle="Rules, limits and your rights" onPress={() => router.push("/legal/terms")} />
          <Row testID="settings-support" icon="mail-outline" title="Contact support" subtitle={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=RF%20Photos%20support`).catch(() => {})} />
        </Card>
        <View style={{ alignItems: "center", padding: spacing.xl, gap: spacing.sm }}>
          <Image source={require("@/assets/images/logo.png")} style={{ width: 56, height: 56, borderRadius: 14 }} contentFit="contain" accessibilityLabel="RF Photos logo" />
          <Body muted style={{ textAlign: "center" }}>RF Photos by RF Alphabet · v{Constants.expoConfig?.version || "1.0.0"}{"\n"}Works offline · your media stays on this device</Body>
        </View>
      </ScrollView>
    </Screen>
  );
}

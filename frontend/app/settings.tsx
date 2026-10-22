import React from "react";
import { ScrollView } from "react-native";
import { router } from "expo-router";
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
        <Body muted style={{ padding: spacing.lg }}>RF Photos by RF Alphabet · v1.0 · 100% offline, local-first.</Body>
      </ScrollView>
    </Screen>
  );
}

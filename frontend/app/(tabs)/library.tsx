import React from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, Header, IconName, Row, Screen, SectionTitle } from "@/src/components/ui";
import { usesNativeTabs } from "@/src/navigation";
import { spacing, ThemeColors, useTheme } from "@/src/theme";

type Item = { id: string; icon: IconName; title: string; sub: string; route: string; tint?: keyof ThemeColors };
const SECTIONS: { title: string; items: Item[] }[] = [
  { title: "Find", items: [
    { id: "search", icon: "search", title: "Universal Search", sub: "Natural-language local search", route: "/search", tint: "pastelPeach" },
    { id: "memories", icon: "sparkles", title: "Memories & Events", sub: "On this day, events, bursts", route: "/memories", tint: "pastelBlushPink" },
    { id: "atlas", icon: "map", title: "Travel Atlas", sub: "Places from photo location metadata", route: "/atlas", tint: "pastelMint" },
    { id: "agent", icon: "chatbubbles", title: "RF Action Agent", sub: "Typed local commands with confirmation", route: "/agent", tint: "pastelLavender" },
  ]},
  { title: "Protect", items: [
    { id: "vault", icon: "lock-closed", title: "Private Vault", sub: "PIN + biometrics", route: "/vault", tint: "pastelPowderBlue" },
    { id: "privacy", icon: "shield-checkmark", title: "Privacy Center", sub: "Indexing controls, network audit", route: "/privacy", tint: "pastelMint" },
    { id: "backup", icon: "save", title: "Backup & Recovery", sub: "Local manifests, hash verification", route: "/backup", tint: "pastelCream" },
    { id: "storage", icon: "pie-chart", title: "Storage Guardian", sub: "Usage, large files, duplicates", route: "/storage", tint: "pastelPeach" },
  ]},
  { title: "System", items: [
    { id: "health", icon: "pulse", title: "Media Health & Jobs", sub: "Index status, jobs, imports", route: "/health", tint: "pastelBlushPink" },
    { id: "models", icon: "hardware-chip", title: "On-Device AI Models", sub: "Model manager & engines", route: "/models", tint: "pastelLavender" },
    { id: "clipboard", icon: "clipboard", title: "Visual Clipboard", sub: "Pinned visual snippets", route: "/clipboard", tint: "pastelPowderBlue" },
    { id: "planner", icon: "list", title: "Capture Planner", sub: "Shot lists & recipes", route: "/planner", tint: "pastelMint" },
    { id: "status", icon: "checkmark-done", title: "Feature Status Report", sub: "Honest capability classification", route: "/status", tint: "pastelCream" },
    { id: "settings", icon: "settings", title: "Settings", sub: "Theme, grid, accessibility", route: "/settings", tint: "pastelPeach" },
  ]},
];

export default function Library() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <Screen>
      <Header title="Library" back={false} subtitle="Tools, privacy & system" />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl + (usesNativeTabs ? insets.bottom : 0) }}>
        {SECTIONS.map((s) => (
          <View key={s.title}>
            <SectionTitle title={s.title} />
            <Card style={{ marginHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
              {s.items.map((i) => (
                <Row key={i.id} testID={`library-${i.id}`} icon={i.icon} title={i.title} subtitle={i.sub} tint={i.tint ? colors[i.tint] : undefined} iconColor={colors.brandPrimary} onPress={() => router.push(i.route as any)} />
              ))}
            </Card>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

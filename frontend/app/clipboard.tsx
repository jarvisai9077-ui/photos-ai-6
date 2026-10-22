// Visual Clipboard: only items the user explicitly adds from the viewer. Never reads the system clipboard.
import React from "react";
import { FlatList, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState, Header, IconButton, Screen, Body } from "@/src/components/ui";
import { setState, useStore } from "@/src/store";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Clipboard() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const { colors } = useTheme();
  const raw = useStore((s) => s.clipboard);
  const items = React.useMemo(() => [...raw].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.time - a.time), [raw]);
  return (
    <Screen>
      <Header title="Visual Clipboard" subtitle={`${items.length} snippets`} right={items.length ? <IconButton testID="clipboard-clear" name="trash-outline" onPress={() => setState((s) => ({ clipboard: s.clipboard.filter((c) => c.pinned) }))} /> : undefined} />
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: insets.bottom + spacing.xl }}
        ListHeaderComponent={<Body muted style={{ marginBottom: spacing.sm }}>Add items with the clipboard button in the photo viewer. RF Photos never reads your system clipboard. “Clear” keeps pinned items.</Body>}
        ListEmptyComponent={<EmptyState testID="clipboard-empty" icon="clipboard-outline" title="Clipboard is empty" />}
        renderItem={({ item }) => (
          <View style={st.row} testID={`clip-${item.id}`}>
            <View style={st.thumb}><Image source={{ uri: item.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" /></View>
            <View style={{ flex: 1 }}><Text style={st.t} numberOfLines={1}>{item.label}</Text><Body muted>{new Date(item.time).toLocaleString()}</Body></View>
            <IconButton testID={`clip-pin-${item.id}`} name={item.pinned ? "pin" : "pin-outline"} color={item.pinned ? colors.brandPrimary : undefined} onPress={() => setState((s) => ({ clipboard: s.clipboard.map((c) => (c.id === item.id ? { ...c, pinned: !c.pinned } : c)) }))} />
            <IconButton testID={`clip-delete-${item.id}`} name="close" onPress={() => setState((s) => ({ clipboard: s.clipboard.filter((c) => c.id !== item.id) }))} />
          </View>
        )}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, overflow: "hidden", backgroundColor: c.surfaceTertiary },
  t: { color: c.onSurface, fontWeight: "600" },
}));

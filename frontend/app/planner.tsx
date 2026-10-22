// Smart Capture Planner: local shot lists linked to camera recipes.
import React from "react";
import { FlatList, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeedback } from "@/src/components/feedback";
import { Button, EmptyState, Header, IconButton, Screen, Body } from "@/src/components/ui";
import { setState, uid, useStore } from "@/src/store";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function Planner() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const { colors } = useTheme();
  const fb = useFeedback();
  const shots = useStore((s) => s.shots);
  const add = async () => {
    const title = await fb.prompt({ title: "New planned shot", placeholder: "e.g. Sunset over the bridge" });
    if (!title) return;
    const recipe = (await fb.prompt({ title: "Camera recipe", message: "auto, portrait, landscape, night, food, document, group, selfie, social", initial: "auto" })) || "auto";
    setState((s) => ({ shots: [...s.shots, { id: uid(), title, recipe: recipe.toLowerCase(), done: false }] }));
  };
  return (
    <Screen>
      <Header title="Capture Planner" subtitle={`${shots.filter((s) => s.done).length}/${shots.length} done`} right={<IconButton testID="planner-add" name="add" onPress={add} />} />
      <FlatList
        data={shots}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: insets.bottom + spacing.xl }}
        ListHeaderComponent={<Body muted style={{ marginBottom: spacing.sm }}>Plan shots and open the camera with a matching recipe. Recipes only use controls your camera exposes.</Body>}
        ListEmptyComponent={<EmptyState testID="planner-empty" icon="list-outline" title="No planned shots" action="Add shot" onAction={add} />}
        renderItem={({ item }) => (
          <View style={st.row} testID={`shot-${item.id}`}>
            <IconButton testID={`shot-done-${item.id}`} name={item.done ? "checkmark-circle" : "ellipse-outline"} color={item.done ? colors.success : colors.muted} onPress={() => setState((s) => ({ shots: s.shots.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x)) }))} />
            <View style={{ flex: 1 }}><Text style={[st.t, item.done && { textDecorationLine: "line-through" }]}>{item.title}</Text><Body muted>Recipe: {item.recipe}</Body></View>
            <Button testID={`shot-camera-${item.id}`} label="Shoot" variant="secondary" style={{ minHeight: 36 }} onPress={() => router.push("/camera")} />
            <IconButton testID={`shot-delete-${item.id}`} name="close" onPress={() => setState((s) => ({ shots: s.shots.filter((x) => x.id !== item.id) }))} />
          </View>
        )}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.sm },
  t: { color: c.onSurface, fontWeight: "600" },
}));

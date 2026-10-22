import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useFeedback } from "@/src/components/feedback";
import { Button, Card, Header, Screen, Body } from "@/src/components/ui";
import { setState, useStore } from "@/src/store";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const COLORS = ["#FF5E00", "#1C1C1E", "#FFFFFF", "#2F7FB8", "#248A3D", "#B03A8C"];

export default function Brand() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const { colors } = useTheme();
  const fb = useFeedback();
  const prefs = useStore((s) => s.prefs);
  const [name, setName] = useState(prefs.brandName);
  const [mark, setMark] = useState(prefs.watermark);
  const [color, setColor] = useState(prefs.brandColor);
  return (
    <Screen>
      <Header title="Brand Kit" subtitle="Personal brand assets, stored locally" />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
        <Card>
          <Text style={st.h}>Brand name</Text>
          <TextInput testID="brand-name-input" value={name} onChangeText={setName} style={st.input} placeholderTextColor={colors.muted} placeholder="Studio name" />
          <Text style={st.h}>Watermark text</Text>
          <TextInput testID="brand-watermark-input" value={mark} onChangeText={setMark} style={st.input} placeholderTextColor={colors.muted} placeholder="© Your Name 2026" />
          <Text style={st.h}>Brand colour</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
            {COLORS.map((c) => <Button key={c} testID={`brand-color-${c.slice(1)}`} label="" variant="ghost" onPress={() => setColor(c)} style={{ width: 44, height: 44, minHeight: 44, paddingHorizontal: 0, backgroundColor: c, borderWidth: color === c ? 3 : 1, borderColor: color === c ? colors.brandPrimary : colors.border }} />)}
          </View>
        </Card>
        <Card style={{ alignItems: "flex-end" }}>
          <Body muted style={{ alignSelf: "flex-start" }}>Preview</Body>
          <Text testID="brand-preview" style={{ color, fontWeight: "800", fontSize: 18 }}>{mark || name}</Text>
        </Card>
        <Body muted>Used by the Creation Studio watermark toggle. Logo and font import need a native font/asset loader and are deferred.</Body>
        <Button testID="brand-save-button" label="Save brand kit" onPress={() => { setState((s) => ({ prefs: { ...s.prefs, brandName: name, watermark: mark, brandColor: color } })); fb.toast("Brand kit saved", "success"); }} />
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  h: { color: c.onSurface, fontWeight: "700", fontSize: 15, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: { backgroundColor: c.surfaceTertiary, color: c.onSurface, borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 48, fontSize: 15 },
}));

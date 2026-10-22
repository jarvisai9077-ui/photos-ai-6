import React from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleProp, Switch, Text, TextStyle, View, ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, IoniconsIconName } from "@react-native-vector-icons/ionicons";
import { makeStyles, radius, spacing, ThemeColors, useTheme } from "@/src/theme";
import { getState } from "@/src/store";

export type IconName = IoniconsIconName;
export { Ionicons };

export function Press({ onPress, style, children, testID, disabled, haptic = true, accessibilityLabel }: { onPress?: () => void; style?: StyleProp<ViewStyle>; children: React.ReactNode; testID?: string; disabled?: boolean; haptic?: boolean; accessibilityLabel?: string }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const reduced = getState().prefs.reducedMotion;
  return (
    <Animated.View style={[a, disabled && { opacity: 0.45 }]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onPressIn={() => !reduced && (s.value = withSpring(0.96, { damping: 18, stiffness: 400 }))}
        onPressOut={() => (s.value = withSpring(1, { damping: 18, stiffness: 400 }))}
        onPress={() => {
          if (haptic && Platform.OS !== "web") Haptics.selectionAsync();
          onPress?.();
        }}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ flex: 1, backgroundColor: colors.surface }, style]}>{children}</View>;
}

export function Glass({ children, style, intensity = 40 }: { children?: React.ReactNode; style?: StyleProp<ViewStyle>; intensity?: number }) {
  const { colors, scheme } = useTheme();
  if (Platform.OS === "android") return <View style={[{ backgroundColor: colors.glass }, style]}>{children}</View>;
  return (
    <BlurView intensity={intensity} tint={scheme === "dark" ? "dark" : "light"} style={[{ backgroundColor: colors.glass, overflow: "hidden" }, style]}>
      {children}
    </BlurView>
  );
}

// Sticky, safe-area-aware header used by stack screens.
export function Header({ title, subtitle, back = true, right, testID }: { title: string; subtitle?: string; back?: boolean; right?: React.ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  const st = useUi();
  const { colors } = useTheme();
  return (
    <Glass style={[st.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={st.headerRow}>
        {back && (
          <Press testID="header-back-button" accessibilityLabel="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} style={st.iconBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </Press>
        )}
        <View style={{ flex: 1 }}>
          <Text testID={testID || "screen-title"} style={st.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={st.headerSub} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {right}
      </View>
    </Glass>
  );
}

export function IconButton({ name, onPress, testID, color, size = 22, label, bg }: { name: IconName; onPress?: () => void; testID: string; color?: string; size?: number; label?: string; bg?: string }) {
  const st = useUi();
  const { colors } = useTheme();
  return (
    <Press testID={testID} onPress={onPress} accessibilityLabel={label || name} style={[st.iconBtn, bg ? { backgroundColor: bg } : null]}>
      <Ionicons name={name} size={size} color={color || colors.onSurface} />
    </Press>
  );
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const st = useUi();
  return (
    <View testID={testID} style={[st.card, style]}>
      {children}
    </View>
  );
}

export function Button({ label, onPress, icon, variant = "primary", testID, disabled, loading, style }: { label: string; onPress?: () => void; icon?: IconName; variant?: "primary" | "secondary" | "ghost" | "danger"; testID: string; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const bg = { primary: colors.brandPrimary, secondary: colors.brandTertiary, ghost: colors.surfaceTertiary, danger: colors.error }[variant];
  const fg = { primary: colors.onBrandPrimary, secondary: colors.onBrandTertiary, ghost: colors.onSurfaceTertiary, danger: colors.onError }[variant];
  return (
    <Press testID={testID} onPress={onPress} disabled={disabled || loading} style={[{ backgroundColor: bg, minHeight: 48, borderRadius: radius.pill, paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: "600", fontSize: 15 }}>{label}</Text>
    </Press>
  );
}

export function Chip({ label, active, onPress, testID, icon }: { label: string; active?: boolean; onPress?: () => void; testID: string; icon?: IconName }) {
  const { colors } = useTheme();
  return (
    <Press testID={testID} onPress={onPress} style={{ height: 36, flexShrink: 0, paddingHorizontal: 14, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary, borderWidth: 1, borderColor: active ? colors.brandPrimary : colors.border }}>
      {icon && <Ionicons name={icon} size={15} color={active ? colors.onBrandPrimary : colors.onSurfaceSecondary} />}
      <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurfaceSecondary, fontSize: 14, fontWeight: "500" }}>{label}</Text>
    </Press>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 56, flexGrow: 0 }} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" }}>
      {children}
    </ScrollView>
  );
}

export function SectionTitle({ title, action, onAction, testID }: { title: string; action?: string; onAction?: () => void; testID?: string }) {
  const st = useUi();
  return (
    <View style={st.sectionRow}>
      <Text style={st.sectionTitle}>{title}</Text>
      {action && (
        <Press testID={testID || "section-action"} onPress={onAction}>
          <Text style={st.sectionAction}>{action}</Text>
        </Press>
      )}
    </View>
  );
}

export function Row({ icon, title, subtitle, onPress, testID, right, tint, iconColor }: { icon: IconName; title: string; subtitle?: string; onPress?: () => void; testID: string; right?: React.ReactNode; tint?: string; iconColor?: string }) {
  const st = useUi();
  const { colors } = useTheme();
  return (
    <Press testID={testID} onPress={onPress} disabled={!onPress && !right} style={st.row}>
      <View style={[st.rowIcon, { backgroundColor: tint || colors.brandTertiary }]}>
        <Ionicons name={icon} size={20} color={iconColor || colors.onBrandTertiary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.rowTitle}>{title}</Text>
        {!!subtitle && <Text style={st.rowSub}>{subtitle}</Text>}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null)}
    </Press>
  );
}

export function ToggleRow({ icon, title, subtitle, value, onChange, testID }: { icon: IconName; title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; testID: string }) {
  const { colors } = useTheme();
  return <Row icon={icon} title={title} subtitle={subtitle} testID={testID + "-row"} right={<Switch testID={testID} value={value} onValueChange={onChange} trackColor={{ true: colors.brandPrimary, false: colors.borderStrong }} thumbColor={colors.surfaceSecondary} />} />;
}

export function EmptyState({ icon, title, message, action, onAction, testID, tint }: { icon: IconName; title: string; message?: string; action?: string; onAction?: () => void; testID: string; tint?: keyof ThemeColors }) {
  const { colors } = useTheme();
  const st = useUi();
  return (
    <View testID={testID} style={st.empty}>
      <LinearGradient colors={[colors[tint || "pastelPeach"], colors.pastelLavender]} style={st.emptyIcon}>
        <Ionicons name={icon} size={40} color={colors.brandPrimary} />
      </LinearGradient>
      <Text style={st.emptyTitle}>{title}</Text>
      {!!message && <Text style={st.emptyMsg}>{message}</Text>}
      {action && <Button testID={testID + "-action"} label={action} onPress={onAction} style={{ marginTop: spacing.lg }} />}
    </View>
  );
}

export function Badge({ label, kind = "info" }: { label: string; kind?: "success" | "warning" | "error" | "info" | "brand" }) {
  const { colors } = useTheme();
  const bg = kind === "brand" ? colors.brandTertiary : colors[kind];
  const fg = kind === "brand" ? colors.onBrandTertiary : colors[(`on${kind[0].toUpperCase()}${kind.slice(1)}`) as keyof ThemeColors];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function Body({ children, style, muted, testID, numberOfLines }: { children: React.ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; testID?: string; numberOfLines?: number }) {
  const { colors } = useTheme();
  return (
    <Text testID={testID} numberOfLines={numberOfLines} style={[{ color: muted ? colors.muted : colors.onSurface, fontSize: 14, lineHeight: 20 }, style]}>
      {children}
    </Text>
  );
}

export function Progress({ value }: { value: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, overflow: "hidden" }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: 6, backgroundColor: colors.brandPrimary }} />
    </View>
  );
}

export const useUi = makeStyles((c) => ({
  header: { paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: c.border },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 44 },
  headerTitle: { color: c.onSurface, fontSize: 20, fontWeight: "700", letterSpacing: -0.3, paddingLeft: spacing.xs },
  headerSub: { color: c.muted, fontSize: 12, paddingLeft: spacing.xs },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, shadowColor: c.shadow, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  sectionTitle: { color: c.onSurface, fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  sectionAction: { color: c.brandPrimary, fontSize: 15, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, minHeight: 56 },
  rowIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: c.onSurface, fontSize: 16, fontWeight: "500" },
  rowSub: { color: c.muted, fontSize: 13, marginTop: 2 },
  empty: { alignItems: "center", padding: spacing.xl, paddingTop: spacing.xxl },
  emptyIcon: { width: 96, height: 96, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: spacing.lg },
  emptyTitle: { color: c.onSurface, fontSize: 20, fontWeight: "700", textAlign: "center" },
  emptyMsg: { color: c.muted, fontSize: 14, textAlign: "center", marginTop: spacing.sm, lineHeight: 20, maxWidth: 320 },
}));

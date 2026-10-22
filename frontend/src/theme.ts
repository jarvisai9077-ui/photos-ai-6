// RF Photos design tokens (light + dark). Keys match /app/design_guidelines.json.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#F5F6F8",
  onSurface: "#1C1C1E",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1C1C1E",
  surfaceTertiary: "#EEEFF2",
  onSurfaceTertiary: "#3A3A3C",
  surfaceInverse: "#1C1C1E",
  onSurfaceInverse: "#FFFFFF",
  muted: "#8E8E93",
  brand: "#FF5E00",
  onBrand: "#FFFFFF",
  brandPrimary: "#FF5E00",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#FF6600",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#FFF0E6",
  onBrandTertiary: "#E05200",
  success: "#248A3D",
  onSuccess: "#FFFFFF",
  warning: "#C77700",
  onWarning: "#FFFFFF",
  error: "#E5352B",
  onError: "#FFFFFF",
  info: "#2F7FB8",
  onInfo: "#FFFFFF",
  border: "#E5E5EA",
  borderStrong: "#C7C7CC",
  divider: "#E5E5EA",
  pastelLavender: "#ECE8FB",
  pastelPowderBlue: "#E1F1F7",
  pastelBlushPink: "#FCE6EC",
  pastelMint: "#E2F6EC",
  pastelPeach: "#FFEBDD",
  pastelCream: "#FFF9EC",
  onPastel: "#1C1C1E",
  glass: "rgba(255,255,255,0.72)",
  scrim: "rgba(0,0,0,0.45)",
  shadow: "#1C1C1E",
};

export type ThemeColors = typeof light;

const dark: ThemeColors = {
  surface: "#121212",
  onSurface: "#FFFFFF",
  surfaceSecondary: "#1C1C1E",
  onSurfaceSecondary: "#FFFFFF",
  surfaceTertiary: "#2C2C2E",
  onSurfaceTertiary: "#E5E5EA",
  surfaceInverse: "#F5F6F8",
  onSurfaceInverse: "#1C1C1E",
  muted: "#98989F",
  brand: "#FF5E00",
  onBrand: "#FFFFFF",
  brandPrimary: "#FF5E00",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#FF6600",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#331600",
  onBrandTertiary: "#FF8A3D",
  success: "#30D158",
  onSuccess: "#0B1F10",
  warning: "#FF9F0A",
  onWarning: "#1F1300",
  error: "#FF453A",
  onError: "#FFFFFF",
  info: "#89C4F4",
  onInfo: "#121212",
  border: "#38383A",
  borderStrong: "#48484A",
  divider: "#38383A",
  pastelLavender: "#2A2840",
  pastelPowderBlue: "#1F3340",
  pastelBlushPink: "#3D2329",
  pastelMint: "#1E3329",
  pastelPeach: "#3D2A1C",
  pastelCream: "#35301F",
  onPastel: "#FFFFFF",
  glass: "rgba(28,28,30,0.78)",
  scrim: "rgba(0,0,0,0.6)",
  shadow: "#000000",
};

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 6, md: 12, lg: 20, xl: 24, pill: 999 };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

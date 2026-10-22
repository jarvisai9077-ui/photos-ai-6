import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { usesNativeTabs } from "@/src/navigation";
import { useTheme } from "@/src/theme";
import { Ionicons } from "@/src/components/ui";

export default function TabsLayout() {
  const { colors } = useTheme();
  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="index"><NativeTabs.Trigger.Icon sf="photo.on.rectangle" /><NativeTabs.Trigger.Label>Photos</NativeTabs.Trigger.Label></NativeTabs.Trigger>
        <NativeTabs.Trigger name="albums"><NativeTabs.Trigger.Icon sf="rectangle.stack.fill" /><NativeTabs.Trigger.Label>Albums</NativeTabs.Trigger.Label></NativeTabs.Trigger>
        <NativeTabs.Trigger name="create"><NativeTabs.Trigger.Icon sf="wand.and.stars" /><NativeTabs.Trigger.Label>Create</NativeTabs.Trigger.Label></NativeTabs.Trigger>
        <NativeTabs.Trigger name="library"><NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" /><NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label></NativeTabs.Trigger>
      </NativeTabs>
    );
  }
  const icon = (name: any, focusedName: any) => {
    const TabIcon = ({ color, size, focused }: { focused: boolean; color: any; size: number }) => <Ionicons name={focused ? focusedName : name} size={size} color={color} />;
    return TabIcon;
  };
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, ...(Platform.OS === "web" ? { height: 64 } : {}) },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Photos", tabBarButtonTestID: "tab-photos", tabBarIcon: icon("images-outline", "images") }} />
      <Tabs.Screen name="albums" options={{ title: "Albums", tabBarButtonTestID: "tab-albums", tabBarIcon: icon("albums-outline", "albums") }} />
      <Tabs.Screen name="create" options={{ title: "Create", tabBarButtonTestID: "tab-create", tabBarIcon: icon("color-wand-outline", "color-wand") }} />
      <Tabs.Screen name="library" options={{ title: "Library", tabBarButtonTestID: "tab-library", tabBarIcon: icon("grid-outline", "grid") }} />
    </Tabs>
  );
}

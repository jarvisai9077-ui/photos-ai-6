import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { FeedbackProvider } from "@/src/components/feedback";
import { queryClient } from "@/src/query-client";
import { hydrate, useStore } from "@/src/store";
import { setColorScheme, useTheme } from "@/src/theme";
import { indexLibrary, watchLibrary } from "@/src/media/library";

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  const theme = useStore((s) => s.prefs.theme);
  const { colors, scheme } = useTheme();
  useEffect(() => {
    hydrate().then(() => {
      indexLibrary();
      watchLibrary();
    });
  }, []);
  useEffect(() => {
    setColorScheme(theme === "system" ? null : theme);
  }, [theme]);
  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <FeedbackProvider>
              <StatusBar style={scheme === "dark" ? "light" : "dark"} />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface }, animation: "slide_from_right" }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="viewer" options={{ animation: "fade", contentStyle: { backgroundColor: "#000000" } }} />
                <Stack.Screen name="camera" options={{ animation: "slide_from_bottom", contentStyle: { backgroundColor: "#000000" } }} />
                <Stack.Screen name="picker" options={{ animation: "slide_from_bottom" }} />
              </Stack>
            </FeedbackProvider>
          </KeyboardProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

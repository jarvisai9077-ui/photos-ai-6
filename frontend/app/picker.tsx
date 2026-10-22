import React, { useMemo, useState } from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MediaGrid } from "@/src/components/MediaGrid";
import { Button, EmptyState, Glass, Header, Screen } from "@/src/components/ui";
import { useFeedback } from "@/src/components/feedback";
import { useAllMedia } from "@/src/media/library";
import { importMedia } from "@/src/media/importer";
import { pickerOpts, resolvePicker } from "@/src/media/picker";
import { MediaItem } from "@/src/store";
import { spacing } from "@/src/theme";
import { useEffect } from "react";

export default function Picker() {
  const opts = pickerOpts();
  const insets = useSafeAreaInsets();
  const fb = useFeedback();
  const all = useAllMedia();
  const items = useMemo(() => (opts.type && opts.type !== "all" ? all.filter((m) => m.mediaType === opts.type) : all), [all, opts.type]);
  const [sel, setSel] = useState<string[]>([]);
  const max = opts.max || 50;
  useEffect(() => () => resolvePicker([]), []);
  const toggle = (m: MediaItem) => setSel((s) => (s.includes(m.id) ? s.filter((x) => x !== m.id) : s.length >= max ? (fb.toast(`Up to ${max} items`, "info"), s) : [...s, m.id]));
  const done = () => {
    resolvePicker(sel.map((id) => items.find((i) => i.id === id)!).filter(Boolean));
    router.back();
  };
  return (
    <Screen>
      <Header title={opts.title || "Select media"} subtitle={`${sel.length} of max ${max}`} />
      <MediaGrid testID="picker-grid" items={items} selecting selected={new Set(sel)} onToggle={toggle} bottomPad={insets.bottom + 100}
        empty={<EmptyState testID="picker-empty" icon="images-outline" title="No media" message="Import photos to use them here." action="Import" onAction={() => importMedia("picker")} />} />
      <Glass style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
        <Button testID="picker-done-button" label={`Use ${sel.length} selected`} disabled={!sel.length} onPress={done} />
      </Glass>
    </Screen>
  );
}

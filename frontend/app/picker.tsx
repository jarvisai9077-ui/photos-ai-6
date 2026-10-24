import React, { useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MediaGrid } from "@/src/components/MediaGrid";
import { Button, EmptyState, Glass, Header, Screen } from "@/src/components/ui";
import { useFeedback } from "@/src/components/feedback";
import { useAllMedia } from "@/src/media/library";
import { importMedia, importSummary } from "@/src/media/importer";
import { pickerMounted, pickerRequest, pickerUnmounted, resolvePicker } from "@/src/media/picker";
import { MediaItem } from "@/src/store";
import { spacing } from "@/src/theme";

export default function Picker() {
  // Capture the request once: options must not disappear while the screen animates out.
  const req = useRef(pickerRequest()).current;
  const opts = req.opts;
  const insets = useSafeAreaInsets();
  const fb = useFeedback();
  const all = useAllMedia();
  const items = useMemo(() => (opts.type && opts.type !== "all" ? all.filter((m) => m.mediaType === opts.type) : all), [all, opts.type]);
  const [sel, setSel] = useState<string[]>([]);
  const max = Math.max(1, opts.max || 50);
  const single = max === 1;

  useEffect(() => {
    pickerMounted();
    return () => pickerUnmounted(req.id);
  }, [req.id]);

  const toggle = (m: MediaItem) =>
    setSel((s) => {
      if (s.includes(m.id)) return s.filter((x) => x !== m.id);
      if (single) return [m.id]; // single choice: tapping another item replaces the choice
      if (s.length >= max) {
        fb.toast(`You can choose up to ${max} items`, "info");
        return s;
      }
      return [...s, m.id];
    });
  const toggleMany = (ids: string[], select: boolean) =>
    setSel((s) => {
      if (!select) return s.filter((x) => !ids.includes(x));
      const add = ids.filter((x) => !s.includes(x)).slice(0, Math.max(0, max - s.length));
      if (add.length < ids.filter((x) => !s.includes(x)).length) fb.toast(`You can choose up to ${max} items`, "info");
      return [...s, ...add];
    });
  const done = () => {
    const byId = new Map(items.map((i) => [i.id, i]));
    resolvePicker(req.id, sel.map((id) => byId.get(id)).filter(Boolean) as MediaItem[]);
    router.back();
  };
  const doImport = async () => {
    try {
      const r = await importMedia("picker");
      if (!r.cancelled) fb.toast(importSummary(r), r.skipped ? "error" : "success");
    } catch (e: any) {
      fb.toast(e?.message || "Import failed", "error");
    }
  };
  const noun = opts.type === "video" ? "video" : opts.type === "photo" ? "photo" : "item";
  const selected = useMemo(() => new Set(sel), [sel]);

  return (
    <Screen>
      <Header title={opts.title || "Select media"} subtitle={single ? `Tap a ${noun} to choose it` : `${sel.length} selected · up to ${max}`} />
      <MediaGrid
        testID="picker-grid"
        items={items}
        selecting
        selected={selected}
        onToggle={toggle}
        onToggleMany={single ? undefined : toggleMany}
        bottomPad={insets.bottom + 100}
        empty={<EmptyState testID="picker-empty" icon="images-outline" title={`No ${noun}s yet`} message="Import from your phone to use them here." action="Import" onAction={doImport} />}
      />
      <Glass style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg }}>
        <Button testID="picker-done-button" label={single ? (sel.length ? `Use this ${noun}` : `Select 1 ${noun}`) : sel.length ? `Use ${sel.length} selected` : "Select items"} disabled={!sel.length} onPress={done} />
      </Glass>
    </Screen>
  );
}

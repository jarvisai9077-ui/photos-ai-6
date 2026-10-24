// Selection state shared by the gallery and collections: tap/long-press, select all, deselect, per-day select.
import { useCallback, useMemo, useState } from "react";
import { MediaItem } from "@/src/store";

export function useSelection(visible: MediaItem[]) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const toggle = useCallback((m: MediaItem) => setSelected((s) => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; }), []);
  const toggleMany = useCallback((ids: string[], select: boolean) => setSelected((s) => { const n = new Set(s); ids.forEach((id) => (select ? n.add(id) : n.delete(id))); return n; }), []);
  const start = useCallback((m?: MediaItem) => { setSelecting(true); if (m) setSelected(new Set([m.id])); }, []);
  const end = useCallback(() => { setSelecting(false); setSelected(new Set()); }, []);
  const selectAll = useCallback(() => setSelected(new Set(visible.map((m) => m.id))), [visible]);
  const clear = useCallback(() => setSelected(new Set()), []);
  // Only items still visible count (deleted/filtered items drop out automatically).
  const items = useMemo(() => visible.filter((m) => selected.has(m.id)), [visible, selected]);
  return { selecting, selected, items, toggle, toggleMany, start, end, selectAll, clear };
}

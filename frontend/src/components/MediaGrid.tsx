// Virtualised, date-grouped media grid (Today / Yesterday / 23 October 2026), shared by the gallery, picker,
// collections/albums and search so grouping looks and behaves the same everywhere.
import React, { memo, useCallback, useMemo } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router } from "expo-router";
import { MediaItem, useStore } from "@/src/store";
import { formatDuration } from "@/src/media/files";
import { captureTime, dayKey, dayLabel, sortNewest } from "@/src/media/dates";
import { makeStyles, useTheme } from "@/src/theme";
import { Ionicons } from "./ui";

let viewerList: MediaItem[] = [];
export const getViewerList = () => viewerList;
export function openViewer(list: MediaItem[], index: number) {
  if (!list.length) return;
  viewerList = list;
  router.push({ pathname: "/viewer", params: { index: String(Math.max(0, Math.min(index, list.length - 1))) } });
}

type Props = {
  items: MediaItem[];
  selected?: Set<string>;
  onToggle?: (m: MediaItem) => void;
  onToggleMany?: (ids: string[], select: boolean) => void;
  selecting?: boolean;
  onLongPress?: (m: MediaItem) => void;
  onPressItem?: (m: MediaItem, index: number, list: MediaItem[]) => void;
  grouped?: boolean;
  header?: React.ReactElement | null;
  empty?: React.ReactElement | null;
  columns?: number;
  bottomPad?: number;
  testID?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
};

type HeaderRow = { type: "header"; key: string; label: string; ids: string[] };
type TileRow = { type: "row"; key: string; items: MediaItem[]; start: number };
type Row = HeaderRow | TileRow;

const Tile = memo(function Tile({ item, size, sel, selecting, fav, index, onPress, onLong }: { item: MediaItem; size: number; sel: boolean; selecting: boolean; fav: boolean; index: number; onPress: (m: MediaItem, i: number) => void; onLong: (m: MediaItem) => void }) {
  const st = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={`media-tile-${index}`}
      accessibilityRole="button"
      accessibilityState={{ selected: sel }}
      accessibilityLabel={`${item.mediaType} ${item.filename}`}
      onPress={() => onPress(item, index)}
      onLongPress={() => onLong(item)}
      delayLongPress={280}
      style={{ width: size, height: size, padding: 1 }}
    >
      <View style={st.tileInner}>
        {item.mediaType === "video" && <View style={st.vidFallback}><Ionicons name="videocam" size={size > 80 ? 26 : 20} color={colors.muted} /></View>}
        <Image source={{ uri: item.thumb || item.uri }} style={st.fill} contentFit="cover" recyclingKey={item.id} transition={80} cachePolicy="memory-disk" />
        {item.mediaType === "video" && (
          <View style={st.vidBadge}>
            <Ionicons name="play" size={10} color="#FFFFFF" />
            <Text style={st.vidText}>{formatDuration(item.duration)}</Text>
          </View>
        )}
        {fav && !selecting && <Ionicons name="heart" size={14} color="#FFFFFF" style={st.fav} />}
        {sel && <View style={st.selOverlay} />}
        {selecting && (
          <View testID={`media-tile-check-${index}`} style={[st.check, sel && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>{sel && <Ionicons name="checkmark" size={14} color={colors.onBrandPrimary} />}</View>
        )}
      </View>
    </Pressable>
  );
});

export function MediaGrid({ items, selected, onToggle, onToggleMany, selecting = false, onPressItem, onLongPress, grouped = true, header, empty, columns, bottomPad = 24, testID, onRefresh, refreshing, }: Props) {
  const { width } = useWindowDimensions();
  const st = useStyles();
  const { colors } = useTheme();
  const prefCols = useStore((s) => s.prefs.gridColumns);
  const meta = useStore((s) => s.meta);
  const cols = columns || (width > 700 ? Math.max(prefCols, 6) : prefCols);
  const size = Math.floor(Math.min(width, 1200) / cols);

  // Flat list in display order (used for the viewer) + rows of `cols` tiles with a header per day.
  const { list, rows } = useMemo(() => {
    const list = grouped ? sortNewest(items) : items;
    const rows: Row[] = [];
    let i = 0;
    while (i < list.length) {
      let j = i;
      if (grouped) {
        const k = dayKey(captureTime(list[i]));
        while (j < list.length && dayKey(captureTime(list[j])) === k) j++;
        rows.push({ type: "header", key: `h-${k}-${i}`, label: dayLabel(captureTime(list[i])), ids: list.slice(i, j).map((m) => m.id) });
      } else j = list.length;
      for (let r = i; r < j; r += cols) rows.push({ type: "row", key: `r-${list[r].id}`, items: list.slice(r, Math.min(r + cols, j)), start: r });
      i = j;
    }
    return { list, rows };
  }, [items, grouped, cols]);

  const press = useCallback(
    (m: MediaItem, i: number) => {
      if (selecting && onToggle) return onToggle(m);
      if (onPressItem) return onPressItem(m, i, list);
      openViewer(list, i);
    },
    [selecting, onToggle, onPressItem, list],
  );
  const long = useCallback((m: MediaItem) => (onLongPress ? onLongPress(m) : onToggle && selecting ? onToggle(m) : undefined), [onLongPress, onToggle, selecting]);

  const renderItem = ({ item: row }: { item: Row }) => {
    if (row.type === "header") {
      const all = selecting && row.ids.length > 0 && row.ids.every((id) => selected?.has(id));
      return (
        <View style={st.dayRow}>
          <Text testID="date-group-header" style={st.dayText}>{row.label}</Text>
          {selecting && onToggleMany && (
            <Pressable testID={`date-group-select-${row.label.replace(/\s+/g, "-").toLowerCase()}`} hitSlop={10} onPress={() => onToggleMany(row.ids, !all)} style={st.dayBtn} accessibilityRole="button" accessibilityLabel={all ? `Deselect ${row.label}` : `Select ${row.label}`}>
              <Ionicons name={all ? "checkmark-circle" : "ellipse-outline"} size={22} color={all ? colors.brandPrimary : colors.muted} />
            </Pressable>
          )}
        </View>
      );
    }
    return (
      <View style={st.tileRow}>
        {row.items.map((m, k) => (
          <Tile key={m.id} item={m} index={row.start + k} size={size} sel={!!selected?.has(m.id)} selecting={selecting} fav={!!meta[m.id]?.fav} onPress={press} onLong={long} />
        ))}
      </View>
    );
  };

  return (
    <FlashList
      testID={testID || "media-grid"}
      data={rows}
      renderItem={renderItem}
      keyExtractor={(r) => r.key}
      getItemType={(r) => r.type}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      drawDistance={size * 6}
      onRefresh={onRefresh}
      refreshing={!!refreshing}
      extraData={{ selected, selecting, meta, size }}
    />
  );
}

const useStyles = makeStyles((c) => ({
  fill: { width: "100%", height: "100%" },
  vidFallback: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  tileRow: { flexDirection: "row" },
  tileInner: { flex: 1, backgroundColor: c.surfaceTertiary, overflow: "hidden", borderRadius: 4 },
  dayRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, minHeight: 48 },
  dayText: { color: c.onSurface, fontSize: 15, fontWeight: "700" },
  dayBtn: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
  vidBadge: { position: "absolute", right: 4, bottom: 4, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2 },
  vidText: { color: "#FFFFFF", fontSize: 10, fontWeight: "600" },
  fav: { position: "absolute", left: 5, bottom: 5 },
  check: { position: "absolute", right: 5, top: 5, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.2)" },
  selOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderWidth: 3, borderColor: c.brandPrimary, borderRadius: 4, backgroundColor: "rgba(255,94,0,0.12)" },
}));

import React, { memo, useCallback } from "react";
import { FlatList, Text, useWindowDimensions, View, ListRenderItem } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { MediaItem, useStore } from "@/src/store";
import { formatDuration } from "@/src/media/files";
import { makeStyles, useTheme } from "@/src/theme";
import { Ionicons, Press } from "./ui";

let viewerList: MediaItem[] = [];
export const getViewerList = () => viewerList;
export function openViewer(list: MediaItem[], index: number) {
  viewerList = list;
  router.push({ pathname: "/viewer", params: { index: String(index) } });
}

type Props = {
  items: MediaItem[];
  selected?: Set<string>;
  onToggle?: (m: MediaItem) => void;
  selecting?: boolean;
  onLongPress?: (m: MediaItem) => void;
  onPressItem?: (m: MediaItem, i: number) => void;
  header?: React.ReactElement | null;
  empty?: React.ReactElement | null;
  columns?: number;
  bottomPad?: number;
  testID?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
};

const Tile = memo(function Tile({ item, size, sel, selecting, fav, onPress, onLong, index }: { item: MediaItem; size: number; sel: boolean; selecting: boolean; fav: boolean; onPress: (m: MediaItem, i: number) => void; onLong?: (m: MediaItem) => void; index: number }) {
  const st = useStyles();
  const { colors } = useTheme();
  return (
    <Press testID={`media-tile-${index}`} haptic={false} onPress={() => onPress(item, index)} accessibilityLabel={`${item.mediaType} ${item.filename}`} style={{ width: size, height: size, padding: 1 }}>
      <View style={st.tileInner}>
        <Image source={{ uri: item.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" recyclingKey={item.id} transition={120} cachePolicy="memory-disk" />
        {item.mediaType === "video" && (
          <View style={st.vidBadge}>
            <Ionicons name="play" size={10} color="#FFFFFF" />
            <Text style={st.vidText}>{formatDuration(item.duration)}</Text>
          </View>
        )}
        {fav && !selecting && <Ionicons name="heart" size={14} color="#FFFFFF" style={st.fav} />}
        {selecting && (
          <View style={[st.check, sel && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>{sel && <Ionicons name="checkmark" size={14} color={colors.onBrandPrimary} />}</View>
        )}
        {sel && <View style={st.selOverlay} />}
      </View>
    </Press>
  );
});

export function MediaGrid({ items, selected, onToggle, selecting = false, onPressItem, header, empty, columns, bottomPad = 24, testID, onRefresh, refreshing, onLongPress }: Props) {
  const { width } = useWindowDimensions();
  const prefCols = useStore((s) => s.prefs.gridColumns);
  const meta = useStore((s) => s.meta);
  const cols = columns || (width > 700 ? Math.max(prefCols, 6) : prefCols);
  const size = Math.floor(Math.min(width, 1200) / cols);
  const press = useCallback(
    (m: MediaItem, i: number) => {
      if (selecting && onToggle) return onToggle(m);
      if (onPressItem) return onPressItem(m, i);
      openViewer(items, i);
    },
    [selecting, onToggle, onPressItem, items],
  );
  const render: ListRenderItem<MediaItem> = ({ item, index }) => <Tile item={item} index={index} size={size} sel={!!selected?.has(item.id)} selecting={selecting} fav={!!meta[item.id]?.fav} onPress={press} onLong={onLongPress} />;
  return (
    <FlatList
      testID={testID || "media-grid"}
      key={cols}
      data={items}
      numColumns={cols}
      keyExtractor={(i) => i.id}
      renderItem={render}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      contentContainerStyle={{ paddingBottom: bottomPad }}
      initialNumToRender={cols * 8}
      maxToRenderPerBatch={cols * 6}
      windowSize={7}
      removeClippedSubviews
      getItemLayout={undefined}
      onRefresh={onRefresh}
      refreshing={refreshing}
      extraData={[selected, selecting, meta]}
    />
  );
}

const useStyles = makeStyles((c) => ({
  tileInner: { flex: 1, backgroundColor: c.surfaceTertiary, overflow: "hidden", borderRadius: 4 },
  vidBadge: { position: "absolute", right: 4, bottom: 4, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2 },
  vidText: { color: "#FFFFFF", fontSize: 10, fontWeight: "600" },
  fav: { position: "absolute", left: 5, bottom: 5 },
  check: { position: "absolute", right: 5, top: 5, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.2)" },
  selOverlay: { ...{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }, borderWidth: 3, borderColor: c.brandPrimary, borderRadius: 4 },
}));

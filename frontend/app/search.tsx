import React, { useMemo, useState } from "react";
import { FlatList, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MediaGrid, openViewer } from "@/src/components/MediaGrid";
import { Chip, ChipRow, Glass, IconButton, Ionicons, Press, Screen, Body, EmptyState } from "@/src/components/ui";
import { useFeedback } from "@/src/components/feedback";
import { useAllMedia } from "@/src/media/library";
import { describeQuery, searchDocuments, searchMedia } from "@/src/media/search";
import { setState, uid, useStore } from "@/src/store";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const SUGGEST = ["videos", "screenshots", "portrait videos", "photos last month", "large videos", "favourites", "today", "edited", "with notes"];

export default function Search() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const { colors } = useTheme();
  const fb = useFeedback();
  const all = useAllMedia();
  const saved = useStore((s) => s.savedSearches);
  const meta = useStore((s) => s.meta);
  const [q, setQ] = useState("");
  const results = useMemo(() => searchMedia(all, q), [all, q, meta]); // eslint-disable-line react-hooks/exhaustive-deps
  const docs = useMemo(() => searchDocuments(q), [q]);
  const parsed = q.trim() ? describeQuery(q) : null;

  const save = () => {
    if (!q.trim()) return;
    setState((s) => ({ savedSearches: [q.trim(), ...s.savedSearches.filter((x) => x !== q.trim())].slice(0, 20) }));
    fb.toast("Search saved", "success");
  };
  const makeSmart = () => {
    if (!q.trim()) return;
    setState((s) => ({ smartAlbums: [{ id: uid(), name: q.trim(), query: q.trim(), created: Date.now() }, ...s.smartAlbums] }));
    fb.toast("Smart album created from this search", "success");
  };

  const header = q.trim() ? (
    <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm }}>
      <Text testID="search-result-count" style={st.count}>{results.length} media · {docs.length} documents</Text>
      {parsed && (
        <Body muted>Understood as: {[parsed.range?.label, ...parsed.flags, ...parsed.words.map((w) => `“${w}”`)].filter(Boolean).join(" · ") || "text"}</Body>
      )}
      {results[0] && <Body muted testID="search-why">Why the first result matched: {results[0].reasons.join(", ") || "all filters"}</Body>}
      {docs.map((d) => (
        <Press key={d.id} testID={`search-doc-${d.id}`} onPress={() => router.push({ pathname: "/documents", params: { open: d.id } })} style={st.doc}>
          <Ionicons name="document-text" size={20} color={colors.brandPrimary} />
          <Text style={st.docText} numberOfLines={1}>{d.title}</Text>
        </Press>
      ))}
    </View>
  ) : null;

  return (
    <Screen>
      <Glass style={[st.top, { paddingTop: insets.top + spacing.sm }]}>
        <View style={st.row}>
          <IconButton testID="search-back-button" name="chevron-back" onPress={() => router.back()} />
          <View style={st.bar}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput testID="search-input" autoFocus value={q} onChangeText={setQ} placeholder="Search your library…" placeholderTextColor={colors.muted} style={st.input} returnKeyType="search" />
            {!!q && <IconButton testID="search-clear-button" name="close-circle" size={18} color={colors.muted} onPress={() => setQ("")} />}
          </View>
        </View>
        <ChipRow>
          {q.trim() ? (
            <>
              <Chip testID="search-save-button" icon="bookmark-outline" label="Save search" onPress={save} />
              <Chip testID="search-smart-button" icon="sparkles-outline" label="Make smart album" onPress={makeSmart} />
            </>
          ) : (
            SUGGEST.map((s) => <Chip key={s} testID={`search-suggest-${s.replace(/ /g, "-")}`} label={s} onPress={() => setQ(s)} />)
          )}
        </ChipRow>
      </Glass>
      {!q.trim() ? (
        <FlatList
          data={saved}
          keyExtractor={(s) => s}
          ListHeaderComponent={<Text style={[st.count, { padding: spacing.lg }]}>Saved searches</Text>}
          ListEmptyComponent={<Body muted style={{ paddingHorizontal: spacing.lg }}>Try “photos from last october”, “portrait videos”, “screenshots 2025” or words from your tags, captions and notes. Every result comes from your local index.</Body>}
          renderItem={({ item }) => (
            <Press testID={`saved-search-${item}`} onPress={() => setQ(item)} style={st.saved}>
              <Ionicons name="time-outline" size={18} color={colors.muted} />
              <Text style={st.docText}>{item}</Text>
            </Press>
          )}
        />
      ) : (
        <MediaGrid testID="search-results-grid" items={results.map((r) => r.item)} header={header} onPressItem={(m, i) => openViewer(results.map((r) => r.item), i)} empty={<EmptyState testID="search-empty" icon="search-outline" title="No matches" message="Nothing in your local index matches. Add tags, captions or notes in the photo viewer to make media findable." />} />
      )}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  top: { borderBottomWidth: 0.5, borderBottomColor: c.border },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingRight: spacing.lg },
  bar: { flex: 1, height: 46, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, flexDirection: "row", alignItems: "center", paddingLeft: spacing.lg, gap: spacing.sm },
  input: { flex: 1, color: c.onSurface, fontSize: 16, height: 46 },
  count: { color: c.onSurface, fontSize: 15, fontWeight: "700" },
  doc: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceSecondary, padding: spacing.md, borderRadius: radius.md },
  docText: { color: c.onSurface, fontSize: 15, flex: 1 },
  saved: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, minHeight: 48 },
}));

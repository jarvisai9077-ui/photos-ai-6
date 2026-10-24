import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { openViewer } from "@/src/components/MediaGrid";
import { useFeedback } from "@/src/components/feedback";
import { Badge, Chip, ChipRow, EmptyState, Header, Ionicons, Press, Screen, Body } from "@/src/components/ui";
import { groupBursts, groupEvents, onThisDay } from "@/src/media/analysis";
import { deleteSlideshow, groupMonths, playSaved, playSlideshow } from "@/src/media/slideshow";
import { useAllMedia } from "@/src/media/library";
import { MediaItem, updateMeta, useStore } from "@/src/store";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

function Strip({ items, testID, onLong }: { items: MediaItem[]; testID: string; onLong?: (m: MediaItem) => void }) {
  const st = useStyles();
  const meta = useStore((s) => s.meta);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
      {items.slice(0, 30).map((m, i) => (
        <Press key={m.id} testID={`${testID}-${i}`} onPress={() => (onLong ? onLong(m) : openViewer(items, i))} style={[st.thumb, meta[m.id]?.fav && st.best]}>
          <Image source={{ uri: m.thumb || m.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        </Press>
      ))}
    </ScrollView>
  );
}

export default function Memories() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const fb = useFeedback();
  const { colors } = useTheme();
  const all = useAllMedia();
  const saved = useStore((s) => s.slideshows);
  const [tab, setTab] = useState<"monthly" | "events" | "onthisday" | "bursts" | "people">("monthly");
  const months = useMemo(() => groupMonths(all), [all]);
  const events = useMemo(() => groupEvents(all), [all]);
  const otd = useMemo(() => onThisDay(all), [all]);
  const bursts = useMemo(() => groupBursts(all), [all]);

  return (
    <Screen>
      <Header title="Memories" subtitle="Built only from real capture dates in your library" />
      <ChipRow>
        <Chip testID="memories-tab-monthly" label={`Monthly ${months.length}`} active={tab === "monthly"} onPress={() => setTab("monthly")} />
        <Chip testID="memories-tab-events" label={`Events ${events.length}`} active={tab === "events"} onPress={() => setTab("events")} />
        <Chip testID="memories-tab-onthisday" label={`On this day ${otd.length}`} active={tab === "onthisday"} onPress={() => setTab("onthisday")} />
        <Chip testID="memories-tab-bursts" label={`Bursts ${bursts.length}`} active={tab === "bursts"} onPress={() => setTab("bursts")} />
        <Chip testID="memories-tab-people" label="People & pets" active={tab === "people"} onPress={() => setTab("people")} />
      </ChipRow>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        {tab === "monthly" && (
          <>
            {saved.length > 0 && (
              <View style={st.card} testID="saved-slideshows">
                <Text style={st.title}>Saved slideshows</Text>
                {saved.map((s) => (
                  <View key={s.id} style={st.savedRow}>
                    <Press testID={`saved-slideshow-${s.id}`} onPress={() => playSaved(s.id)} style={st.savedMain}>
                      <Ionicons name="play-circle" size={28} color={colors.brandPrimary} />
                      <View style={{ flex: 1 }}>
                        <Text style={st.title} numberOfLines={1}>{s.title}</Text>
                        <Body muted>{s.itemIds.length} items · {s.transition} · {s.seconds}s per photo</Body>
                      </View>
                    </Press>
                    <Press testID={`delete-slideshow-${s.id}`} onPress={async () => { if (await fb.confirm({ title: "Delete slideshow?", message: "Only the slideshow is removed. Your photos stay.", destructive: true, confirmLabel: "Delete" })) deleteSlideshow(s.id); }} style={st.iconBtn}>
                      <Ionicons name="trash-outline" size={20} color={colors.muted} />
                    </Press>
                  </View>
                ))}
              </View>
            )}
            {months.length ? months.slice(0, 36).map((mo, i) => (
              <View key={mo.key} style={st.card} testID={`month-${i}`}>
                <View style={st.monthHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.title}>{mo.label}</Text>
                    <Body muted>{mo.items.length} photos & videos</Body>
                  </View>
                  <Press testID={`month-play-${i}`} onPress={() => playSlideshow(mo.label, mo.items)} style={st.playBtn} accessibilityLabel={`Play ${mo.label} memory`}>
                    <Ionicons name="play" size={18} color={colors.onBrandPrimary} />
                    <Text style={st.playText}>Play</Text>
                  </Press>
                </View>
                <Strip items={mo.items} testID={`month-${i}-thumb`} />
              </View>
            )) : <EmptyState testID="monthly-empty" icon="film-outline" title="No monthly memories yet" message="Each month with 3 or more photos or videos becomes a memory slideshow." />}
          </>
        )}
        {tab === "events" && (events.length ? events.slice(0, 50).map((e, i) => (
          <View key={i} style={st.card} testID={`event-${i}`}>
            <View style={st.monthHead}>
              <View style={{ flex: 1 }}>
                <Text style={st.title}>{new Date(e[0].creationTime).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</Text>
                <Body muted>{e.length} items · {Math.max(1, Math.round((e[e.length - 1].creationTime - e[0].creationTime) / 3600000))} h span</Body>
              </View>
              <Press testID={`event-play-${i}`} onPress={() => playSlideshow(new Date(e[0].creationTime).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }), e)} style={st.playBtn} accessibilityLabel="Play event slideshow">
                <Ionicons name="play" size={18} color={colors.onBrandPrimary} />
                <Text style={st.playText}>Play</Text>
              </Press>
            </View>
            <Strip items={e} testID={`event-${i}-thumb`} />
          </View>
        )) : <EmptyState testID="events-empty" icon="calendar-outline" title="No events yet" message="Events appear when 4+ photos are taken close together in time." />)}
        {tab === "onthisday" && (otd.length ? <View style={st.card}><Text style={st.title}>On this day</Text><Strip items={otd} testID="otd-thumb" /></View> : <EmptyState testID="otd-empty" icon="time-outline" title="Nothing from this date" message="Photos taken on today's date in past years appear here." />)}
        {tab === "bursts" && (bursts.length ? bursts.map((b, i) => (
          <View key={i} style={st.card} testID={`burst-${i}`}>
            <Text style={st.title}>{b.length} shots · {new Date(b[0].creationTime).toLocaleString()}</Text>
            <Body muted>Tap a frame to mark it as your pick (adds to Favourites). Nothing is deleted automatically.</Body>
            <Strip items={b} testID={`burst-${i}-thumb`} onLong={(m) => { updateMeta([m.id], { fav: true }); fb.toast("Marked as best frame", "success"); }} />
          </View>
        )) : <EmptyState testID="bursts-empty" icon="layers-outline" title="No bursts" message="Sequences of 3+ photos taken within 2 seconds are grouped here." />)}
        {tab === "people" && (
          <View style={st.card} testID="people-unavailable">
            <Badge label="Requires local model" kind="warning" />
            <Text style={st.title}>Face & pet grouping</Text>
            <Body muted>Grouping people and pets needs an on-device face/animal detection model, which this build does not include. RF Photos will not guess identities. Use tags (e.g. “mum”, “rex”) in the viewer and search them instead.</Body>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  title: { color: c.onSurface, fontWeight: "700", fontSize: 16 },
  thumb: { width: 72, height: 72, borderRadius: radius.sm, overflow: "hidden", backgroundColor: c.surfaceTertiary },
  best: { borderWidth: 3, borderColor: c.brandPrimary },
  monthHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  playBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.brandPrimary, minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.pill },
  playText: { color: c.onBrandPrimary, fontWeight: "700", fontSize: 14 },
  savedRow: { flexDirection: "row", alignItems: "center" },
  savedMain: { flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1, minHeight: 56 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
}));

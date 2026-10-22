import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { openViewer } from "@/src/components/MediaGrid";
import { useFeedback } from "@/src/components/feedback";
import { Badge, Chip, ChipRow, EmptyState, Header, Press, Screen, Body } from "@/src/components/ui";
import { groupBursts, groupEvents, onThisDay } from "@/src/media/analysis";
import { useAllMedia } from "@/src/media/library";
import { MediaItem, updateMeta, useStore } from "@/src/store";
import { makeStyles, radius, spacing } from "@/src/theme";

function Strip({ items, testID, onLong }: { items: MediaItem[]; testID: string; onLong?: (m: MediaItem) => void }) {
  const st = useStyles();
  const meta = useStore((s) => s.meta);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
      {items.slice(0, 30).map((m, i) => (
        <Press key={m.id} testID={`${testID}-${i}`} onPress={() => (onLong ? onLong(m) : openViewer(items, i))} style={[st.thumb, meta[m.id]?.fav && st.best]}>
          <Image source={{ uri: m.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        </Press>
      ))}
    </ScrollView>
  );
}

export default function Memories() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const fb = useFeedback();
  const all = useAllMedia();
  const [tab, setTab] = useState<"events" | "onthisday" | "bursts" | "people">("events");
  const events = useMemo(() => groupEvents(all), [all]);
  const otd = useMemo(() => onThisDay(all), [all]);
  const bursts = useMemo(() => groupBursts(all), [all]);

  return (
    <Screen>
      <Header title="Memories" subtitle="Built only from real capture dates in your library" />
      <ChipRow>
        <Chip testID="memories-tab-events" label={`Events ${events.length}`} active={tab === "events"} onPress={() => setTab("events")} />
        <Chip testID="memories-tab-onthisday" label={`On this day ${otd.length}`} active={tab === "onthisday"} onPress={() => setTab("onthisday")} />
        <Chip testID="memories-tab-bursts" label={`Bursts ${bursts.length}`} active={tab === "bursts"} onPress={() => setTab("bursts")} />
        <Chip testID="memories-tab-people" label="People & pets" active={tab === "people"} onPress={() => setTab("people")} />
      </ChipRow>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        {tab === "events" && (events.length ? events.slice(0, 50).map((e, i) => (
          <View key={i} style={st.card} testID={`event-${i}`}>
            <Text style={st.title}>{new Date(e[0].creationTime).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</Text>
            <Body muted>{e.length} items · {Math.max(1, Math.round((e[e.length - 1].creationTime - e[0].creationTime) / 3600000))} h span</Body>
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
}));

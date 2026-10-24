// Honest feature classification (spec §112). Keep in sync with the implementation.
import React, { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge, Chip, ChipRow, Header, Screen, Body } from "@/src/components/ui";
import { makeStyles, radius, spacing } from "@/src/theme";

type S = "Implemented" | "Partial" | "Hardware dependent" | "Requires local model" | "Deferred";
const F: [string, S, string][] = [
  ["Gallery (MediaStore), paging, incremental index", "Implemented", "expo-media-library, live change listener"],
  ["Albums, create/add/delete, smart collections", "Implemented", "Device albums + rule-based smart albums"],
  ["Favourites, archive, tags, captions, notes", "Implemented", "Local database"],
  ["Viewer: swipe, pinch/double-tap zoom, filmstrip, video playback", "Implemented", "Autoplay, native controls, error fallback with Open with…; subtitles: deferred"],
  ["Date-grouped gallery (Today, Yesterday, dates)", "Implemented", "Gallery, picker, albums, collections and search"],
  ["Selection: tap, long-press, select all, per-day, deselect", "Implemented", "Share sends one file per share sheet (Android limitation), in sequence"],
  ["Monthly memories & offline memory slideshows", "Implemented", "Fade/slide/zoom transitions, Ken Burns, inline video clips, saved slideshows; played in-app, not exported as a video file"],
  ["Privacy Policy & Terms", "Implemented", "In-app, linked from Settings, Privacy Center and permission screens"],
  ["Multi-select batch actions", "Implemented", "Favourite, album, archive, share, vault, delete, batch, collage"],
  ["Import (system photo picker / file browser) + tracker", "Implemented", "Copies into app storage, skips items already in the gallery, keeps capture dates from EXIF"],
  ["Universal natural-language search + why-matched", "Implemented", "Dates, types, orientation, size, tags, notes, documents"],
  ["Media Inspector (EXIF, GPS, SHA-256)", "Implemented", "Codec/frame-rate details need native probe: deferred"],
  ["Visual Time Machine / Before-After Lab", "Implemented", "Slider + side-by-side"],
  ["Photo editor: crop ratios, rotate, flip, resize", "Implemented", "Free-form crop handles & perspective: deferred"],
  ["Exposure, brightness, contrast, saturation, temperature, tint, fade, 10 filters", "Implemented", "Skia GPU on device, Canvas on web"],
  ["Curves, HSL, LUTs, vignette, sharpening, noise reduction", "Deferred", "Needs custom shader pipeline"],
  ["Layers & masks studio", "Deferred", "Not faked with flattened filters"],
  ["AI edits: background removal, upscale, restoration, HDR/focus stack", "Requires local model", ""],
  ["Camera: photo, video, flash, zoom, timer, grid, burst, front/back", "Implemented", "expo-camera"],
  ["Camera recipes (9)", "Implemented", "Use only exposed controls"],
  ["Manual ISO/shutter/RAW/HDR/night", "Hardware dependent", "Not exposed by Expo camera API → hidden"],
  ["AR lenses (face mesh)", "Requires local model", "Native face-tracking module needed"],
  ["Video trim/merge/timeline/multi-track/export", "Deferred", "Needs native FFmpeg/Media3 transformer"],
  ["Best Moment Extractor (frames from video)", "Implemented", "Auto quality ranking needs a vision model"],
  ["Burst grouping + manual best pick", "Implemented", ""],
  ["Storyboard / contact sheet / posters / collages / stories", "Implemented", "10 real templates, 2160px export, editable projects"],
  ["Infinite canvas studio", "Deferred", ""],
  ["Brand kit (name, colour, watermark)", "Partial", "Logo/font import deferred"],
  ["Print/photo book PDF", "Partial", "Document PDF export works; multi-page photo book layout deferred"],
  ["Document Studio: scan, rotate, multi-page, PDF, tags", "Implemented", "Edge detection/perspective: deferred"],
  ["OCR", "Requires local model", "Manual searchable text instead"],
  ["Batch Creative Pipeline + NL workflow + dry run", "Implemented", "Per-file results, cancel, job history"],
  ["Storage Impact Simulator", "Implemented", "Labelled estimates, verified sizes after run"],
  ["RF Action Agent (typed tools, preview, confirm, undo)", "Implemented", "Rule-based parser, no LLM"],
  ["Memories: events, on this day", "Implemented", "From real timestamps only"],
  ["People / pet / face grouping", "Requires local model", ""],
  ["Visual Travel Atlas", "Partial", "Coordinate clusters + labels; no offline map tiles"],
  ["Visual Relationship Explorer graph", "Deferred", ""],
  ["Private Vault: PIN + biometrics + isolation", "Implemented", "Hidden from gallery, search, backups"],
  ["Vault encryption at rest", "Deferred", "Needs native AES module; not claimed"],
  ["Private space profiles", "Deferred", ""],
  ["Privacy Center + network audit", "Implemented", ""],
  ["Privacy Export Shield (strip + verify)", "Implemented", "Verification reads output EXIF on Android"],
  ["Storage Guardian", "Implemented", "Disk, cache, vault, largest videos, duplicates"],
  ["Local backup (metadata), media-to-folder, restore preview", "Implemented", "SHA-256 manifests; SAF on Android"],
  ["Disaster recovery drill", "Implemented", "Re-hash + in-memory test restore"],
  ["Media Health dashboard + jobs + restart recovery", "Implemented", "Interrupted jobs flagged on launch"],
  ["On-device model manager", "Partial", "Registry + honest engine list; no inference runtime"],
  ["Visual clipboard", "Implemented", "Explicit adds only"],
  ["Capture planner", "Implemented", ""],
  ["Photo notes & annotations", "Partial", "Text annotations; region drawing deferred"],
  ["Client proofing / family timeline / live sessions", "Deferred", "Ratings/approval fields exist in schema"],
  ["Cross-device transfer & conflict resolver", "Partial", "Backup file export/import; conflict UI deferred"],
  ["Lens/template/workflow pack marketplace", "Deferred", "Local packs only, none shipped"],
  ["Photo-to-3D reconstruction", "Requires local model", ""],
  ["Subtitle & audio intelligence", "Requires local model", ""],
  ["Motion tracking / intelligent reframe", "Deferred", ""],
  ["Light / dark / system theme, reduced motion", "Implemented", ""],
];
const KIND: Record<S, "success" | "warning" | "info" | "error" | "brand"> = { Implemented: "success", Partial: "info", "Hardware dependent": "brand", "Requires local model": "warning", Deferred: "error" };

export default function Status() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const [f, setF] = useState<S | "All">("All");
  const list = useMemo(() => F.filter((x) => f === "All" || x[1] === f), [f]);
  const counts = (s: S) => F.filter((x) => x[1] === s).length;
  return (
    <Screen>
      <Header title="Feature Status" subtitle="Truthful classification of every capability" />
      <ChipRow>
        <Chip testID="status-all" label={`All ${F.length}`} active={f === "All"} onPress={() => setF("All")} />
        {(Object.keys(KIND) as S[]).map((s) => <Chip key={s} testID={`status-${s.replace(/ /g, "-").toLowerCase()}`} label={`${s} ${counts(s)}`} active={f === s} onPress={() => setF(s)} />)}
      </ChipRow>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: insets.bottom + spacing.xl }}>
        {list.map(([name, s, note]) => (
          <View key={name} style={st.row}>
            <Badge label={s} kind={KIND[s]} />
            <Text style={st.name}>{name}</Text>
            {!!note && <Body muted>{note}</Body>}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  row: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  name: { color: c.onSurface, fontWeight: "700", fontSize: 15 },
}));

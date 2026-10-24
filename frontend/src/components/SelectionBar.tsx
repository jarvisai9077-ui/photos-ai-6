// Bottom bar for selection: select all / deselect, then batch actions (favourite, slideshow, album, archive,
// share, privacy export, batch, collage, vault, delete).
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MediaItem, updateMeta, useStore } from "@/src/store";
import { createAlbum, deleteMedia, deviceLibraryAvailable } from "@/src/media/library";
import { shareMany } from "@/src/media/share";
import { playSlideshow } from "@/src/media/slideshow";
import { moveToVault } from "@/src/media/vault";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { useFeedback } from "./feedback";
import { Glass, Ionicons, IconName, Press } from "./ui";

let batch: MediaItem[] = [];
export const getBatch = () => batch;
export const setBatch = (b: MediaItem[]) => (batch = b);

type Props = { items: MediaItem[]; total: number; onDone: () => void; onSelectAll: () => void; onClear: () => void; bottom: number };

export function SelectionBar({ items, total, onDone, onSelectAll, onClear, bottom }: Props) {
  const fb = useFeedback();
  const st = useStyles();
  const { colors } = useTheme();
  const meta = useStore((s) => s.meta);
  const insets = useSafeAreaInsets();
  const n = items.length;
  const allFav = n > 0 && items.every((i) => meta[i.id]?.fav);
  const allSelected = n > 0 && n >= total;
  const label = (k: number) => `${k} ${k === 1 ? "item" : "items"}`;

  const guard = (fn: () => Promise<void> | void) => async () => {
    if (!n) return fb.toast("Select at least one photo or video first", "info");
    try {
      await fn();
    } catch (e: any) {
      fb.toast(e?.message || "Something went wrong", "error");
    }
  };

  const actions: { icon: IconName; label: string; id: string; run: () => Promise<void> | void; danger?: boolean }[] = [
    { icon: allFav ? "heart-dislike-outline" : "heart-outline", label: allFav ? "Unfavourite" : "Favourite", id: "fav", run: () => { updateMeta(items.map((i) => i.id), { fav: !allFav }); fb.toast(`${label(n)} ${allFav ? "removed from" : "added to"} Favourites`, "success"); onDone(); } },
    {
      icon: "share-outline", label: "Share", id: "share",
      run: async () => {
        const done = await shareMany(items, (i, total) => fb.confirm({ title: `Share item ${i} of ${total}?`, message: "Android's share sheet sends one file at a time.", confirmLabel: "Share next" }));
        if (done) fb.toast(`Shared ${label(done)}`, "success");
      },
    },
    { icon: "play-circle-outline", label: "Slideshow", id: "slideshow", run: () => { playSlideshow("Selected memories", items); onDone(); } },
    {
      icon: "albums-outline", label: "New album", id: "album",
      run: async () => {
        if (!deviceLibraryAvailable) return fb.toast("Device albums need RF Photos installed with photo access", "error");
        const name = await fb.prompt({ title: "New album", message: `${label(n)} will be copied into the album. Originals stay where they are.`, placeholder: "Album name" });
        if (!name) return;
        await createAlbum(name, items, true);
        fb.toast(`Album “${name}” created`, "success");
        onDone();
      },
    },
    { icon: "archive-outline", label: "Archive", id: "archive", run: () => { updateMeta(items.map((i) => i.id), { archived: true }); fb.toast(`${label(n)} archived (hidden from Photos)`, "success"); onDone(); } },
    { icon: "shield-checkmark-outline", label: "Privacy export", id: "privacy", run: () => { setBatch(items); router.push("/privacy-export"); onDone(); } },
    { icon: "construct-outline", label: "Batch", id: "batch", run: () => { setBatch(items); router.push("/automation"); onDone(); } },
    {
      icon: "grid-outline", label: "Collage", id: "collage",
      run: () => {
        const photos = items.filter((i) => i.mediaType === "photo").slice(0, 9);
        if (!photos.length) return fb.toast("Collages need at least one photo", "info");
        setBatch(photos); router.push("/collage"); onDone();
      },
    },
    {
      icon: "lock-closed-outline", label: "Vault", id: "vault",
      run: async () => {
        const ok = await fb.confirm({ title: `Move ${label(n)} to Vault?`, message: "Copies go into RF Photos' private app storage and are hidden from the gallery and search. You can choose to delete the originals afterwards.", confirmLabel: "Move to Vault" });
        if (!ok) return;
        const r = await moveToVault(items);
        fb.toast(`${r.ok} moved to Vault${r.failed ? `, ${r.failed} failed` : ""}`, r.failed ? "error" : "success");
        onDone();
      },
    },
    {
      icon: "trash-outline", label: "Delete", id: "delete", danger: true,
      run: async () => {
        const ok = await fb.confirm({ title: `Delete ${label(n)}?`, message: "Gallery items are removed from your device (Android may ask you to confirm). Imported items are removed from RF Photos. This can't be undone by RF Photos.", confirmLabel: "Delete", destructive: true });
        if (!ok) return;
        const done = await deleteMedia(items);
        fb.toast(done ? `${label(n)} deleted` : "Deletion was cancelled", done ? "success" : "info");
        if (done) onDone();
      },
    },
  ];

  return (
    <Glass style={[st.bar, { bottom: bottom + spacing.sm, marginBottom: bottom === 0 ? insets.bottom : 0 }]}>
      <View style={st.top}>
        <Text testID="selection-count" style={st.count}>{n ? `${n} selected` : "Tap items to select"}</Text>
        <View style={st.topActions}>
          <Press testID="selection-all-button" onPress={allSelected ? onClear : onSelectAll} style={st.topBtn}>
            <Text style={st.link}>{allSelected ? "Deselect all" : "Select all"}</Text>
          </Press>
          {n > 0 && !allSelected && (
            <Press testID="selection-clear-button" onPress={onClear} style={st.topBtn}><Text style={st.link}>Clear</Text></Press>
          )}
          <Press testID="selection-cancel-button" onPress={onDone} style={st.topBtn}><Text style={[st.link, { fontWeight: "700" }]}>Done</Text></Press>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingHorizontal: spacing.sm }}>
        {actions.map((a) => (
          <Press key={a.id} testID={`selection-${a.id}-button`} disabled={n === 0} onPress={guard(a.run)} style={st.action}>
            <Ionicons name={a.icon} size={22} color={a.danger ? colors.error : colors.onSurface} />
            <Text style={[st.label, a.danger && { color: colors.error }]}>{a.label}</Text>
          </Press>
        ))}
      </ScrollView>
    </Glass>
  );
}

const useStyles = makeStyles((c) => ({
  bar: { position: "absolute", left: spacing.md, right: spacing.md, borderRadius: radius.xl, paddingVertical: spacing.sm, borderWidth: 0.5, borderColor: c.border, shadowColor: c.shadow, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: spacing.lg, paddingRight: spacing.sm },
  topActions: { flexDirection: "row", alignItems: "center" },
  topBtn: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  count: { color: c.onSurface, fontWeight: "700", fontSize: 15, flexShrink: 1 },
  link: { color: c.brandPrimary, fontWeight: "600", fontSize: 14 },
  action: { width: 72, height: 56, alignItems: "center", justifyContent: "center", gap: 3 },
  label: { color: c.onSurface, fontSize: 11, fontWeight: "500" },
}));

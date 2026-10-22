// Bottom bar for multi-selection batch actions (favourite, album, archive, share, privacy export, vault, delete).
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MediaItem, updateMeta, useStore } from "@/src/store";
import { createAlbum, deleteMedia, deviceLibraryAvailable } from "@/src/media/library";
import { localUriFor } from "@/src/media/files";
import { moveToVault } from "@/src/media/vault";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { useFeedback } from "./feedback";
import { Glass, Ionicons, IconName, Press } from "./ui";

let batch: MediaItem[] = [];
export const getBatch = () => batch;
export const setBatch = (b: MediaItem[]) => (batch = b);

export function SelectionBar({ items, onDone, bottom }: { items: MediaItem[]; onDone: () => void; bottom: number }) {
  const fb = useFeedback();
  const st = useStyles();
  const { colors } = useTheme();
  const meta = useStore((s) => s.meta);
  const insets = useSafeAreaInsets();
  const n = items.length;
  const allFav = n > 0 && items.every((i) => meta[i.id]?.fav);

  const actions: { icon: IconName; label: string; id: string; run: () => Promise<void> | void; danger?: boolean }[] = [
    { icon: allFav ? "heart-dislike-outline" : "heart-outline", label: allFav ? "Unfavourite" : "Favourite", id: "fav", run: () => { updateMeta(items.map((i) => i.id), { fav: !allFav }); fb.toast(`${n} ${allFav ? "removed from" : "added to"} Favourites`, "success"); onDone(); } },
    {
      icon: "albums-outline", label: "New album", id: "album",
      run: async () => {
        if (!deviceLibraryAvailable) return fb.toast("Device albums need the Android media library", "error");
        const name = await fb.prompt({ title: "New album", message: `${n} item(s) will be copied into the album. Originals stay where they are.`, placeholder: "Album name" });
        if (!name) return;
        try { await createAlbum(name, items, true); fb.toast(`Album “${name}” created`, "success"); onDone(); } catch (e: any) { fb.toast(e?.message || "Could not create album", "error"); }
      },
    },
    { icon: "archive-outline", label: "Archive", id: "archive", run: () => { updateMeta(items.map((i) => i.id), { archived: true }); fb.toast(`${n} archived (hidden from Photos)`, "success"); onDone(); } },
    {
      icon: "share-outline", label: "Share", id: "share",
      run: async () => {
        if (!(await Sharing.isAvailableAsync())) return fb.toast("Sharing is not available on this device", "error");
        if (n > 1) fb.toast("Android shares one file at a time here; sharing the first item", "info");
        await Sharing.shareAsync(await localUriFor(items[0].id, items[0].uri));
      },
    },
    { icon: "shield-checkmark-outline", label: "Privacy export", id: "privacy", run: () => { setBatch(items); router.push("/privacy-export"); onDone(); } },
    { icon: "construct-outline", label: "Batch", id: "batch", run: () => { setBatch(items); router.push("/automation"); onDone(); } },
    { icon: "grid-outline", label: "Collage", id: "collage", run: () => { setBatch(items.filter((i) => i.mediaType === "photo").slice(0, 9)); router.push("/collage"); onDone(); } },
    {
      icon: "lock-closed-outline", label: "Vault", id: "vault",
      run: async () => {
        const ok = await fb.confirm({ title: `Move ${n} to Vault?`, message: "Copies go into RF Photos' private app storage and are hidden from the gallery and search. You can choose to delete the originals afterwards.", confirmLabel: "Move to Vault" });
        if (!ok) return;
        const r = await moveToVault(items);
        fb.toast(`${r.ok} moved to Vault${r.failed ? `, ${r.failed} failed` : ""}`, r.failed ? "error" : "success");
        onDone();
      },
    },
    {
      icon: "trash-outline", label: "Delete", id: "delete", danger: true,
      run: async () => {
        const ok = await fb.confirm({ title: `Delete ${n} item(s)?`, message: "This removes them from your device. Android may ask you to confirm. This cannot be undone by RF Photos.", confirmLabel: "Delete", destructive: true });
        if (!ok) return;
        try { const done = await deleteMedia(items); fb.toast(done ? `${n} deleted` : "Deletion was cancelled", done ? "success" : "info"); onDone(); } catch (e: any) { fb.toast(e?.message || "Delete failed", "error"); }
      },
    },
  ];

  return (
    <Glass style={[st.bar, { bottom: bottom + spacing.sm, marginBottom: bottom === 0 ? insets.bottom : 0 }]}>
      <View style={st.top}>
        <Text testID="selection-count" style={st.count}>{n} selected</Text>
        <Press testID="selection-cancel-button" onPress={onDone}><Text style={st.cancel}>Done</Text></Press>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingHorizontal: spacing.sm }}>
        {actions.map((a) => (
          <Press key={a.id} testID={`selection-${a.id}-button`} disabled={n === 0} onPress={a.run} style={st.action}>
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
  top: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingBottom: spacing.xs },
  count: { color: c.onSurface, fontWeight: "700", fontSize: 15 },
  cancel: { color: c.brandPrimary, fontWeight: "600", fontSize: 15 },
  action: { width: 72, height: 56, alignItems: "center", justifyContent: "center", gap: 3 },
  label: { color: c.onSurface, fontSize: 11, fontWeight: "500" },
}));

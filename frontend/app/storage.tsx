import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeedback } from "@/src/components/feedback";
import { openViewer } from "@/src/components/MediaGrid";
import { Button, Card, Header, Progress, Row, Screen, SectionTitle, Body } from "@/src/components/ui";
import { duplicateCandidates } from "@/src/media/analysis";
import { FS, fileSize, formatBytes, formatDuration, isWeb, localUriFor } from "@/src/media/files";
import { isScreenshot, useAllMedia } from "@/src/media/library";
import { MediaItem } from "@/src/store";
import { makeStyles, spacing } from "@/src/theme";

async function dirSize(path: string): Promise<number> {
  try {
    const info = await FS.getInfoAsync(path);
    if (!info.exists) return 0;
    if (!info.isDirectory) return (info as any).size || 0;
    const names = await FS.readDirectoryAsync(path);
    let t = 0;
    for (const n of names.slice(0, 2000)) t += await dirSize(path + (path.endsWith("/") ? "" : "/") + n);
    return t;
  } catch { return 0; }
}

export default function Storage() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const fb = useFeedback();
  const all = useAllMedia();
  const [disk, setDisk] = useState<{ free: number; total: number } | null>(null);
  const [cache, setCache] = useState<number | null>(null);
  const [vaultSize, setVaultSize] = useState<number | null>(null);
  const [big, setBig] = useState<{ item: MediaItem; size: number | null }[] | null>(null);
  const [scanning, setScanning] = useState(false);

  const stats = useMemo(() => ({
    photos: all.filter((m) => m.mediaType === "photo").length,
    videos: all.filter((m) => m.mediaType === "video").length,
    shots: all.filter(isScreenshot).length,
    dups: duplicateCandidates(all).reduce((n, g) => n + g.length - 1, 0),
    videoSecs: all.filter((m) => m.mediaType === "video").reduce((s, m) => s + m.duration, 0),
  }), [all]);

  const refresh = async () => {
    if (isWeb) return;
    const [free, total] = await Promise.all([FS.getFreeDiskStorageAsync(), FS.getTotalDiskCapacityAsync()]);
    setDisk({ free, total });
    setCache(await dirSize(FS.cacheDirectory!));
    setVaultSize(await dirSize(FS.documentDirectory + "vault/"));
  };
  useEffect(() => { refresh(); }, []);

  const scanBig = async () => {
    setScanning(true);
    const vids = all.filter((m) => m.mediaType === "video").sort((a, b) => b.duration - a.duration).slice(0, 25);
    const out: { item: MediaItem; size: number | null }[] = [];
    for (const v of vids) out.push({ item: v, size: await fileSize(await localUriFor(v.id, v.uri)) });
    out.sort((a, b) => (b.size || 0) - (a.size || 0));
    setBig(out);
    setScanning(false);
  };
  const clearCache = async () => {
    if (!(await fb.confirm({ title: "Clear regenerable cache?", message: "Removes temporary edit/render files and thumbnails RF Photos can recreate. Your photos, Vault and projects are not touched.", confirmLabel: "Clear cache" }))) return;
    const names = await FS.readDirectoryAsync(FS.cacheDirectory!);
    for (const n of names) await FS.deleteAsync(FS.cacheDirectory + n, { idempotent: true });
    await refresh();
    fb.toast("Cache cleared", "success");
  };

  const used = disk ? disk.total - disk.free : 0;
  return (
    <Screen>
      <Header title="Storage Guardian" subtitle="Real measurements · nothing is deleted automatically" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
        <Card testID="storage-disk-card">
          <Text style={st.big}>{disk ? formatBytes(disk.free) : "—"} <Text style={st.unit}>free</Text></Text>
          {disk ? <><Progress value={used / disk.total} /><Body muted style={{ marginTop: spacing.sm }}>{formatBytes(used)} used of {formatBytes(disk.total)}</Body></> : <Body muted>{isWeb ? "Device storage figures are available on Android." : "Measuring…"}</Body>}
        </Card>
        <Card>
          <Row testID="storage-photos" icon="image-outline" title={`${stats.photos} photos`} subtitle={`${stats.shots} screenshots`} />
          <Row testID="storage-videos" icon="videocam-outline" title={`${stats.videos} videos`} subtitle={`${formatDuration(stats.videoSecs)} total duration`} />
          <Row testID="storage-duplicates" icon="copy-outline" title={`${stats.dups} possible duplicates`} subtitle="Review before deleting anything" onPress={() => router.push({ pathname: "/collection/[key]", params: { key: "duplicates" } })} />
          <Row testID="storage-screenshots" icon="phone-portrait-outline" title="Review screenshots" subtitle="Often safe to clean up — you decide" onPress={() => router.push({ pathname: "/collection/[key]", params: { key: "screenshots" } })} />
        </Card>
        <Card>
          <Row testID="storage-cache" icon="trash-bin-outline" title={`App cache: ${formatBytes(cache)}`} subtitle="Regenerable render & thumbnail files" />
          <Row testID="storage-vault" icon="lock-closed-outline" title={`Vault storage: ${formatBytes(vaultSize)}`} subtitle="Private copies kept by RF Photos" />
          {!isWeb && <Button testID="storage-clear-cache-button" label="Clear cache" variant="secondary" onPress={clearCache} style={{ marginTop: spacing.sm }} />}
        </Card>
        <SectionTitle title="Largest videos" />
        <Button testID="storage-scan-videos-button" label={big ? "Rescan" : "Measure largest videos"} icon="analytics-outline" loading={scanning} onPress={scanBig} />
        {big?.length === 0 && <Body muted>No videos found.</Body>}
        {big?.map((b, i) => (
          <Row key={b.item.id} testID={`storage-big-${i}`} icon="film-outline" title={b.item.filename} subtitle={`${formatBytes(b.size)} · ${formatDuration(b.item.duration)} · ${b.item.width}×${b.item.height}`} onPress={() => openViewer(big.map((x) => x.item), i)} />
        ))}
        <Body muted>Tip: use Batch Pipeline to create smaller copies (resize/convert). Estimates there are approximate and verified after processing.</Body>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  big: { color: c.onSurface, fontSize: 32, fontWeight: "800", marginBottom: spacing.sm },
  unit: { color: c.muted, fontSize: 16, fontWeight: "500" },
}));

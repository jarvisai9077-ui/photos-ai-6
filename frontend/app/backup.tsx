// Smart Local Backup + Recovery + Disaster Recovery Drill. Local destinations only, SHA-256 verified.
import React, { useEffect, useState } from "react";
import { Platform, ScrollView, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeedback } from "@/src/components/feedback";
import { Badge, Button, Card, Header, Progress, Row, Screen, SectionTitle, Body } from "@/src/components/ui";
import { ensureDir, formatBytes, FS, isWeb, localUriFor, sha256File, sha256Text, MAX_HASH_BYTES, fileSize } from "@/src/media/files";
import { pickMedia } from "@/src/media/picker";
import { getState, replaceState, startJob, State, updateJob } from "@/src/store";
import { makeStyles, spacing } from "@/src/theme";

const DIR = isWeb ? "" : FS.documentDirectory + "backups/";
type Manifest = { app: "rf-photos"; kind: "metadata"; version: number; created: number; hash: string; payload: string };

function payloadFromState(s: State) {
  // Vault boundary: vault items and their file paths are never written to backups.
  const { vault, imported, ...rest } = s; // eslint-disable-line @typescript-eslint/no-unused-vars
  return JSON.stringify({ ...rest, imported: imported.filter((i) => !i.uri.startsWith("data:")) });
}

export default function Backup() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const fb = useFeedback();
  const [files, setFiles] = useState<{ name: string; size: number | null }[]>([]);
  const [drill, setDrill] = useState<{ name: string; status: string; ok: boolean }[] | null>(null);
  const [mediaProg, setMediaProg] = useState<number | null>(null);
  const [restorePreview, setRestorePreview] = useState<{ m: Manifest; data: State; ok: boolean } | null>(null);

  const list = async () => {
    if (isWeb) return;
    await ensureDir(DIR);
    const names = (await FS.readDirectoryAsync(DIR)).filter((n) => n.endsWith(".json")).sort().reverse();
    setFiles(await Promise.all(names.map(async (n) => ({ name: n, size: await fileSize(DIR + n) }))));
  };
  useEffect(() => { list(); }, []);

  const createBackup = async () => {
    const payload = payloadFromState(getState());
    const m: Manifest = { app: "rf-photos", kind: "metadata", version: 1, created: Date.now(), hash: await sha256Text(payload), payload };
    const text = JSON.stringify(m);
    const name = `rf-photos-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    if (isWeb) {
      const a = (globalThis as any).document.createElement("a");
      a.href = "data:application/json;charset=utf-8," + encodeURIComponent(text);
      a.download = name; a.click();
      fb.toast("Backup file downloaded", "success");
      return;
    }
    await ensureDir(DIR);
    await FS.writeAsStringAsync(DIR + name, text);
    const verify = JSON.parse(await FS.readAsStringAsync(DIR + name)) as Manifest;
    const ok = (await sha256Text(verify.payload)) === m.hash;
    await list();
    fb.toast(ok ? "Backup written and hash-verified" : "Backup written but verification FAILED", ok ? "success" : "error");
  };
  const exportFile = async (name: string) => {
    if (Platform.OS === "android") {
      const perm = await FS.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!perm.granted) return fb.toast("No folder chosen", "info");
      const uri = await FS.StorageAccessFramework.createFileAsync(perm.directoryUri, name.replace(/\.json$/, ""), "application/json");
      await FS.StorageAccessFramework.writeAsStringAsync(uri, await FS.readAsStringAsync(DIR + name));
      fb.toast("Copied to the selected folder (SD card / USB / local folder)", "success");
    } else if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(DIR + name);
  };
  const pickRestore = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ["application/json", "*/*"], copyToCacheDirectory: true });
    if (r.canceled) return;
    try {
      const text = isWeb ? await (await fetch(r.assets[0].uri)).text() : await FS.readAsStringAsync(r.assets[0].uri);
      const m = JSON.parse(text) as Manifest;
      if (m.app !== "rf-photos") throw new Error("Not an RF Photos backup");
      const ok = (await sha256Text(m.payload)) === m.hash;
      setRestorePreview({ m, data: JSON.parse(m.payload), ok });
    } catch (e: any) { fb.toast(`Invalid backup: ${e?.message || e}`, "error"); }
  };
  const applyRestore = async () => {
    if (!restorePreview) return;
    if (!restorePreview.ok && !(await fb.confirm({ title: "Hash mismatch", message: "This backup may be corrupted. Restore anyway?", destructive: true, confirmLabel: "Restore anyway" }))) return;
    if (!(await fb.confirm({ title: "Restore metadata?", message: "Favourites, tags, notes, albums rules, projects and history will be replaced by the backup. Media files and the Vault are not touched. A safety backup of the current state is written first.", confirmLabel: "Restore" }))) return;
    if (!isWeb) await createBackup();
    const cur = getState();
    replaceState({ ...restorePreview.data, vault: cur.vault } as State);
    setRestorePreview(null);
    fb.toast("Restore complete", "success");
  };
  const runDrill = async () => {
    const out: { name: string; status: string; ok: boolean }[] = [];
    if (!files.length) out.push({ name: "—", status: "No backups found. Create one first.", ok: false });
    for (const f of files) {
      try {
        const m = JSON.parse(await FS.readAsStringAsync(DIR + f.name)) as Manifest;
        const ok = (await sha256Text(m.payload)) === m.hash;
        const data = JSON.parse(m.payload) as State;
        out.push({ name: f.name, ok, status: ok ? `Hash OK · test-restore parsed ${Object.keys(data.meta || {}).length} metadata records, ${data.projects?.length || 0} projects (into memory only — nothing overwritten)` : "CORRUPTED: hash mismatch" });
      } catch (e: any) { out.push({ name: f.name, ok: false, status: `Unreadable: ${e?.message || e}` }); }
    }
    setDrill(out);
  };
  const backupMedia = async () => {
    if (Platform.OS !== "android") return fb.toast("Folder backup uses Android's storage access framework", "info");
    const items = await pickMedia({ max: 200, title: "Media to back up" });
    if (!items.length) return;
    const perm = await FS.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!perm.granted) return;
    const job = startJob(`Media backup (${items.length})`, items.length);
    const manifest: { file: string; sha256: string | null; size: number | null }[] = [];
    let ok = 0, failed = 0; const errors: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      try {
        const src = await localUriFor(it.id, it.uri);
        const size = await fileSize(src);
        if (size && size > MAX_HASH_BYTES) throw new Error("too large for in-app copy (>40 MB)");
        const b64 = await FS.readAsStringAsync(src, { encoding: FS.EncodingType.Base64 });
        const dest = await FS.StorageAccessFramework.createFileAsync(perm.directoryUri, it.filename, it.mediaType === "video" ? "video/mp4" : "image/jpeg");
        await FS.StorageAccessFramework.writeAsStringAsync(dest, b64, { encoding: FS.EncodingType.Base64 });
        manifest.push({ file: it.filename, sha256: await sha256File(src), size });
        ok++;
      } catch (e: any) { failed++; errors.push(`${it.filename}: ${e?.message || e}`); }
      setMediaProg((i + 1) / items.length);
      updateJob(job, { ok, failed });
    }
    const mf = await FS.StorageAccessFramework.createFileAsync(perm.directoryUri, "rf-media-manifest", "application/json");
    await FS.StorageAccessFramework.writeAsStringAsync(mf, JSON.stringify({ created: Date.now(), files: manifest }, null, 1));
    updateJob(job, { status: failed && !ok ? "failed" : "done", ended: Date.now(), errors });
    setMediaProg(null);
    fb.toast(`${ok} copied with manifest${failed ? `, ${failed} failed` : ""}`, failed ? "error" : "success");
  };

  return (
    <Screen>
      <Header title="Backup & Recovery" subtitle="Local only · no cloud · hash verified" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
        <Card>
          <Text style={st.h}>Library metadata backup</Text>
          <Body muted>Favourites, tags, captions, notes, smart albums, projects, versions, documents and history. Vault content is excluded by design.</Body>
          <Button testID="backup-create-button" label="Create backup now" icon="save-outline" onPress={createBackup} style={{ marginTop: spacing.md }} />
          <Button testID="backup-restore-button" label="Restore from file…" icon="arrow-undo-outline" variant="secondary" onPress={pickRestore} style={{ marginTop: spacing.sm }} />
        </Card>
        {restorePreview && (
          <Card testID="restore-preview">
            <Text style={st.h}>Restore preview</Text>
            <Badge label={restorePreview.ok ? "Hash verified" : "Hash mismatch"} kind={restorePreview.ok ? "success" : "error"} />
            <Body muted style={{ marginTop: spacing.sm }}>Created {new Date(restorePreview.m.created).toLocaleString()} · {Object.keys(restorePreview.data.meta || {}).length} metadata records · {restorePreview.data.smartAlbums?.length || 0} smart albums · {restorePreview.data.projects?.length || 0} projects · {restorePreview.data.documents?.length || 0} documents</Body>
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
              <Button testID="restore-cancel" label="Cancel" variant="ghost" style={{ flex: 1 }} onPress={() => setRestorePreview(null)} />
              <View style={{ flex: 1 }}><Button testID="restore-apply" label="Restore" onPress={applyRestore} /></View>
            </View>
          </Card>
        )}
        <Card>
          <Text style={st.h}>Media backup to a folder</Text>
          <Body muted>Copy selected photos/videos to an SD card, USB/OTG drive or any local folder you choose, with a SHA-256 manifest.</Body>
          {mediaProg !== null && <View style={{ marginTop: spacing.sm }}><Progress value={mediaProg} /></View>}
          <Button testID="backup-media-button" label="Back up media…" icon="folder-open-outline" variant="secondary" onPress={backupMedia} style={{ marginTop: spacing.md }} />
        </Card>
        <SectionTitle title="Backups on this device" />
        {isWeb && <Body muted>On the web preview backups download as files.</Body>}
        {files.map((f) => <Row key={f.name} testID={`backup-file-${f.name}`} icon="document-lock-outline" title={f.name.replace("rf-photos-backup-", "")} subtitle={formatBytes(f.size)} onPress={() => exportFile(f.name)} />)}
        {!isWeb && files.length === 0 && <Body muted>None yet.</Body>}
        <SectionTitle title="Disaster recovery drill" />
        <Body muted>Re-hashes every local backup and performs a test restore into memory. Your current data is never overwritten by the drill.</Body>
        <Button testID="backup-drill-button" label="Run drill" icon="medkit-outline" variant="secondary" onPress={runDrill} disabled={isWeb} />
        {drill?.map((d, i) => <View key={i} style={{ flexDirection: "row", gap: spacing.sm }} testID={`drill-${i}`}><Badge label={d.ok ? "PASS" : "FAIL"} kind={d.ok ? "success" : "error"} /><Body style={{ flex: 1 }}>{d.status}</Body></View>)}
        <Body muted>Recently deleted: Android keeps its own trash for 30 days on Android 11+ in the system gallery; RF Photos cannot recover files deleted permanently.</Body>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({ h: { color: c.onSurface, fontWeight: "700", fontSize: 16, marginBottom: spacing.xs } }));

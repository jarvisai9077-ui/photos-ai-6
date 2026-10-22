// Media Health Dashboard + Import Source Tracker + Processing job history + Index Manager.
import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeedback } from "@/src/components/feedback";
import { Badge, Button, Card, Header, Row, Screen, SectionTitle, Body } from "@/src/components/ui";
import { findItem, indexLibrary, useLibrary, deviceLibraryAvailable } from "@/src/media/library";
import { formatBytes } from "@/src/media/files";
import { getState, setState, useStore } from "@/src/store";
import { makeStyles, spacing } from "@/src/theme";

export default function Health() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const fb = useFeedback();
  const lib = useLibrary((s) => s);
  const jobs = useStore((s) => s.jobs);
  const imports = useStore((s) => s.imports);
  const versions = useStore((s) => s.versions);
  const docs = useStore((s) => s.documents.length);
  const [missing, setMissing] = useState<number | null>(null);
  const indexBytes = JSON.stringify(getState()).length;
  const interrupted = jobs.filter((j) => j.status === "interrupted").length;
  const failed = jobs.filter((j) => j.status === "failed").length;

  const checkMissing = () => setMissing(versions.filter((v) => v.outputId && !findItem(v.outputId)).length + versions.filter((v) => !findItem(v.sourceId)).length);

  return (
    <Screen>
      <Header title="Media Health" subtitle="Real counts from the local index" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
        <Card testID="health-summary">
          <Row testID="health-indexed" icon="albums-outline" title={`${lib.items.length} device items indexed`} subtitle={deviceLibraryAvailable ? `of ${lib.total} reported by MediaStore · ${lib.indexedAt ? `fresh ${new Date(lib.indexedAt).toLocaleTimeString()}` : "not finished"}` : "Device index runs on Android"} />
          <Row testID="health-status" icon="pulse-outline" title={`Index status: ${lib.status}`} subtitle={lib.error || `Permission: ${lib.permission}`} />
          <Row testID="health-db" icon="server-outline" title={`Local database: ${formatBytes(indexBytes)}`} subtitle={`${versions.length} versions · ${docs} documents`} />
          <Row testID="health-jobs" icon="warning-outline" title={`${interrupted} interrupted · ${failed} failed jobs`} subtitle="Interrupted = app closed mid-job; re-run safely, originals untouched" />
          <Row testID="health-missing" icon="help-circle-outline" title={missing === null ? "Missing-file check not run" : `${missing} missing version/source files`} onPress={checkMissing} />
        </Card>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button testID="health-rebuild-index" label="Rebuild index" variant="secondary" style={{ flex: 1 }} onPress={() => { indexLibrary(); fb.toast("Re-indexing started", "info"); }} />
          <View style={{ flex: 1 }}><Button testID="health-check-missing" label="Check missing" variant="ghost" onPress={checkMissing} /></View>
        </View>
        <SectionTitle title="Processing jobs" />
        {jobs.length === 0 && <Body muted>No jobs yet.</Body>}
        {jobs.slice(0, 30).map((j) => (
          <Card key={j.id} testID={`job-${j.id}`}>
            <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}><Badge label={j.status} kind={j.status === "done" ? "success" : j.status === "running" ? "info" : j.status === "cancelled" ? "warning" : "error"} /><Text style={st.t}>{j.name}</Text></View>
            <Body muted>{j.ok} ok · {j.failed} failed · {new Date(j.started).toLocaleString()}</Body>
            {j.errors.slice(0, 3).map((e, i) => <Body key={i} muted numberOfLines={1}>• {e}</Body>)}
          </Card>
        ))}
        <SectionTitle title="Import source tracker" action={imports.length ? "Clear" : undefined} onAction={() => setState(() => ({ imports: [] }))} testID="health-clear-imports" />
        {imports.length === 0 && <Body muted>No imports recorded.</Body>}
        {imports.map((r) => (
          <Card key={r.id}>
            <Text style={st.t}>{r.source} · {r.count} imported{r.skipped ? ` · ${r.skipped} skipped` : ""}</Text>
            <Body muted>{new Date(r.time).toLocaleString()} via {r.method}</Body>
            {r.errors.slice(0, 3).map((e, i) => <Body key={i} muted numberOfLines={1}>• {e}</Body>)}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({ t: { color: c.onSurface, fontWeight: "700", flex: 1 } }));

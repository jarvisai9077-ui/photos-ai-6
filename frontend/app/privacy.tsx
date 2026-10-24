import React, { useEffect, useState } from "react";
import { Linking, ScrollView, Text } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeedback } from "@/src/components/feedback";
import { Badge, Button, Card, Header, Row, Screen, SectionTitle, ToggleRow, Body } from "@/src/components/ui";
import { useLibrary } from "@/src/media/library";
import { setState, useStore } from "@/src/store";
import { makeStyles, spacing } from "@/src/theme";

export default function Privacy() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const fb = useFeedback();
  const prefs = useStore((s) => s.prefs);
  const locCount = useStore((s) => Object.keys(s.locIndex).length);
  const permission = useLibrary((s) => s.permission);
  const [cam, setCam] = useState("unknown");
  useEffect(() => { ImagePicker.getCameraPermissionsAsync().then((p) => setCam(p.status)).catch(() => setCam("unavailable")); }, []);
  const setPref = (k: keyof typeof prefs, v: any) => setState((s) => ({ prefs: { ...s.prefs, [k]: v } }));

  return (
    <Screen>
      <Header title="Privacy Center" subtitle="Everything stays on this device" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
        <Card testID="privacy-network-audit">
          <Text style={st.h}>Network audit</Text>
          <Badge label="0 network calls in RF Photos code" kind="success" />
          <Body muted style={{ marginTop: spacing.sm }}>RF Photos contains no analytics, telemetry, advertising, cloud SDKs, remote AI or upload code. Search, editing, memories, slideshows, backup and the Action Agent all run locally and work in Airplane Mode.</Body>
        </Card>
        <Card style={{ paddingVertical: spacing.xs }}>
          <Row testID="privacy-policy-link" icon="document-lock-outline" title="Privacy Policy" onPress={() => router.push("/legal/privacy-policy")} />
          <Row testID="privacy-terms-link" icon="reader-outline" title="Terms & Conditions" onPress={() => router.push("/legal/terms")} />
        </Card>
        <SectionTitle title="Local processing" />
        <Card style={{ paddingVertical: spacing.xs }}>
          <ToggleRow testID="privacy-location-toggle" icon="location-outline" title="Location indexing" subtitle={`${locCount} items indexed for Travel Atlas`} value={prefs.indexLocation} onChange={(v) => setPref("indexLocation", v)} />
          <ToggleRow testID="privacy-notes-toggle" icon="document-text-outline" title="Search notes & annotations" subtitle="Include private notes in search" value={prefs.indexNotes} onChange={(v) => setPref("indexNotes", v)} />
          <Row testID="privacy-ocr" icon="text-outline" title="OCR" subtitle="No OCR model installed — nothing is processed" right={<Badge label="Off" />} />
          <Row testID="privacy-faces" icon="people-outline" title="Face grouping" subtitle="No face model installed — no biometric data is created" right={<Badge label="Off" />} />
        </Card>
        <SectionTitle title="Index data" />
        <Card>
          <Button testID="privacy-delete-location-index" label="Delete location index" variant="secondary" onPress={async () => { if (await fb.confirm({ title: "Delete location index?", message: "Removes RF Photos' copy of GPS coordinates. Your photo files are unchanged.", destructive: true, confirmLabel: "Delete" })) { setState(() => ({ locIndex: {} })); fb.toast("Location index deleted", "success"); } }} />
          <Button testID="privacy-delete-history" label="Delete action & import history" variant="secondary" style={{ marginTop: spacing.sm }} onPress={async () => { if (await fb.confirm({ title: "Delete history?", destructive: true, confirmLabel: "Delete" })) { setState(() => ({ agentHistory: [], imports: [], events: [], jobs: [] })); fb.toast("History deleted", "success"); } }} />
          <Button testID="privacy-export-data" label="Export my data (backup)" variant="ghost" style={{ marginTop: spacing.sm }} onPress={() => router.push("/backup")} />
        </Card>
        <SectionTitle title="Permissions" />
        <Card style={{ paddingVertical: spacing.xs }}>
          <Row testID="privacy-perm-media" icon="images-outline" title="Photos & videos" subtitle={permission} />
          <Row testID="privacy-perm-camera" icon="camera-outline" title="Camera" subtitle={cam} />
          <Row testID="privacy-open-settings" icon="settings-outline" title="Open system settings" subtitle="Change or revoke permissions" onPress={() => Linking.openSettings()} />
        </Card>
        <Button testID="privacy-shield-button" label="Privacy Export Shield" icon="shield-checkmark-outline" onPress={() => router.push("/privacy-export")} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({ h: { color: c.onSurface, fontWeight: "700", fontSize: 16, marginBottom: spacing.sm } }));

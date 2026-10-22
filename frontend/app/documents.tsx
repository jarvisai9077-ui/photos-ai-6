// Document Studio: capture/import pages, rotate & crop, editable text (manual — no OCR model in this build), PDF via expo-print.
import React, { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useFeedback } from "@/src/components/feedback";
import { Badge, Button, Card, EmptyState, Header, IconButton, Press, Screen, Body } from "@/src/components/ui";
import { Doc, setState, uid, useStore } from "@/src/store";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

async function pageToBase64(uri: string) {
  const r = await manipulateAsync(uri, [{ resize: { width: 1600 } }], { format: SaveFormat.JPEG, compress: 0.85, base64: true });
  return r.base64!;
}

export default function Documents() {
  const { open } = useLocalSearchParams<{ open?: string }>();
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const { colors } = useTheme();
  const fb = useFeedback();
  const docs = useStore((s) => s.documents);
  const [editing, setEditing] = useState<Doc | null>(open ? docs.find((d) => d.id === open) || null : null);
  const [busy, setBusy] = useState(false);

  const addPages = async (source: "camera" | "library") => {
    if (source === "camera") {
      const p = await ImagePicker.getCameraPermissionsAsync();
      if (!p.granted) {
        const r = p.canAskAgain ? await ImagePicker.requestCameraPermissionsAsync() : p;
        if (!r.granted) return fb.toast("Camera permission is needed to scan. Enable it in Settings.", "error");
      }
    }
    const r = source === "camera" ? await ImagePicker.launchCameraAsync({ quality: 0.9 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.9 });
    if (r.canceled) return;
    const pages = r.assets.map((a) => ({ uri: a.uri }));
    setEditing((d) => d ? { ...d, pages: [...d.pages, ...pages] } : { id: uid(), title: `Scan ${new Date().toLocaleDateString()}`, text: "", tags: [], pages, created: Date.now() });
  };
  const rotatePage = async (i: number) => {
    if (!editing) return;
    const r = await manipulateAsync(editing.pages[i].uri, [{ rotate: 90 }], { format: SaveFormat.JPEG, compress: 0.92 });
    setEditing({ ...editing, pages: editing.pages.map((p, j) => (j === i ? { uri: r.uri } : p)) });
  };
  const save = (d: Doc) => {
    setState((s) => ({ documents: [d, ...s.documents.filter((x) => x.id !== d.id)] }));
    fb.toast("Document saved locally", "success");
  };
  const makePdf = async () => {
    if (!editing?.pages.length) return fb.toast("Add at least one page", "info");
    setBusy(true);
    try {
      const imgs = await Promise.all(editing.pages.map((p) => pageToBase64(p.uri)));
      const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
      const html = `<html><body style="margin:0">${imgs.map((b) => `<div style="page-break-after:always;display:flex;align-items:center;justify-content:center;height:100vh"><img src="data:image/jpeg;base64,${b}" style="max-width:100%;max-height:100vh"/></div>`).join("")}${editing.text ? `<div style="font-family:sans-serif;padding:32px;white-space:pre-wrap">${esc(editing.text)}</div>` : ""}</body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      const d = { ...editing, pdfUri: uri };
      setEditing(d);
      save(d);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
      else fb.toast("PDF created", "success");
    } catch (e: any) {
      fb.toast(`PDF failed: ${e?.message || e}`, "error");
    } finally { setBusy(false); }
  };

  if (editing) {
    return (
      <Screen>
        <Header title="Document" subtitle={`${editing.pages.length} page(s)`} right={<IconButton testID="doc-close-editor" name="close" onPress={() => setEditing(null)} />} />
        <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
          <TextInput testID="doc-title-input" value={editing.title} onChangeText={(t) => setEditing({ ...editing, title: t })} style={st.input} placeholder="Title" placeholderTextColor={colors.muted} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {editing.pages.map((p, i) => (
              <View key={i} style={st.page}>
                <Image source={{ uri: p.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                <View style={st.pageActions}>
                  <IconButton testID={`doc-rotate-${i}`} name="refresh" size={18} color="#FFFFFF" onPress={() => rotatePage(i)} />
                  <IconButton testID={`doc-remove-${i}`} name="trash" size={18} color="#FFFFFF" onPress={() => setEditing({ ...editing, pages: editing.pages.filter((_, j) => j !== i) })} />
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button testID="doc-scan-button" label="Scan page" icon="camera-outline" variant="secondary" style={{ flex: 1 }} onPress={() => addPages("camera")} />
            <View style={{ flex: 1 }}><Button testID="doc-import-button" label="Import" icon="images-outline" variant="secondary" onPress={() => addPages("library")} /></View>
          </View>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={st.cardTitle}>Document text</Text>
              <Badge label="OCR: needs native model" kind="warning" />
            </View>
            <Body muted style={{ marginVertical: spacing.sm }}>Automatic text recognition requires an on-device OCR model that is not bundled in this build. Type or paste key text (invoice numbers, totals) so it becomes searchable.</Body>
            <TextInput testID="doc-text-input" value={editing.text} onChangeText={(t) => setEditing({ ...editing, text: t })} multiline style={[st.input, { minHeight: 120, textAlignVertical: "top" }]} placeholder="Searchable text" placeholderTextColor={colors.muted} />
            <TextInput testID="doc-tags-input" value={editing.tags.join(", ")} onChangeText={(t) => setEditing({ ...editing, tags: t.split(",").map((x) => x.trim()).filter(Boolean) })} style={[st.input, { marginTop: spacing.sm }]} placeholder="Tags: receipt, bill, ticket…" placeholderTextColor={colors.muted} autoCapitalize="none" />
          </Card>
          <Button testID="doc-save-button" label="Save document" onPress={() => save(editing)} />
          <Button testID="doc-pdf-button" label="Create PDF" icon="document-outline" variant="secondary" loading={busy} onPress={makePdf} />
          {docs.some((d) => d.id === editing.id) && <Button testID="doc-delete-button" label="Delete document" variant="danger" onPress={async () => { if (await fb.confirm({ title: "Delete document?", destructive: true, confirmLabel: "Delete" })) { setState((s) => ({ documents: s.documents.filter((d) => d.id !== editing.id) })); setEditing(null); } }} />}
        </KeyboardAwareScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Document Studio" subtitle={`${docs.length} documents`} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button testID="docs-new-scan-button" label="New scan" icon="scan-outline" style={{ flex: 1 }} onPress={() => addPages("camera")} />
          <View style={{ flex: 1 }}><Button testID="docs-import-button" label="From photos" icon="images-outline" variant="secondary" onPress={() => addPages("library")} /></View>
        </View>
        {docs.length === 0 && <EmptyState testID="docs-empty" icon="document-text-outline" tint="pastelMint" title="No documents yet" message="Scan receipts, bills, tickets and notes. Combine pages into a PDF — all on this device." />}
        {docs.map((d) => (
          <Press key={d.id} testID={`doc-item-${d.id}`} onPress={() => setEditing(d)} style={st.docRow}>
            <View style={st.docThumb}>{d.pages[0] && <Image source={{ uri: d.pages[0].uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}</View>
            <View style={{ flex: 1 }}>
              <Text style={st.cardTitle}>{d.title}</Text>
              <Body muted numberOfLines={1}>{d.pages.length} page(s){d.tags.length ? ` · ${d.tags.join(", ")}` : ""}{d.pdfUri ? " · PDF" : ""}</Body>
            </View>
          </Press>
        ))}
        <Button testID="docs-back-button" label="Back" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  input: { backgroundColor: c.surfaceSecondary, color: c.onSurface, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 48, fontSize: 15, borderWidth: 1, borderColor: c.border },
  page: { width: 120, height: 160, borderRadius: radius.md, overflow: "hidden", backgroundColor: c.surfaceTertiary },
  pageActions: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", backgroundColor: "rgba(0,0,0,0.45)" },
  cardTitle: { color: c.onSurface, fontWeight: "700", fontSize: 16 },
  docRow: { flexDirection: "row", gap: spacing.md, alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.md },
  docThumb: { width: 52, height: 68, borderRadius: radius.sm, overflow: "hidden", backgroundColor: c.surfaceTertiary },
}));

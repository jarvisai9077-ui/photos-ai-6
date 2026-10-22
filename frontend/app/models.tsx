// On-Device AI Model Manager / Orchestrator. Honest: lists what actually runs, and registers imported model packages
// without pretending they execute (no TFLite/ONNX runtime is bundled in this build).
import React from "react";
import { ScrollView, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeedback } from "@/src/components/feedback";
import { Badge, Button, Card, Header, Screen, SectionTitle, Body } from "@/src/components/ui";
import { formatBytes } from "@/src/media/files";
import { storage } from "@/src/utils/storage";
import { makeStyles, spacing } from "@/src/theme";

const ENGINES = [
  { name: "Natural-language query parser", task: "Search, Action Agent, workflows", kind: "Rule-based (on-device)", ok: true },
  { name: "Temporal event & burst grouping", task: "Memories, Burst intelligence", kind: "Heuristic (on-device)", ok: true },
  { name: "Metadata duplicate detector", task: "Duplicate review, Storage Guardian", kind: "Heuristic (on-device)", ok: true },
  { name: "SHA-256 integrity hashing", task: "Inspector, backups, drill", kind: "Native crypto", ok: true },
  { name: "Colour matrix engine", task: "Editor adjustments & filters", kind: "Skia GPU (Android) / Canvas (web)", ok: true },
  { name: "OCR text recognition", task: "Documents, screenshot search", kind: "Needs ML Kit / Tesseract model", ok: false },
  { name: "Image classification & scene tags", task: "Visual search", kind: "Needs TFLite/ONNX model", ok: false },
  { name: "Face / pet grouping", task: "People & pets", kind: "Needs detection + embedding model", ok: false },
  { name: "Background removal, upscaling, restoration", task: "AI photo editing", kind: "Needs segmentation/SR models", ok: false },
  { name: "Speech-to-text", task: "Subtitles", kind: "Needs Whisper-class on-device model", ok: false },
  { name: "AR face mesh", task: "AR lenses", kind: "Needs native face-tracking module", ok: false },
];
type Reg = { name: string; size: number | null; added: number };

export default function Models() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const fb = useFeedback();
  const [reg, setReg] = React.useState<Reg[]>([]);
  React.useEffect(() => { storage.getItem<string>("rf_model_registry", "[]").then((v) => setReg(JSON.parse(v || "[]"))); }, []);
  const save = (r: Reg[]) => { setReg(r); storage.setItem("rf_model_registry", JSON.stringify(r)); };
  const importModel = async () => {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false });
    if (r.canceled) return;
    const a = r.assets[0];
    if (!/\.(tflite|onnx|ort|bin)$/i.test(a.name)) return fb.toast("Unsupported package. Expected .tflite / .onnx / .ort", "error");
    save([{ name: a.name, size: a.size ?? null, added: Date.now() }, ...reg]);
    fb.toast("Registered. It cannot run until a native inference runtime is added.", "info");
  };

  return (
    <Screen>
      <Header title="On-Device AI" subtitle="Model manager · no cloud processing" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
        <Card testID="models-summary">
          <Text style={st.h}>0 neural models installed</Text>
          <Body muted>RF Photos never downloads models silently. Everything below marked “Active” runs locally right now. Capabilities that need a neural model are clearly unavailable rather than simulated.</Body>
        </Card>
        <SectionTitle title="Engines" />
        {ENGINES.map((e, i) => (
          <Card key={e.name} testID={`engine-${i}`}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Badge label={e.ok ? "Active" : "Unavailable"} kind={e.ok ? "success" : "warning"} />
              <Text style={st.t}>{e.name}</Text>
            </View>
            <Body muted>{e.task} · {e.kind}</Body>
          </Card>
        ))}
        <SectionTitle title="Imported model packages" />
        {reg.length === 0 && <Body muted>None. You can register a local model file for future use.</Body>}
        {reg.map((m, i) => (
          <Card key={m.added} testID={`model-${i}`}>
            <Text style={st.t}>{m.name}</Text>
            <Body muted>{formatBytes(m.size)} · registered {new Date(m.added).toLocaleDateString()} · runtime unavailable</Body>
            <Button testID={`model-remove-${i}`} label="Remove" variant="ghost" onPress={() => save(reg.filter((x) => x !== m))} style={{ marginTop: spacing.sm, minHeight: 40 }} />
          </Card>
        ))}
        <Button testID="models-import-button" label="Import model package…" icon="cloud-offline-outline" variant="secondary" onPress={importModel} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({ h: { color: c.onSurface, fontWeight: "800", fontSize: 18, marginBottom: spacing.xs }, t: { color: c.onSurface, fontWeight: "700", flex: 1 } }));

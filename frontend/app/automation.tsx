// Batch Creative Pipeline + Workflow Designer + Storage Impact Simulator (all local).
import React, { useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { manipulateAsync, FlipType, SaveFormat, Action } from "expo-image-manipulator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useFeedback } from "@/src/components/feedback";
import { getBatch } from "@/src/components/SelectionBar";
import { Badge, Button, Card, Chip, ChipRow, Header, IconButton, Progress, Screen, Body } from "@/src/components/ui";
import { fileSize, formatBytes, localUriFor } from "@/src/media/files";
import { saveToLibrary } from "@/src/media/library";
import { pickMedia } from "@/src/media/picker";
import { logEvent, MediaItem, setState, startJob, uid, updateJob, useStore, WorkflowStep } from "@/src/store";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

function parseWorkflow(t: string): WorkflowStep[] {
  const s = t.toLowerCase();
  const steps: WorkflowStep[] = [];
  const r = s.match(/resize(?: to)? (\d{2,5})/); if (r) steps.push({ op: "resize", value: r[1] });
  const ro = s.match(/rotate(?: by)? (90|180|270)/); if (ro) steps.push({ op: "rotate", value: ro[1] });
  if (/flip/.test(s)) steps.push({ op: "flip", value: /vertical/.test(s) ? "v" : "h" });
  const f = s.match(/(?:convert|save|export)(?: to| as)? (png|jpe?g|webp)/); if (f) steps.push({ op: "format", value: f[1].replace("jpeg", "jpg") });
  return steps;
}

export default function Automation() {
  const { preset } = useLocalSearchParams<{ preset?: string }>();
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const { colors } = useTheme();
  const fb = useFeedback();
  const workflows = useStore((s) => s.workflows);
  const [items, setItems] = useState<MediaItem[]>(getBatch().filter((b) => b.mediaType === "photo"));
  const [steps, setSteps] = useState<WorkflowStep[]>(preset?.startsWith("resize:") ? [{ op: "resize", value: preset.split(":")[1] }] : [{ op: "format", value: "jpg" }]);
  const [quality, setQuality] = useState(0.8);
  const [nl, setNl] = useState("");
  const [dry, setDry] = useState<{ name: string; src: number | null; est: number; w: number; h: number }[] | null>(null);
  const [results, setResults] = useState<{ name: string; ok: boolean; detail: string }[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const cancel = useRef(false);

  const fmt = steps.find((s) => s.op === "format")?.value || "jpg";
  const outDims = (m: MediaItem) => {
    let w = m.width, h = m.height;
    const rot = steps.find((s) => s.op === "rotate");
    if (rot && Number(rot.value) % 180) [w, h] = [h, w];
    const rs = steps.find((s) => s.op === "resize");
    if (rs && w) { const nw = Number(rs.value); h = Math.round((h * nw) / w); w = nw; }
    return { w, h };
  };
  const actionsFor = (): Action[] => steps.flatMap((s): Action[] => s.op === "resize" ? [{ resize: { width: Number(s.value) } }] : s.op === "rotate" ? [{ rotate: Number(s.value) }] : s.op === "flip" ? [{ flip: s.value === "v" ? FlipType.Vertical : FlipType.Horizontal }] : []);

  const runDry = async () => {
    const out = [];
    for (const m of items) {
      const { w, h } = outDims(m);
      const bpp = fmt === "png" ? 1.6 : fmt === "webp" ? 0.18 * quality + 0.05 : 0.25 * quality + 0.05;
      out.push({ name: m.filename, src: await fileSize(await localUriFor(m.id, m.uri)), est: Math.round(w * h * bpp), w, h });
    }
    setDry(out);
  };
  const execute = async () => {
    if (!items.length) return fb.toast("Select photos first", "info");
    if (!(await fb.confirm({ title: `Process ${items.length} photo(s)?`, message: `Steps: ${steps.map((s) => `${s.op} ${s.value}`).join(" → ")}. New copies are saved to the “RF Photos” album; originals are preserved. Re-encoding drops EXIF metadata (including location).`, confirmLabel: "Run pipeline" }))) return;
    cancel.current = false;
    setRunning(true); setResults([]); setProgress(0);
    const job = startJob(`Batch pipeline (${items.length})`, items.length);
    let ok = 0, failed = 0;
    const errors: string[] = [];
    const res: { name: string; ok: boolean; detail: string }[] = [];
    for (let i = 0; i < items.length; i++) {
      if (cancel.current) { updateJob(job, { status: "cancelled", ok, failed, ended: Date.now(), errors }); res.push({ name: "—", ok: false, detail: `Cancelled; ${items.length - i} not processed` }); break; }
      const m = items[i];
      try {
        const r = await manipulateAsync(await localUriFor(m.id, m.uri), actionsFor(), { format: fmt === "png" ? SaveFormat.PNG : fmt === "webp" ? SaveFormat.WEBP : SaveFormat.JPEG, compress: quality });
        const size = await fileSize(r.uri);
        const saved = await saveToLibrary(r.uri, m.filename.replace(/\.\w+$/, "") + `_rf.${fmt}`, "photo", r.width, r.height);
        logEvent(m.id, "export", `Batch copy ${r.width}×${r.height} ${fmt}`);
        setState((s) => ({ versions: [{ id: uid(), sourceId: m.id, sourceName: m.filename, outputId: saved.id, outputUri: saved.uri, ops: steps.map((x) => `${x.op} ${x.value}`), time: Date.now() }, ...s.versions] }));
        res.push({ name: m.filename, ok: true, detail: `${r.width}×${r.height} · ${formatBytes(size)} (verified output)` });
        ok++;
      } catch (e: any) {
        failed++; errors.push(`${m.filename}: ${e?.message || e}`);
        res.push({ name: m.filename, ok: false, detail: String(e?.message || e) });
      }
      setResults([...res]); setProgress((i + 1) / items.length);
      updateJob(job, { ok, failed });
    }
    if (!cancel.current) updateJob(job, { status: failed && !ok ? "failed" : "done", ok, failed, ended: Date.now(), errors });
    setRunning(false);
    fb.toast(`${ok} done${failed ? `, ${failed} failed` : ""}`, failed ? "error" : "success");
  };

  const setStep = (op: WorkflowStep["op"], value: string | null) => setSteps((s) => (value === null ? s.filter((x) => x.op !== op) : [...s.filter((x) => x.op !== op), { op, value }]));
  const has = (op: string, v?: string) => steps.some((s) => s.op === op && (v === undefined || s.value === v));

  return (
    <Screen>
      <Header title="Batch Pipeline" subtitle={`${items.length} photo(s) selected`} />
      <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}>
        <Button testID="automation-pick-button" label={items.length ? "Change selection" : "Select photos"} icon="images-outline" variant="secondary" onPress={async () => { const r = await pickMedia({ type: "photo", max: 200, title: "Photos to process" }); if (r.length) { setItems(r); setDry(null); } }} />
        <Card>
          <Text style={st.h}>Describe a workflow</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center", marginTop: spacing.sm }}>
            <TextInput testID="automation-nl-input" value={nl} onChangeText={setNl} placeholder="resize to 1080 and convert to png" placeholderTextColor={colors.muted} style={st.input} />
            <IconButton testID="automation-nl-apply" name="sparkles" color={colors.brandPrimary} onPress={() => { const p = parseWorkflow(nl); if (p.length) { setSteps(p); setDry(null); fb.toast(`${p.length} step(s) created — review below`, "success"); } else fb.toast("No supported steps found (resize, rotate, flip, convert)", "error"); }} />
          </View>
        </Card>
        <Card>
          <Text style={st.h}>Steps</Text>
          <Body muted>Resize width</Body>
          <ChipRow>{["", "720", "1080", "1600", "2048", "3000"].map((v) => <Chip key={v || "none"} testID={`step-resize-${v || "none"}`} label={v ? `${v}px` : "Keep"} active={v ? has("resize", v) : !has("resize")} onPress={() => setStep("resize", v || null)} />)}</ChipRow>
          <Body muted>Rotate / flip</Body>
          <ChipRow>
            {["", "90", "180", "270"].map((v) => <Chip key={v || "r0"} testID={`step-rotate-${v || "none"}`} label={v ? `${v}°` : "No rotation"} active={v ? has("rotate", v) : !has("rotate")} onPress={() => setStep("rotate", v || null)} />)}
            <Chip testID="step-flip" label="Flip H" active={has("flip")} onPress={() => setStep("flip", has("flip") ? null : "h")} />
          </ChipRow>
          <Body muted>Format & quality</Body>
          <ChipRow>
            {["jpg", "png", "webp"].map((v) => <Chip key={v} testID={`step-format-${v}`} label={v.toUpperCase()} active={fmt === v} onPress={() => setStep("format", v)} />)}
            {[0.6, 0.8, 0.95].map((q) => <Chip key={q} testID={`step-quality-${q}`} label={`Q ${Math.round(q * 100)}`} active={quality === q} onPress={() => setQuality(q)} />)}
          </ChipRow>
          <Body muted>Pipeline: {steps.map((s) => `${s.op} ${s.value}`).join(" → ") || "re-encode only"} → strip EXIF → save copy</Body>
        </Card>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Button testID="automation-save-workflow" label="Save workflow" variant="ghost" style={{ flex: 1 }} onPress={async () => { const name = await fb.prompt({ title: "Workflow name", placeholder: "e.g. Web export" }); if (name) setState((s) => ({ workflows: [{ id: uid(), name, steps, created: Date.now() }, ...s.workflows] })); }} />
          <View style={{ flex: 1 }}><Button testID="automation-dry-run" label="Dry run" icon="eye-outline" variant="secondary" onPress={runDry} disabled={!items.length} /></View>
        </View>
        {workflows.length > 0 && <ChipRow>{workflows.map((w) => <Chip key={w.id} testID={`workflow-${w.id}`} label={w.name} onPress={() => { setSteps(w.steps); setDry(null); }} />)}</ChipRow>}
        {dry && (
          <Card testID="automation-dry-results">
            <Text style={st.h}>Storage impact (estimate)</Text>
            <Body muted>Estimates use typical bytes-per-pixel for the target format; real sizes depend on content and are measured after processing.</Body>
            <Text style={st.total}>{formatBytes(dry.reduce((a, d) => a + (d.src || 0), 0))} → ~{formatBytes(dry.reduce((a, d) => a + d.est, 0))}</Text>
            {dry.slice(0, 30).map((d, i) => <Body key={i} muted numberOfLines={1}>{d.name}: {formatBytes(d.src)} → ~{formatBytes(d.est)} ({d.w}×{d.h})</Body>)}
          </Card>
        )}
        {running && <Progress value={progress} />}
        {running ? <Button testID="automation-cancel" label="Cancel" variant="danger" onPress={() => (cancel.current = true)} /> : <Button testID="automation-run" label="Run pipeline" icon="play" onPress={execute} disabled={!items.length} />}
        {results.map((r, i) => (
          <View key={i} style={st.res} testID={`automation-result-${i}`}>
            <Badge label={r.ok ? "OK" : "FAIL"} kind={r.ok ? "success" : "error"} />
            <Body numberOfLines={2} style={{ flex: 1 }}>{r.name} — {r.detail}</Body>
          </View>
        ))}
        <Body muted>Watermark and colour grading steps run in the Creation Studio and Editor respectively; they are not yet part of batch processing.</Body>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  h: { color: c.onSurface, fontWeight: "700", fontSize: 16, marginBottom: spacing.xs },
  input: { flex: 1, minHeight: 46, borderRadius: radius.md, backgroundColor: c.surfaceTertiary, color: c.onSurface, paddingHorizontal: spacing.md, fontSize: 15 },
  total: { color: c.brandPrimary, fontWeight: "800", fontSize: 20, marginVertical: spacing.sm },
  res: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
}));

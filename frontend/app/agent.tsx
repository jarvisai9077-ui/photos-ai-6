import React, { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useFeedback } from "@/src/components/feedback";
import { openViewer } from "@/src/components/MediaGrid";
import { Badge, Button, Card, Chip, Header, IconButton, Press, Screen, Body } from "@/src/components/ui";
import { plan, Plan, TOOLS } from "@/src/media/agent";
import { setState, uid, useStore } from "@/src/store";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const undoMap = new Map<string, () => void>();

export default function Agent() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const { colors } = useTheme();
  const fb = useFeedback();
  const history = useStore((s) => s.agentHistory);
  const [cmd, setCmd] = useState("");
  const [p, setP] = useState<Plan | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const preview = (text = cmd) => {
    const r = plan(text);
    if ("error" in r) { setErr(r.error); setP(null); } else { setErr(""); setP(r); }
  };
  const record = (status: "done" | "failed" | "cancelled", summary: string, tool: string, affected: number) => {
    const id = uid();
    setState((s) => ({ agentHistory: [{ id, command: cmd, tool, summary, status, time: Date.now(), affected }, ...s.agentHistory].slice(0, 100) }));
    return id;
  };
  const execute = async () => {
    if (!p) return;
    if (p.needsConfirm && !(await fb.confirm({ title: p.title, message: `This affects ${p.affected.length} item(s). Originals are never modified.`, confirmLabel: "Run" }))) { record("cancelled", "Cancelled by user", p.tool, 0); return; }
    setBusy(true);
    try {
      const r = await p.run();
      const id = record("done", r.summary, p.tool, p.affected.length);
      if (r.undo) undoMap.set(id, r.undo);
      fb.toast(r.summary, "success");
      if (p.tool !== "find") setP(null);
    } catch (e: any) {
      record("failed", String(e?.message || e), p.tool, 0);
      fb.toast(`Failed: ${e?.message || e}`, "error");
    } finally { setBusy(false); }
  };

  return (
    <Screen>
      <Header title="RF Action Agent" subtitle="Local typed tools · confirmation before changes" />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
          <Body muted>The agent understands fixed command patterns and maps them to validated tools. It has no internet, shell or raw database access.</Body>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {TOOLS.map((t) => <Chip key={t.name} testID={`agent-example-${t.name}`} label={t.example} onPress={() => { setCmd(t.example); preview(t.example); }} />)}
          </ScrollView>
          {!!err && <Card testID="agent-error"><Text style={{ color: colors.error }}>{err}</Text></Card>}
          {p && (
            <Card testID="agent-plan-card">
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Badge label={p.tool} kind="brand" />
                <Text style={st.planTitle}>{p.title}</Text>
              </View>
              <Body muted style={{ marginTop: spacing.sm }}>Parameters: {Object.entries(p.params).map(([k, v]) => `${k}=“${v}”`).join(", ") || "none"}</Body>
              <Text testID="agent-affected-count" style={st.affected}>{p.affected.length} item(s) affected</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                {p.affected.slice(0, 20).map((m, i) => (
                  <Press key={m.id} testID={`agent-preview-${i}`} onPress={() => openViewer(p.affected, i)} style={st.thumb}><Image source={{ uri: m.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" /></Press>
                ))}
              </ScrollView>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                <Button testID="agent-cancel-button" label="Cancel" variant="ghost" style={{ flex: 1 }} onPress={() => { record("cancelled", "Cancelled at preview", p.tool, 0); setP(null); }} />
                <View style={{ flex: 1 }}><Button testID="agent-run-button" label={p.tool === "find" ? "Done" : "Run"} loading={busy} onPress={execute} /></View>
              </View>
            </Card>
          )}
          <Text style={st.planTitle}>History</Text>
          {history.length === 0 && <Body muted>No actions yet.</Body>}
          {history.map((h) => (
            <View key={h.id} style={st.hist} testID={`agent-history-${h.id}`}>
              <Badge label={h.status} kind={h.status === "done" ? "success" : h.status === "failed" ? "error" : "info"} />
              <View style={{ flex: 1 }}>
                <Text style={st.histCmd} numberOfLines={1}>{h.command || h.tool}</Text>
                <Body muted>{h.summary} · {new Date(h.time).toLocaleTimeString()}</Body>
              </View>
              {undoMap.has(h.id) && <Button testID={`agent-undo-${h.id}`} label="Undo" variant="secondary" style={{ minHeight: 36 }} onPress={() => { undoMap.get(h.id)!(); undoMap.delete(h.id); setState((s) => ({ agentHistory: s.agentHistory.map((x) => (x.id === h.id ? { ...x, summary: x.summary + " (undone)" } : x)) })); fb.toast("Undone", "success"); }} />}
            </View>
          ))}
        </ScrollView>
        <View style={[st.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <TextInput testID="agent-command-input" value={cmd} onChangeText={setCmd} onSubmitEditing={() => preview()} placeholder="e.g. tag photos last week as trip" placeholderTextColor={colors.muted} style={st.input} returnKeyType="go" />
          <IconButton testID="agent-preview-button" name="arrow-up-circle" size={34} color={colors.brandPrimary} onPress={() => preview()} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  planTitle: { color: c.onSurface, fontWeight: "700", fontSize: 16, flex: 1 },
  affected: { color: c.brandPrimary, fontWeight: "700", marginVertical: spacing.sm },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, overflow: "hidden", backgroundColor: c.surfaceTertiary },
  hist: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  histCmd: { color: c.onSurface, fontWeight: "600" },
  inputBar: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, backgroundColor: c.surfaceSecondary, borderTopWidth: 0.5, borderTopColor: c.border },
  input: { flex: 1, minHeight: 46, borderRadius: radius.pill, backgroundColor: c.surfaceTertiary, color: c.onSurface, paddingHorizontal: spacing.lg, fontSize: 15 },
}));

// App-level toasts, confirm sheets and text prompts (no native Alert).
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";
import { Button, Ionicons } from "./ui";

type ConfirmOpts = { title: string; message?: string; confirmLabel?: string; destructive?: boolean };
type PromptOpts = { title: string; message?: string; placeholder?: string; initial?: string; confirmLabel?: string; multiline?: boolean };
type ToastKind = "success" | "error" | "info";
type Ctx = { toast: (msg: string, kind?: ToastKind) => void; confirm: (o: ConfirmOpts) => Promise<boolean>; prompt: (o: PromptOpts) => Promise<string | null> };

const FeedbackCtx = createContext<Ctx>({ toast: () => {}, confirm: async () => false, prompt: async () => null });
export const useFeedback = () => useContext(FeedbackCtx);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toastState, setToast] = useState<{ msg: string; kind: ToastKind; id: number } | null>(null);
  const [dialog, setDialog] = useState<{ type: "confirm" | "prompt"; opts: ConfirmOpts & PromptOpts } | null>(null);
  const [text, setText] = useState("");
  const resolver = useRef<(v: any) => void>(() => {});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const { colors } = useTheme();

  const toast = useCallback((msg: string, kind: ToastKind = "info") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ msg, kind, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((res) => {
    resolver.current = res;
    setDialog({ type: "confirm", opts });
  }), []);
  const prompt = useCallback((opts: PromptOpts) => new Promise<string | null>((res) => {
    resolver.current = res;
    setText(opts.initial || "");
    setDialog({ type: "prompt", opts });
  }), []);
  const close = (v: any) => {
    setDialog(null);
    resolver.current(v);
  };

  const icon = toastState?.kind === "success" ? "checkmark-circle" : toastState?.kind === "error" ? "alert-circle" : "information-circle";
  const iconColor = toastState?.kind === "success" ? colors.success : toastState?.kind === "error" ? colors.error : colors.brandPrimary;

  return (
    <FeedbackCtx.Provider value={{ toast, confirm, prompt }}>
      {children}
      {toastState && (
        <Animated.View key={toastState.id} entering={FadeInDown} exiting={FadeOutDown} pointerEvents="none" style={[st.toastWrap, { bottom: insets.bottom + 90 }]}>
          <View testID="toast-message" style={st.toast}>
            <Ionicons name={icon} size={20} color={iconColor} />
            <Text style={st.toastText}>{toastState.msg}</Text>
          </View>
        </Animated.View>
      )}
      <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => close(dialog?.type === "confirm" ? false : null)}>
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <Pressable style={st.scrim} onPress={() => close(dialog?.type === "confirm" ? false : null)} />
          <View style={[st.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="dialog-sheet">
            <View style={st.handle} />
            <Text style={st.title}>{dialog?.opts.title}</Text>
            {!!dialog?.opts.message && <Text style={st.msg}>{dialog.opts.message}</Text>}
            {dialog?.type === "prompt" && (
              <TextInput
                testID="dialog-input"
                autoFocus
                value={text}
                onChangeText={setText}
                placeholder={dialog.opts.placeholder}
                placeholderTextColor={colors.muted}
                multiline={dialog.opts.multiline}
                style={[st.input, dialog.opts.multiline && { minHeight: 100, textAlignVertical: "top" }]}
                onSubmitEditing={() => !dialog.opts.multiline && close(text.trim() || null)}
              />
            )}
            <View style={st.actions}>
              <Button testID="dialog-cancel-button" label="Cancel" variant="ghost" style={{ flex: 1 }} onPress={() => close(dialog?.type === "confirm" ? false : null)} />
              <View style={{ flex: 1 }}>
                <Button testID="dialog-confirm-button" label={dialog?.opts.confirmLabel || (dialog?.type === "prompt" ? "Save" : "Confirm")} variant={dialog?.opts.destructive ? "danger" : "primary"} onPress={() => close(dialog?.type === "confirm" ? true : text.trim() || null)} />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </FeedbackCtx.Provider>
  );
}

const useStyles = makeStyles((c) => ({
  toastWrap: { position: "absolute", left: spacing.lg, right: spacing.lg, alignItems: "center" },
  toast: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceInverse, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.lg, maxWidth: 480 },
  toastText: { color: c.onSurfaceInverse, fontSize: 14, fontWeight: "500", flexShrink: 1 },
  scrim: { flex: 1, backgroundColor: c.scrim },
  sheet: { backgroundColor: c.surfaceSecondary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingTop: spacing.md },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: c.borderStrong, alignSelf: "center", marginBottom: spacing.lg },
  title: { color: c.onSurface, fontSize: 20, fontWeight: "700" },
  msg: { color: c.muted, fontSize: 15, marginTop: spacing.sm, lineHeight: 21 },
  input: { marginTop: spacing.lg, backgroundColor: c.surfaceTertiary, color: c.onSurface, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 16, minHeight: 48 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
}));

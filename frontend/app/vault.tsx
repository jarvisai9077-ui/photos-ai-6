import React, { useEffect, useState } from "react";
import { FlatList, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFeedback } from "@/src/components/feedback";
import { Badge, Button, EmptyState, Header, IconButton, Ionicons, Press, Screen, Body } from "@/src/components/ui";
import { pickMedia } from "@/src/media/picker";
import { biometricStatus, biometricUnlock, deleteOriginals, hasPin, isUnlocked, lockVault, moveToVault, removeFromVault, restoreFromVault, setPin, verifyPin } from "@/src/media/vault";
import { useStore, VaultItem } from "@/src/store";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

function PinPad({ title, sub, onDone, testID }: { title: string; sub: string; onDone: (pin: string) => void; testID: string }) {
  const st = useStyles();
  const { colors } = useTheme();
  const [pin, setPinV] = useState("");
  const press = (d: string) => {
    const n = (pin + d).slice(0, 6);
    setPinV(n);
    if (n.length === 6) { onDone(n); setTimeout(() => setPinV(""), 200); }
  };
  return (
    <View style={st.pinWrap} testID={testID}>
      <Ionicons name="lock-closed" size={40} color={colors.brandPrimary} />
      <Text style={st.pinTitle}>{title}</Text>
      <Text style={st.pinSub}>{sub}</Text>
      <View style={st.dots}>{Array.from({ length: 6 }).map((_, i) => <View key={i} style={[st.dot, i < pin.length && { backgroundColor: colors.brandPrimary }]} />)}</View>
      <View style={st.pad}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((k) => k === "" ? <View key="e" style={st.key} /> : (
          <Press key={k} testID={`pin-key-${k === "⌫" ? "back" : k}`} onPress={() => (k === "⌫" ? setPinV(pin.slice(0, -1)) : press(k))} style={st.key}>
            <Text style={st.keyText}>{k}</Text>
          </Press>
        ))}
      </View>
    </View>
  );
}

export default function Vault() {
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const fb = useFeedback();
  const { width } = useWindowDimensions();
  const items = useStore((s) => s.vault);
  const [phase, setPhase] = useState<"loading" | "setup" | "confirm" | "locked" | "open">("loading");
  const [first, setFirst] = useState("");
  const [bio, setBio] = useState<{ available: boolean; reason: string }>({ available: false, reason: "" });
  const [fails, setFails] = useState(0);

  useEffect(() => {
    hasPin().then((h) => setPhase(h ? (isUnlocked() ? "open" : "locked") : "setup"));
    biometricStatus().then(setBio);
  }, []);

  const tryBio = async () => { if (await biometricUnlock()) setPhase("open"); else fb.toast("Biometric check failed or cancelled", "error"); };
  const add = async () => {
    const r = await pickMedia({ max: 30, title: "Add to Vault" });
    if (!r.length) return;
    const res = await moveToVault(r);
    fb.toast(`${res.ok} added${res.failed ? `, ${res.failed} failed` : ""}`, res.failed ? "error" : "success");
    const vaultNow = (await import("@/src/store")).getState().vault.filter((v) => r.some((x) => x.id === v.originalId));
    if (res.ok && vaultNow.some((v) => v.originalId && !v.originalId.startsWith("imp_"))) {
      if (await fb.confirm({ title: "Delete originals from gallery?", message: "The Vault now holds private copies. Deleting originals removes them from the public gallery. Android will ask for confirmation.", confirmLabel: "Delete originals", destructive: true })) {
        try { await deleteOriginals(vaultNow); } catch (e: any) { fb.toast(e?.message || "Could not delete originals", "error"); }
      }
    }
  };
  const itemMenu = async (v: VaultItem) => {
    if (await fb.confirm({ title: v.filename, message: "Restore to the gallery? The private copy is removed after restoring.", confirmLabel: "Restore" })) {
      try { await restoreFromVault(v); fb.toast("Restored to gallery", "success"); } catch (e: any) { fb.toast(e?.message || "Restore failed", "error"); }
    } else if (await fb.confirm({ title: "Delete private copy?", message: "This permanently removes the Vault copy from RF Photos storage.", destructive: true, confirmLabel: "Delete" })) {
      await removeFromVault(v);
    }
  };

  if (phase === "loading") return <Screen><Header title="Vault" /></Screen>;
  if (phase === "setup") return <Screen><Header title="Set up Vault" /><PinPad testID="vault-setup-pad" title="Create a 6-digit PIN" sub="Protects your private media on this device" onDone={(p) => { setFirst(p); setPhase("confirm"); }} /></Screen>;
  if (phase === "confirm") return <Screen><Header title="Set up Vault" /><PinPad testID="vault-confirm-pad" title="Confirm PIN" sub="Enter the same PIN again" onDone={async (p) => { if (p === first) { await setPin(p); setPhase("open"); fb.toast("Vault ready", "success"); } else { fb.toast("PINs didn't match — try again", "error"); setPhase("setup"); } }} /></Screen>;
  if (phase === "locked") {
    return (
      <Screen>
        <Header title="Vault" />
        <PinPad testID="vault-unlock-pad" title="Enter PIN" sub={fails ? `${fails} failed attempt(s)` : "Unlock your private media"} onDone={async (p) => { if (await verifyPin(p)) setPhase("open"); else { setFails(fails + 1); fb.toast("Wrong PIN", "error"); } }} />
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.lg }}>
          {bio.available ? <Button testID="vault-biometric-button" label="Use biometrics" icon="finger-print" variant="secondary" onPress={tryBio} /> : <Body muted style={{ textAlign: "center" }}>{bio.reason}</Body>}
        </View>
      </Screen>
    );
  }

  const size = (Math.min(width, 900) - spacing.lg * 2 - 8) / 3;
  return (
    <Screen style={{ backgroundColor: st.privateBg.backgroundColor }}>
      <Header title="Private Vault" subtitle={`${items.length} protected items`} right={<IconButton testID="vault-lock-button" name="lock-closed-outline" label="Lock" onPress={() => { lockVault(); setPhase("locked"); }} />} />
      <FlatList
        data={items}
        numColumns={3}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: spacing.lg, gap: 4, paddingBottom: insets.bottom + 100 }}
        columnWrapperStyle={{ gap: 4 }}
        ListHeaderComponent={
          <View style={st.notice}>
            <Badge label="Isolation: app-private storage" kind="success" />
            <Body muted style={{ marginTop: spacing.sm }}>Vault items are copied into the RF Photos sandboxed storage, hidden from the gallery, search and exports. They are not encrypted at rest in this build — encryption needs a native crypto module (deferred). Uninstalling the app deletes Vault contents unless you restore them first.</Body>
          </View>
        }
        ListEmptyComponent={<EmptyState testID="vault-empty" icon="lock-closed-outline" tint="pastelLavender" title="Your private photos go here" message="Add photos or videos to keep them out of the main gallery." />}
        renderItem={({ item, index }) => (
          <Press testID={`vault-item-${index}`} onPress={() => itemMenu(item)} style={{ width: size, height: size, borderRadius: radius.sm, overflow: "hidden", backgroundColor: st.privateBg.backgroundColor }}>
            <Image source={{ uri: item.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            {item.mediaType === "video" && <Ionicons name="play" size={14} color="#FFFFFF" style={{ position: "absolute", right: 4, bottom: 4 }} />}
          </Press>
        )}
      />
      <View style={[st.fab, { bottom: insets.bottom + spacing.lg }]}>
        <Button testID="vault-add-button" label="Add to Vault" icon="add" onPress={add} />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  privateBg: { backgroundColor: c.surfaceTertiary },
  pinWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  pinTitle: { color: c.onSurface, fontSize: 22, fontWeight: "800", marginTop: spacing.lg },
  pinSub: { color: c.muted, fontSize: 14, marginTop: spacing.xs },
  dots: { flexDirection: "row", gap: spacing.md, marginVertical: spacing.xl },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: c.brandPrimary },
  pad: { flexDirection: "row", flexWrap: "wrap", width: 264, justifyContent: "center", gap: 12 },
  key: { width: 76, height: 64, borderRadius: radius.lg, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceSecondary },
  keyText: { color: c.onSurface, fontSize: 26, fontWeight: "600" },
  notice: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  fab: { position: "absolute", right: spacing.lg, left: spacing.lg },
}));

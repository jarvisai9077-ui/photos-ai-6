// RF Private Vault: PIN (salted SHA-256 in secure storage) + biometrics, media copied into app-private storage.
// NOTE: Files are isolated in the app sandbox but NOT encrypted at rest in this build (no AES library in Expo Go).
import * as LocalAuth from "expo-local-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { storage } from "@/src/utils/storage";
import { getState, logEvent, MediaItem, setState, uid, VaultItem } from "@/src/store";
import { ensureDir, FS, isWeb, localUriFor } from "./files";
import { deleteMedia, saveToLibrary } from "./library";

const PIN_KEY = "rf_vault_pin";
export const VAULT_DIR = isWeb ? "" : FS.documentDirectory + "vault/";

let unlockedAt = 0;
export const isUnlocked = () => {
  const t = getState().prefs.vaultTimeoutMin * 60000;
  return unlockedAt > 0 && Date.now() - unlockedAt < t;
};
export const lockVault = () => (unlockedAt = 0);
export const touchVault = () => unlockedAt > 0 && (unlockedAt = Date.now());

export async function hasPin() {
  return !!(await storage.secureGet<string | null>(PIN_KEY, null));
}
async function hashPin(pin: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + ":" + pin);
}
export async function setPin(pin: string) {
  const salt = Crypto.randomUUID();
  await storage.secureSet(PIN_KEY, JSON.stringify({ salt, hash: await hashPin(pin, salt) }));
  unlockedAt = Date.now();
}
export async function verifyPin(pin: string) {
  const raw = await storage.secureGet<string | null>(PIN_KEY, null);
  if (!raw) return false;
  const { salt, hash } = JSON.parse(raw);
  const ok = (await hashPin(pin, salt)) === hash;
  if (ok) unlockedAt = Date.now();
  return ok;
}
export async function biometricStatus() {
  if (Platform.OS === "web") return { available: false, reason: "Biometrics are not available in the web preview" };
  const hw = await LocalAuth.hasHardwareAsync();
  if (!hw) return { available: false, reason: "No biometric hardware" };
  const enrolled = await LocalAuth.isEnrolledAsync();
  return enrolled ? { available: true, reason: "" } : { available: false, reason: "No fingerprint/face enrolled on this device" };
}
export async function biometricUnlock() {
  const r = await LocalAuth.authenticateAsync({ promptMessage: "Unlock RF Vault", fallbackLabel: "Use PIN" });
  if (r.success) unlockedAt = Date.now();
  return r.success;
}

export async function moveToVault(items: MediaItem[]) {
  let ok = 0;
  let failed = 0;
  await ensureDir(VAULT_DIR);
  const added: VaultItem[] = [];
  for (const it of items) {
    try {
      let uri = it.uri;
      if (!isWeb) {
        const src = await localUriFor(it.id, it.uri);
        const ext = (it.filename.split(".").pop() || "jpg").toLowerCase();
        uri = `${VAULT_DIR}${uid()}.${ext}`;
        await FS.copyAsync({ from: src, to: uri });
      }
      added.push({ id: uid(), uri, filename: it.filename, mediaType: it.mediaType, added: Date.now(), originalId: it.id });
      logEvent(it.id, "vault", "Copied into Vault");
      ok++;
    } catch {
      failed++;
    }
  }
  setState((s) => ({ vault: [...added, ...s.vault], imported: s.imported.filter((m) => !added.some((a) => a.originalId === m.id)) }));
  return { ok, failed };
}

export async function deleteOriginals(items: VaultItem[]) {
  const devIds = items.map((v) => v.originalId).filter((x): x is string => !!x && !x.startsWith("imp_"));
  if (!devIds.length) return true;
  const fake = devIds.map((id) => ({ id, source: "device" }) as MediaItem);
  return deleteMedia(fake);
}

export async function restoreFromVault(v: VaultItem) {
  const item = await saveToLibrary(v.uri, v.filename, v.mediaType);
  logEvent(item.id, "restore", "Restored from Vault");
  if (!isWeb) await FS.deleteAsync(v.uri, { idempotent: true });
  setState((s) => ({ vault: s.vault.filter((x) => x.id !== v.id) }));
}

export async function removeFromVault(v: VaultItem) {
  if (!isWeb) await FS.deleteAsync(v.uri, { idempotent: true });
  setState((s) => ({ vault: s.vault.filter((x) => x.id !== v.id) }));
}

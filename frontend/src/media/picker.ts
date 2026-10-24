// Cross-screen media picker: push /picker and await the user's selection.
// Root cause of the old "Select 1 does nothing" bug: the picker screen resolved the pending request with []
// from an unmount cleanup that can run before the user confirms (effect re-run / remount), so the caller
// received nothing. Requests now carry an id and are only cancelled once the screen is really gone.
import { router } from "expo-router";
import { MediaItem } from "@/src/store";

export type PickerOpts = { max?: number; type?: "photo" | "video" | "all"; title?: string };
let pending: { id: number; resolve: (v: MediaItem[]) => void; opts: PickerOpts } | null = null;
let seq = 0;
let mounted = 0;

export function pickMedia(opts: PickerOpts = {}): Promise<MediaItem[]> {
  pending?.resolve([]);
  return new Promise((resolve) => {
    pending = { id: ++seq, resolve, opts };
    router.push("/picker");
  });
}
export const pickerRequest = () => (pending ? { id: pending.id, opts: pending.opts } : { id: 0, opts: {} as PickerOpts });

export function resolvePicker(id: number, items: MediaItem[]) {
  if (!pending || pending.id !== id) return;
  const p = pending;
  pending = null;
  p.resolve(items);
}

export function pickerMounted() {
  mounted++;
}
// Called from the picker's unmount; cancels only if no picker screen re-mounted meanwhile.
export function pickerUnmounted(id: number) {
  mounted = Math.max(0, mounted - 1);
  setTimeout(() => {
    if (mounted === 0) resolvePicker(id, []);
  }, 350);
}

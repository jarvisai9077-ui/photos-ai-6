// Cross-screen media picker: push /picker and await the user's selection.
import { router } from "expo-router";
import { MediaItem } from "@/src/store";

type Opts = { max?: number; type?: "photo" | "video" | "all"; title?: string };
let pending: { resolve: (v: MediaItem[]) => void; opts: Opts } | null = null;

export function pickMedia(opts: Opts = {}): Promise<MediaItem[]> {
  pending?.resolve([]);
  return new Promise((resolve) => {
    pending = { resolve, opts };
    router.push("/picker");
  });
}
export const pickerOpts = () => pending?.opts || {};
export function resolvePicker(items: MediaItem[]) {
  pending?.resolve(items);
  pending = null;
}

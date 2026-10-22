// Web colour pipeline: real per-pixel matrix processing on an HTML canvas (preview at reduced size).
import React, { useEffect, useState } from "react";
import { Image } from "expo-image";
import { applyToPixels, isIdentity, M } from "./matrix";

export const colorEngine = "Canvas 2D (CPU)";

function load(uri: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new (globalThis as any).Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = uri;
  });
}

async function process(uri: string, m: M, maxSide?: number): Promise<string> {
  const img = await load(uri);
  let w = img.naturalWidth, h = img.naturalHeight;
  if (maxSide && Math.max(w, h) > maxSide) {
    const s = maxSide / Math.max(w, h);
    w = Math.round(w * s); h = Math.round(h * s);
  }
  const c = (globalThis as any).document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  applyToPixels(data.data, m);
  ctx.putImageData(data, 0, 0);
  return c.toDataURL("image/jpeg", 0.92);
}

export function ColorStage({ uri, w, h, matrix }: { uri: string; w: number; h: number; matrix: M }) {
  const [out, setOut] = useState(uri);
  useEffect(() => {
    if (isIdentity(matrix)) { setOut(uri); return; }
    let live = true;
    const t = setTimeout(() => process(uri, matrix, 700).then((r) => live && setOut(r)).catch(() => live && setOut(uri)), 120);
    return () => { live = false; clearTimeout(t); };
  }, [uri, matrix]);
  return <Image testID="editor-preview-image" source={{ uri: out }} style={{ width: w, height: h }} contentFit="contain" />;
}

export async function renderColor(uri: string, matrix: M): Promise<string> {
  return process(uri, matrix);
}

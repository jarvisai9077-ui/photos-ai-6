// Native colour pipeline: GPU-accelerated Skia colour-matrix preview + full-resolution offscreen export.
import React from "react";
import { Canvas, ColorMatrix, Image as SkImage, ImageFormat, Skia, useImage } from "@shopify/react-native-skia";
import * as FS from "expo-file-system/legacy";
import { M } from "./matrix";

export const colorEngine = "Skia (GPU)";

export function ColorStage({ uri, w, h, matrix }: { uri: string; w: number; h: number; matrix: M }) {
  const img = useImage(uri);
  if (!img) return null;
  return (
    <Canvas style={{ width: w, height: h }}>
      <SkImage image={img} x={0} y={0} width={w} height={h} fit="contain">
        <ColorMatrix matrix={matrix} />
      </SkImage>
    </Canvas>
  );
}

export async function renderColor(uri: string, matrix: M): Promise<string> {
  const data = await Skia.Data.fromURI(uri);
  const img = Skia.Image.MakeImageFromEncoded(data);
  if (!img) throw new Error("Could not decode image for colour processing");
  const w = img.width();
  const h = img.height();
  const surface = Skia.Surface.MakeOffscreen(w, h) || Skia.Surface.Make(w, h);
  if (!surface) throw new Error("Not enough memory for an offscreen surface at this resolution");
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(matrix));
  canvas.drawImage(img, 0, 0, paint);
  surface.flush();
  const b64 = surface.makeImageSnapshot().encodeToBase64(ImageFormat.JPEG, 93);
  const out = `${FS.cacheDirectory}rf_color_${Date.now()}.jpg`;
  await FS.writeAsStringAsync(out, b64, { encoding: FS.EncodingType.Base64 });
  return out;
}

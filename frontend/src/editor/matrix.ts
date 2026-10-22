// 4x5 colour matrices (row-major, offsets normalised 0..1) composed from real adjustment values.
export type Adjust = { exposure: number; brightness: number; contrast: number; saturation: number; temperature: number; tint: number; fade: number };
export const ZERO: Adjust = { exposure: 0, brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, fade: 0 };
export type M = number[];
export const IDENTITY: M = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

export function mul(a: M, b: M): M {
  // returns a∘b (apply b first, then a)
  const out = new Array(20).fill(0);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      let v = c === 4 ? a[r * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) v += a[r * 5 + k] * b[k * 5 + c];
      out[r * 5 + c] = v;
    }
  }
  return out;
}

const sat = (s: number): M => {
  const lr = 0.2126, lg = 0.7152, lb = 0.0722;
  const i = 1 - s;
  return [lr * i + s, lg * i, lb * i, 0, 0, lr * i, lg * i + s, lb * i, 0, 0, lr * i, lg * i, lb * i + s, 0, 0, 0, 0, 0, 1, 0];
};
const scale = (r: number, g: number, b: number, o = [0, 0, 0]): M => [r, 0, 0, 0, o[0], 0, g, 0, 0, o[1], 0, 0, b, 0, o[2], 0, 0, 0, 1, 0];

export function adjustMatrix(a: Adjust): M {
  let m = IDENTITY;
  const e = Math.pow(2, a.exposure);
  m = mul(scale(e, e, e), m);
  const k = 1 + a.contrast;
  const off = (1 - k) / 2 + a.brightness * 0.25;
  m = mul(scale(k, k, k, [off, off, off]), m);
  m = mul(sat(1 + a.saturation), m);
  m = mul(scale(1, 1, 1, [a.temperature * 0.08, -a.tint * 0.06, -a.temperature * 0.08]), m);
  if (a.fade) {
    const f = a.fade * 0.25;
    m = mul(scale(1 - f, 1 - f, 1 - f, [f, f, f]), m);
  }
  return m;
}

export const FILTERS: { id: string; name: string; m: M }[] = [
  { id: "none", name: "Original", m: IDENTITY },
  { id: "vivid", name: "Vivid", m: mul(scale(1.08, 1.08, 1.08, [-0.04, -0.04, -0.04]), sat(1.35)) },
  { id: "warm", name: "Warm", m: scale(1.08, 1.0, 0.88, [0.02, 0.01, 0]) },
  { id: "cool", name: "Cool", m: scale(0.9, 1.0, 1.1, [0, 0.01, 0.03]) },
  { id: "mono", name: "Mono", m: sat(0) },
  { id: "noir", name: "Noir", m: mul(scale(1.35, 1.35, 1.35, [-0.17, -0.17, -0.17]), sat(0)) },
  { id: "sepia", name: "Sepia", m: [0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0] },
  { id: "fade", name: "Fade", m: mul(scale(0.85, 0.85, 0.85, [0.09, 0.09, 0.1]), sat(0.8)) },
  { id: "peach", name: "Peach", m: scale(1.06, 0.98, 0.94, [0.04, 0.02, 0.03]) },
  { id: "lavender", name: "Lavender", m: scale(1.0, 0.95, 1.06, [0.03, 0.0, 0.05]) },
];

export const isIdentity = (m: M) => m.every((v, i) => Math.abs(v - IDENTITY[i]) < 1e-6);

// Applies a matrix to RGBA bytes in place (used by the web renderer).
export function applyToPixels(d: Uint8ClampedArray, m: M) {
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, a = d[i + 3] / 255;
    d[i] = (m[0] * r + m[1] * g + m[2] * b + m[3] * a + m[4]) * 255;
    d[i + 1] = (m[5] * r + m[6] * g + m[7] * b + m[8] * a + m[9]) * 255;
    d[i + 2] = (m[10] * r + m[11] * g + m[12] * b + m[13] * a + m[14]) * 255;
  }
}

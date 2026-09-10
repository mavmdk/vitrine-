/* Bruit procédural (value noise + fbm + ridged) — utilisé pour le relief et les textures. */

/* Hash entier (Math.imul) : ~5x plus rapide que la version à base de sin,
   pour la même qualité de bruit. Le relief et les textures étant générés
   au chargement, c'est ce qui dimensionne le temps d'attente. */
function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

export function fbm(x, y, octaves = 5, lacunarity = 2.03, gain = 0.5) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/* Ridged multifractal : donne les arêtes tranchantes des faces nord. */
export function ridged(x, y, octaves = 6, lacunarity = 2.07, gain = 0.52) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0, prev = 1;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(valueNoise(x * freq, y * freq) * 2 - 1);
    n *= n;
    n *= prev;
    prev = n;
    sum += amp * n;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
export function lerp(a, b, t) { return a + (b - a) * t; }

/* PRNG déterministe : les particules doivent être une pure fonction du scroll. */
export function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

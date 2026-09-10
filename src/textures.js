/* Textures 100% procédurales (aucun asset externe) : roche, neige, béton,
   moletage chrome, magnésie, sol caoutchouc, décals. */

import * as THREE from 'three';
import { fbm, ridged, valueNoise, clamp, smoothstep, lerp } from './noise.js';

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function toTexture(canvas, repeat = 1, srgb = false) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Dérive une normal map depuis un canvas de hauteur (canal rouge). */
function heightToNormal(heightCanvas, strength = 2.2) {
  const s = heightCanvas.width;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, s, s).data;
  const out = makeCanvas(s);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(s, s);
  const at = (x, y) => src[((y & (s - 1)) * s + (x & (s - 1))) * 4] / 255;

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * s + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/* ---------------------------------------------------------- roche */
export function rockSet(size = 512) {
  const height = makeCanvas(size);
  const color = makeCanvas(size);
  const rough = makeCanvas(size);
  const hi = height.getContext('2d').createImageData(size, size);
  const ci = color.getContext('2d').createImageData(size, size);
  const ri = rough.getContext('2d').createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * 8, v = (y / size) * 8;
      const base = fbm(u * 2.0, v * 2.0, 5);
      // fractures : ridged inversé = veines sombres profondes
      const crack = Math.pow(ridged(u * 1.3 + 11.2, v * 1.3 - 4.7, 5), 2.6);
      const grit = valueNoise(x * 0.9, y * 0.9);
      let h = base * 0.72 + crack * 0.42 + grit * 0.09;
      h = clamp(h, 0, 1);

      const i = (y * size + x) * 4;
      hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = h * 255;
      hi.data[i + 3] = 255;

      // granite/schiste : gris froid, veiné, un peu de fer oxydé
      const shade = 0.30 + h * 0.46;
      const rust = smoothstep(0.62, 0.92, fbm(u * 0.6 + 30, v * 0.6 + 30, 3));
      ci.data[i] = clamp(shade * 232 + rust * 42, 0, 255);
      ci.data[i + 1] = clamp(shade * 231 + rust * 16, 0, 255);
      ci.data[i + 2] = clamp(shade * 238 - rust * 12, 0, 255);
      ci.data[i + 3] = 255;

      const r = clamp(0.74 + (1 - h) * 0.22 + grit * 0.05, 0, 1);
      ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = r * 255;
      ri.data[i + 3] = 255;
    }
  }
  height.getContext('2d').putImageData(hi, 0, 0);
  color.getContext('2d').putImageData(ci, 0, 0);
  rough.getContext('2d').putImageData(ri, 0, 0);

  return {
    map: toTexture(color, 1, true),
    normalMap: toTexture(heightToNormal(height, 3.0)),
    roughnessMap: toTexture(rough)
  };
}

/* ---------------------------------------------------------- neige */
export function snowSet(size = 512) {
  const height = makeCanvas(size);
  const color = makeCanvas(size);
  const hi = height.getContext('2d').createImageData(size, size);
  const ci = color.getContext('2d').createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * 6, v = (y / size) * 6;
      // congères : ondulations douces + cristaux fins
      const dune = fbm(u * 1.1, v * 2.6, 4);
      const cryst = valueNoise(x * 1.7, y * 1.7);
      const h = clamp(dune * 0.82 + cryst * 0.18, 0, 1);
      const i = (y * size + x) * 4;
      hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = h * 255;
      hi.data[i + 3] = 255;

      const l = 0.90 + h * 0.10;
      ci.data[i] = 246 * l;
      ci.data[i + 1] = 249 * l;
      ci.data[i + 2] = 255 * l;      // neige légèrement bleutée
      ci.data[i + 3] = 255;
    }
  }
  height.getContext('2d').putImageData(hi, 0, 0);
  color.getContext('2d').putImageData(ci, 0, 0);
  return {
    map: toTexture(color, 1, true),
    normalMap: toTexture(heightToNormal(height, 1.35))
  };
}

/* ------------------------------------------- béton recyclé (têtes d'haltère) */
export function concreteSet(size = 512) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const h = makeCanvas(size);
  const hctx = h.getContext('2d');

  const ci = ctx.createImageData(size, size);
  const hi = hctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * 10, v = (y / size) * 10;
      const g = fbm(u * 3, v * 3, 4) * 0.5 + valueNoise(x * 1.3, y * 1.3) * 0.5;
      const i = (y * size + x) * 4;
      const l = 0.80 + g * 0.16;
      ci.data[i] = 214 * l; ci.data[i + 1] = 212 * l; ci.data[i + 2] = 206 * l; ci.data[i + 3] = 255;
      hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = g * 255; hi.data[i + 3] = 255;
    }
  }
  ctx.putImageData(ci, 0, 0);
  hctx.putImageData(hi, 0, 0);

  // mouchetis de caoutchouc recyclé : éclats colorés + noirs
  const flakes = ['#1b1b1d', '#2a2a2c', '#c0392b', '#2f6fb5', '#d8a12a', '#3f8f5c', '#8e8e93', '#101012'];
  const n = Math.round(size * size / 240);
  for (let i = 0; i < n; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = 0.8 + Math.random() * 2.6;
    ctx.fillStyle = flakes[(Math.random() * flakes.length) | 0];
    ctx.globalAlpha = 0.55 + Math.random() * 0.45;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.6 + Math.random() * 0.8), Math.random() * 6.28, 0, 6.28);
    ctx.fill();
    // creux correspondant dans la hauteur
    hctx.globalAlpha = 0.5;
    hctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
    hctx.beginPath();
    hctx.ellipse(x, y, r, r, 0, 0, 6.28);
    hctx.fill();
  }
  ctx.globalAlpha = 1; hctx.globalAlpha = 1;

  return {
    map: toTexture(c, 1, true),
    normalMap: toTexture(heightToNormal(h, 1.1)),
  };
}

/* ------------------------------------------------- moletage de la poignée */
export function knurlNormal(size = 256) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // croisillon diamant classique
      const a = Math.sin((x + y) * 0.62);
      const b = Math.sin((x - y) * 0.62);
      const h = (a * b) * 0.5 + 0.5;
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = h * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(heightToNormal(c, 2.4));
}

/* ---------------------------------------------------------- sprites */
export function smokeSprite(size = 256) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - half) / half, dy = (y - half) / half;
      const d = Math.hypot(dx, dy);
      const n = fbm(x / size * 4.5 + 3.2, y / size * 4.5 - 1.7, 4);
      let a = smoothstep(1.0, 0.12, d) * (0.45 + n * 0.85);
      a = clamp(a, 0, 1);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function dotSprite(size = 64) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* --------------------------------------------------- décals / lettrage */
function drawTracked(ctx, text, cx, y, spacing) {
  const chars = [...text];
  let total = 0;
  for (const ch of chars) total += ctx.measureText(ch).width + spacing;
  total -= spacing;
  let x = cx - total / 2;
  for (const ch of chars) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
  return total;
}

/* Étiquette du casque : "PAULINE" + cœur. */
export function helmetLabel(name = 'PAULINE', w = 512, h = 256) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = '#14161a';
  ctx.font = '700 88px Helvetica, Arial, sans-serif';
  ctx.textBaseline = 'middle';
  drawTracked(ctx, name, w * 0.5, h * 0.42, 7);

  // cœur tracé à la main, un peu irrégulier (marqueur)
  const hx = w * 0.5, hy = h * 0.72, s = 30;
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(hx, hy + s * 0.72);
  ctx.bezierCurveTo(hx - s * 1.32, hy - s * 0.16, hx - s * 0.46, hy - s * 0.96, hx, hy - s * 0.26);
  ctx.bezierCurveTo(hx + s * 0.46, hy - s * 0.96, hx + s * 1.32, hy - s * 0.16, hx, hy + s * 0.72);
  ctx.fill();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Marque UPWARD : le "A" est remplacé par une flèche bronze. */
export function upwardLogo(w = 1024, h = 256, opts = {}) {
  const ink = opts.ink || '#f4f4f4';
  const accent = opts.accent || '#b9793a';
  const bg = opts.bg || null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); } else ctx.clearRect(0, 0, w, h);

  const fs = Math.round(h * 0.52);
  ctx.font = `500 ${fs}px Helvetica, Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ink;

  const spacing = fs * 0.28;
  const chars = ['U', 'P', 'W', ' ', 'R', 'D'];
  let total = 0;
  const widths = chars.map((ch) => {
    const cw = ch === ' ' ? fs * 0.52 : ctx.measureText(ch).width;
    total += cw + spacing;
    return cw;
  });
  total -= spacing;

  let x = (w - total) / 2;
  const y = h * 0.5;
  let arrowX = 0;
  chars.forEach((ch, i) => {
    if (ch === ' ') arrowX = x + widths[i] / 2;
    else ctx.fillText(ch, x, y);
    x += widths[i] + spacing;
  });

  // flèche montante à la place du A
  const ah = fs * 1.02, aw = fs * 0.46, sw = fs * 0.13;
  const top = y - ah * 0.52, bot = y + ah * 0.48;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(arrowX - sw / 2, bot);
  ctx.lineTo(arrowX - sw / 2, top + aw * 0.62);
  ctx.lineTo(arrowX - aw / 2, top + aw * 0.62);
  ctx.lineTo(arrowX, top);
  ctx.lineTo(arrowX + aw / 2, top + aw * 0.62);
  ctx.lineTo(arrowX + sw / 2, top + aw * 0.62);
  ctx.lineTo(arrowX + sw / 2, bot);
  ctx.closePath();
  ctx.fill();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Petit décal gravé sur les têtes de l'haltère (flèche seule, ou "50"). */
export function stampTexture(kind = 'arrow', size = 256) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#101114';
  if (kind === 'weight') {
    ctx.font = '700 128px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('50', size / 2, size / 2);
  } else {
    const cx = size / 2, ah = size * 0.62, aw = size * 0.36, sw = size * 0.11;
    const top = cx - ah / 2, bot = cx + ah / 2;
    ctx.beginPath();
    ctx.moveTo(cx - sw / 2, bot);
    ctx.lineTo(cx - sw / 2, top + aw * 0.6);
    ctx.lineTo(cx - aw / 2, top + aw * 0.6);
    ctx.lineTo(cx, top);
    ctx.lineTo(cx + aw / 2, top + aw * 0.6);
    ctx.lineTo(cx + sw / 2, top + aw * 0.6);
    ctx.lineTo(cx + sw / 2, bot);
    ctx.closePath();
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------ sol de box crossfit */
export function floorSet(size = 512) {
  const color = makeCanvas(size);
  const height = makeCanvas(size);
  const ctx = color.getContext('2d');
  const hctx = height.getContext('2d');

  ctx.fillStyle = '#17181b';
  ctx.fillRect(0, 0, size, size);
  hctx.fillStyle = '#8a8a8a';
  hctx.fillRect(0, 0, size, size);

  // granulat de caoutchouc
  for (let i = 0; i < size * 22; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = 0.6 + Math.random() * 1.9;
    const g = 26 + Math.random() * 42;
    ctx.fillStyle = `rgba(${g},${g + 2},${g + 4},${0.35 + Math.random() * 0.5})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill();
    hctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.28)';
    hctx.beginPath(); hctx.arc(x, y, r, 0, 6.28); hctx.fill();
  }
  // joint des dalles
  ctx.strokeStyle = 'rgba(0,0,0,.85)';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, size, size);
  hctx.strokeStyle = 'rgba(0,0,0,.9)';
  hctx.lineWidth = 5;
  hctx.strokeRect(0, 0, size, size);

  return {
    map: toTexture(color, 1, true),
    normalMap: toTexture(heightToNormal(height, 1.0)),
  };
}

/* Tache de magnésie au sol. */
export function chalkPatch(size = 256) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const img = ctx.createImageData(size, size);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot((x - half) / half, (y - half) / half);
      const n = fbm(x / size * 5 + 9, y / size * 5 + 2, 4);
      let a = smoothstep(0.95, 0.05, d) * lerp(0.25, 1.0, n);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = clamp(a, 0, 1) * 235;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

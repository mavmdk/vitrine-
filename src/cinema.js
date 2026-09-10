/* Traitement d'image "caméra" : aberration chromatique, vignettage,
   courbe filmique et étalonnage froid/chaud. Appliqué après le tone mapping,
   comme un étalonnage de post-production. */

import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse: { value: null },
    vignette: { value: 0.42 },   // force du vignettage
    chroma:   { value: 0.55 },   // aberration chromatique en bord de champ
    contrast: { value: 1.06 },
    saturation: { value: 1.04 },
    lift:     { value: new THREE.Vector3(0.012, 0.016, 0.026) }, // ombres bleutées
    gain:     { value: new THREE.Vector3(1.012, 1.0, 0.984) },   // hautes lumières chaudes
    grain:    { value: 0.022 },
    time:     { value: 0 },
    aspect:   { value: 1.6 }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float vignette, chroma, contrast, saturation, grain, time, aspect;
    uniform vec3 lift, gain;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);

      // aberration chromatique : les canaux se séparent vers les bords,
      // exactement comme une optique réelle
      vec2 off = c * r2 * chroma * 0.012;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;

      // étalonnage : ombres froides, hautes lumières chaudes
      col = col * gain + lift * (1.0 - col);

      // contraste autour du gris moyen
      col = (col - 0.5) * contrast + 0.5;

      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, saturation);

      // vignettage optique
      col *= 1.0 - vignette * smoothstep(0.12, 0.72, r2);

      // grain argentique, animé
      float g = hash(vUv * vec2(aspect, 1.0) * 1024.0 + time) - 0.5;
      col += g * grain * (1.0 - luma * 0.6);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`
};

export function createGradePass() {
  return new ShaderPass(GradeShader);
}

/* Traînée de vitesse de l'haltère : un fuseau étiré entre deux positions
   successives. Beaucoup moins coûteux qu'un vrai flou cinétique, et c'est
   ce que l'œil lit comme "ça va vite". */
export function createStreak() {
  const geo = new THREE.CylinderGeometry(0.085, 0.085, 1, 12, 1, true);
  geo.translate(0, 0.5, 0);            // origine à la base : on étire vers +Y

  const canvas = document.createElement('canvas');
  canvas.width = 8; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.55, 'rgba(255,255,255,.5)');
  grad.addColorStop(1, 'rgba(255,255,255,.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 8, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  return mesh;
}

/* Oriente le fuseau entre la position précédente et la position courante. */
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();

export function aimStreak(mesh, from, to, strength) {
  _dir.subVectors(to, from);
  const len = _dir.length();
  if (len < 0.001 || strength <= 0.01) { mesh.visible = false; return; }
  mesh.visible = true;
  mesh.position.copy(from);
  _q.setFromUnitVectors(_up, _dir.divideScalar(len));
  mesh.quaternion.copy(_q);
  mesh.scale.set(1, len, 1);
  mesh.material.opacity = strength;
}

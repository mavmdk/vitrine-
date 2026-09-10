/* Effets : éclats de roche, poudreuse, traînée, explosion de magnésie.
   Tout est une fonction pure du scroll — on doit pouvoir scruber en arrière. */

import * as THREE from 'three';
import { rng, clamp, smoothstep, lerp } from './noise.js';

/* Une bouffée de particules, déterministe, pilotée par un âge en secondes. */
export class Burst {
  constructor(opts) {
    const {
      count = 60, size = 0.4, texture, color = 0xffffff, speed = 6,
      spread = 1, gravity = -9.8, drag = 1.2, life = 1.6,
      opacity = 1, blending = THREE.NormalBlending, seed = 1,
      up = 0.7, depthWrite = false
    } = opts;

    this.count = count;
    this.life = life;
    this.gravity = gravity;
    this.drag = drag;

    const rand = rng(seed);
    this.vel = new Float32Array(count * 3);
    this.scaleJitter = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // demi-sphère orientée vers le haut + composante latérale
      const a = rand() * Math.PI * 2;
      const el = Math.pow(rand(), 0.65) * Math.PI * 0.5;
      const sp = speed * (0.25 + rand() * 0.95);
      this.vel[i * 3] = Math.cos(a) * Math.sin(el) * sp * spread;
      this.vel[i * 3 + 1] = Math.cos(el) * sp * up + rand() * sp * 0.25;
      this.vel[i * 3 + 2] = Math.sin(a) * Math.sin(el) * sp * spread;
      this.scaleJitter[i] = 0.5 + rand() * 1.2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));

    this.material = new THREE.PointsMaterial({
      size, map: texture, color: new THREE.Color(color),
      transparent: true, opacity, depthWrite, blending,
      sizeAttenuation: true, alphaTest: 0.01, fog: true
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.origin = new THREE.Vector3();
    this.baseSize = size;
    this.baseOpacity = opacity;
    this.grow = opts.grow ?? 0;
  }

  setOrigin(v) { this.origin.copy(v); }

  /* age < 0 : pas encore né. age > life : terminé. */
  update(age) {
    if (age < 0 || age > this.life) { this.points.visible = false; return; }
    this.points.visible = true;

    const t = age;
    const f = 1 - Math.exp(-this.drag * t);      // intégrale de la traînée
    const k = f / this.drag;
    const arr = this.points.geometry.attributes.position.array;

    for (let i = 0; i < this.count; i++) {
      const j = i * 3;
      arr[j] = this.origin.x + this.vel[j] * k;
      arr[j + 1] = this.origin.y + this.vel[j + 1] * k + 0.5 * this.gravity * t * t * 0.35;
      arr[j + 2] = this.origin.z + this.vel[j + 2] * k;
    }
    this.points.geometry.attributes.position.needsUpdate = true;

    const n = t / this.life;
    this.material.opacity = this.baseOpacity * (1 - smoothstep(0.35, 1.0, n)) * smoothstep(0, 0.06, n);
    this.material.size = this.baseSize * (1 + this.grow * n);
  }
}

/* Traînée de poudreuse derrière l'haltère. */
export class Trail {
  constructor(texture, count = 44) {
    this.count = count;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.material = new THREE.PointsMaterial({
      size: 0.55, map: texture, color: 0xeef4ff, transparent: true,
      opacity: 0.0, depthWrite: false, sizeAttenuation: true, alphaTest: 0.01
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.rand = [];
    const r = rng(5150);
    for (let i = 0; i < count * 3; i++) this.rand.push(r() - 0.5);
  }

  /* sampler(p) -> Vector3 : on échantillonne la trajectoire en arrière. */
  update(p, sampler, strength) {
    const arr = this.points.geometry.attributes.position.array;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < this.count; i++) {
      const back = (i / this.count) * 0.055;
      sampler(Math.max(0, p - back), tmp);
      const s = (i / this.count) * 2.2;
      arr[i * 3] = tmp.x + this.rand[i * 3] * s;
      arr[i * 3 + 1] = tmp.y + this.rand[i * 3 + 1] * s * 0.6;
      arr[i * 3 + 2] = tmp.z + this.rand[i * 3 + 2] * s;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.material.opacity = strength * 0.5;
    this.points.visible = strength > 0.01;
  }
}

/* Onde de choc au sol (anneau de magnésie qui se propage). */
export function createShockwave(texture) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 1.0, 64),
    new THREE.MeshBasicMaterial({
      map: texture, color: 0xffffff, transparent: true,
      opacity: 0, depthWrite: false, side: THREE.DoubleSide
    })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  return mesh;
}

/* Le nuage de magnésie : 3 couches de tailles différentes = volume crédible. */
export function createChalkCloud(smokeTex) {
  const group = new THREE.Group();
  const layers = [
    new Burst({ count: 46, size: 2.6, texture: smokeTex, speed: 4.2, up: 0.55, gravity: -1.1, drag: 2.4, life: 3.4, opacity: 0.55, seed: 11, grow: 1.6 }),
    new Burst({ count: 60, size: 1.35, texture: smokeTex, speed: 6.4, up: 0.5, gravity: -1.6, drag: 2.8, life: 2.8, opacity: 0.62, seed: 22, grow: 1.9 }),
    new Burst({ count: 70, size: 0.6, texture: smokeTex, speed: 9.0, up: 0.42, gravity: -2.6, drag: 3.4, life: 2.2, opacity: 0.7, seed: 33, grow: 1.2 })
  ];
  layers.forEach((l) => group.add(l.points));
  return { group, layers };
}

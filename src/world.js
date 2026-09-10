/* Le monde : ciel physique, montagne, falaise détaillée, mer de nuages, box crossfit. */

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { ridged, fbm, valueNoise, clamp, smoothstep, lerp, rng } from './noise.js';
import * as TEX from './textures.js';

export const WORLD = {
  radius: 620,        // rayon de la base de la montagne
  peak: 470,          // hauteur brute avant modulation du bruit
  cloudTop: 132,
  cloudBottom: 66,
  gym: new THREE.Vector3(0, 0, 196),
  sunElevation: 22,   // degrés — soleil derrière la face : contre-jour
  sunAzimuth: 172
};

/* ------------------------------------------------------------------ relief */
export function terrainHeight(x, z) {
  const r = Math.hypot(x, z) / WORLD.radius;
  if (r >= 1) return 0;
  const cone = Math.pow(1 - r, 1.9);
  const ridge = ridged(x * 0.0024 + 5.5, z * 0.0024 - 3.1, 6);
  const rough = fbm(x * 0.011 - 2.2, z * 0.011 + 7.4, 4);
  const talus = smoothstep(1.0, 0.55, r);
  return WORLD.peak * cone * (0.40 + 0.80 * ridge) + 30 * rough * talus;
}

/* Détail haute fréquence, ajouté seulement sur la dalle proche de la caméra. */
export function detailHeight(x, z) {
  const a = fbm(x * 0.09 + 12.3, z * 0.09 - 5.1, 5) - 0.5;
  const b = ridged(x * 0.30 - 3.3, z * 0.30 + 9.9, 4) - 0.5;
  const c = fbm(x * 1.15 + 4.4, z * 1.15 - 8.8, 3) - 0.5;
  return a * 3.0 + b * 1.9 + c * 0.42;
}

export function surfaceHeight(x, z) {
  return terrainHeight(x, z) + detailHeight(x, z);
}

/* Normale approchée de la surface (différences finies). */
export function surfaceNormal(x, z, e = 0.8) {
  const hL = surfaceHeight(x - e, z), hR = surfaceHeight(x + e, z);
  const hD = surfaceHeight(x, z - e), hU = surfaceHeight(x, z + e);
  return new THREE.Vector3(hL - hR, 2 * e, hD - hU).normalize();
}

/* -------------------------------------------------------------------- ciel */
export function createSky(renderer, scene) {
  const sky = new Sky();
  sky.scale.setScalar(600000);

  const u = sky.material.uniforms;
  u.turbidity.value = 2.2;
  u.rayleigh.value = 2.55;
  u.mieCoefficient.value = 0.004;
  u.mieDirectionalG.value = 0.87;

  const sun = new THREE.Vector3();
  const phi = THREE.MathUtils.degToRad(90 - WORLD.sunElevation);
  const theta = THREE.MathUtils.degToRad(WORLD.sunAzimuth);
  sun.setFromSphericalCoords(1, phi, theta);
  u.sunPosition.value.copy(sun);

  // env map issue du ciel : c'est elle qui donne le rendu "photo"
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  envScene.add(sky);
  const rt = pmrem.fromScene(envScene);
  scene.add(sky);           // re-parenté vers la scène principale
  pmrem.dispose();

  return { sky, sun, envMap: rt.texture };
}

/* --------------------------------------------------------------- montagne */
function paintVertexColours(geo, opts = {}) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const snowLine = opts.snowLine ?? 40;
  const rock = new THREE.Color(0x2b2d33);
  const rockWarm = new THREE.Color(0x3e372f);
  const snow = new THREE.Color(0xeef4ff).multiplyScalar(1.55);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const slope = nrm.getY(i);                       // 1 = plat, 0 = vertical
    const jitter = fbm(x * 0.05, z * 0.05, 3) - 0.5;

    // seuil serré : soit c'est enneigé, soit c'est de la roche nue
    let snowAmt = smoothstep(0.50, 0.68, slope + jitter * 0.30);
    snowAmt *= smoothstep(snowLine - 40, snowLine + 30, y);
    // corniches et coulées de neige accrochées au raide, en altitude
    snowAmt = clamp(snowAmt + smoothstep(200, 380, y) * 0.30 * (0.45 + jitter), 0, 1);

    c.copy(rock).lerp(rockWarm, clamp(fbm(x * 0.02 + 3, z * 0.02, 3) * 1.6 - 0.2, 0, 1));
    c.lerp(snow, snowAmt);
    // variation d'exposition pour casser l'uniformité
    const v = 0.86 + jitter * 0.34;
    colors[i * 3] = c.r * v;
    colors[i * 3 + 1] = c.g * v;
    colors[i * 3 + 2] = c.b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

export function createMountain(rockTex) {
  const size = WORLD.radius * 2.6;
  const seg = 288;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
  }
  geo.computeVertexNormals();
  paintVertexColours(geo, { snowLine: 60 });

  const map = rockTex.map.clone(); map.needsUpdate = true; map.repeat.set(56, 56);
  const nrm = rockTex.normalMap.clone(); nrm.needsUpdate = true; nrm.repeat.set(56, 56);
  const rgh = rockTex.roughnessMap.clone(); rgh.needsUpdate = true; rgh.repeat.set(56, 56);

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map, normalMap: nrm, roughnessMap: rgh,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 1.0,
    metalness: 0.0,
    envMapIntensity: 0.85,
    dithering: true
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'mountain';
  return mesh;
}

/* Dalle très détaillée sous les pieds de l'alpiniste (plan rapproché). */
export function createCliff(cx, cz, rockTex, snowTex) {
  const w = 86, d = 118, seg = 210;
  const geo = new THREE.PlaneGeometry(w, d, seg, seg);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx, z = pos.getZ(i) + cz;
    // fond dégressif : la dalle se raccorde au terrain sur ses bords
    pos.setY(i, surfaceHeight(x, z) + 0.12);
  }
  geo.computeVertexNormals();
  paintVertexColours(geo, { snowLine: 60 });

  const map = rockTex.map.clone(); map.needsUpdate = true; map.repeat.set(14, 18);
  const nrm = rockTex.normalMap.clone(); nrm.needsUpdate = true; nrm.repeat.set(14, 18);
  const rgh = rockTex.roughnessMap.clone(); rgh.needsUpdate = true; rgh.repeat.set(14, 18);

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map, normalMap: nrm, roughnessMap: rgh,
    normalScale: new THREE.Vector2(1.5, 1.5),
    roughness: 0.98,
    metalness: 0.0,
    envMapIntensity: 0.9
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, 0, cz);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.name = 'cliff';
  return mesh;
}

/* Sommets secondaires à l'horizon, pour la profondeur atmosphérique. */
export function createDistantRange() {
  const g = new THREE.Group();
  const rand = rng(90210);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x9fb4cc, roughness: 1, metalness: 0, flatShading: true, envMapIntensity: 0.6
  });
  for (let i = 0; i < 11; i++) {
    const a = rand() * Math.PI * 2;
    const dist = 1500 + rand() * 900;
    const h = 190 + rand() * 260;
    const r = 180 + rand() * 200;
    const cone = new THREE.ConeGeometry(r, h, 7 + ((rand() * 4) | 0), 3);
    const p = cone.attributes.position;
    for (let k = 0; k < p.count; k++) {
      p.setX(k, p.getX(k) + (rand() - 0.5) * r * 0.24);
      p.setZ(k, p.getZ(k) + (rand() - 0.5) * r * 0.24);
    }
    cone.computeVertexNormals();
    const m = new THREE.Mesh(cone, mat);
    m.position.set(Math.cos(a) * dist, h / 2 - 40, Math.sin(a) * dist);
    g.add(m);
  }
  g.name = 'range';
  return g;
}

/* ---------------------------------------------------------- mer de nuages */
export function createCloudSea(smokeTex) {
  const g = new THREE.Group();
  const rand = rng(4242);
  const mat = new THREE.SpriteMaterial({
    map: smokeTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.5,
    fog: false
  });

  for (let i = 0; i < 190; i++) {
    const a = rand() * Math.PI * 2;
    const rad = 90 + Math.pow(rand(), 0.6) * 1500;
    const s = mat.clone();
    const tint = 0.86 + rand() * 0.14;
    s.color.setRGB(tint, tint * 0.99, tint * 1.02);
    s.opacity = 0.28 + rand() * 0.42;
    const sp = new THREE.Sprite(s);
    const scale = 130 + rand() * 340;
    sp.scale.set(scale, scale * (0.42 + rand() * 0.3), 1);
    sp.position.set(
      Math.cos(a) * rad,
      lerp(WORLD.cloudBottom, WORLD.cloudTop, rand()) + (rand() - 0.5) * 22,
      Math.sin(a) * rad
    );
    sp.userData.drift = (rand() - 0.5) * 0.9;
    g.add(sp);
  }
  g.name = 'cloudsea';
  return g;
}

/* Nuages traversés pendant la chute (plan rapproché, ils défilent). */
export function createFallClouds(smokeTex, path) {
  const g = new THREE.Group();
  const rand = rng(777);
  for (let i = 0; i < 70; i++) {
    const t = rand();
    const y = lerp(WORLD.cloudTop + 24, WORLD.cloudBottom - 30, t);
    const s = new THREE.SpriteMaterial({
      map: smokeTex, transparent: true, depthWrite: false, fog: false
    });
    const tint = 0.72 + rand() * 0.26;
    s.color.setRGB(tint, tint, tint * 1.02);
    s.opacity = 0.34 + rand() * 0.5;
    const sp = new THREE.Sprite(s);
    const sc = 26 + rand() * 90;
    sp.scale.set(sc, sc * (0.6 + rand() * 0.5), 1);
    sp.position.set(
      path.x + (rand() - 0.5) * 130,
      y,
      path.z + (rand() - 0.5) * 130
    );
    g.add(sp);
  }
  g.name = 'fallclouds';
  return g;
}

/* -------------------------------------------------------------- box crossfit */
export function createGym() {
  const g = new THREE.Group();
  g.position.copy(WORLD.gym);
  g.name = 'gym';

  const floorTex = TEX.floorSet(512);
  floorTex.map.repeat.set(22, 22);
  floorTex.normalMap.repeat.set(22, 22);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140, 1, 1),
    new THREE.MeshStandardMaterial({
      map: floorTex.map,
      normalMap: floorTex.normalMap,
      normalScale: new THREE.Vector2(0.7, 0.7),
      color: 0xffffff,
      roughness: 0.58,          // caoutchouc légèrement lustré : il accroche les reflets
      metalness: 0.0,
      envMapIntensity: 0.35
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);

  // poussière de magnésie déjà présente au sol
  const patchTex = TEX.chalkPatch(256);
  const rand = rng(31337);
  for (let i = 0; i < 11; i++) {
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: patchTex, transparent: true, opacity: 0.07 + rand() * 0.14,
        depthWrite: false, color: 0xdfe4ea
      })
    );
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = rand() * 6.28;
    const s = 2.5 + rand() * 9;
    p.scale.set(s, s, 1);
    p.position.set((rand() - 0.5) * 30, 0.012 + i * 0.002, (rand() - 0.5) * 30);
    g.add(p);
  }

  // le tas de magnésie sur lequel l'haltère atterrit
  const heap = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({ color: 0xf3f5f8, roughness: 0.95, metalness: 0 })
  );
  heap.scale.set(1, 0.24, 1);
  heap.position.y = 0.005;
  heap.receiveShadow = true;
  g.add(heap);

  const impact = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: patchTex, transparent: true, opacity: 0, depthWrite: false })
  );
  impact.rotation.x = -Math.PI / 2;
  impact.position.set(0, 0.03, 0);
  impact.scale.set(11, 11, 1);
  impact.name = 'impactChalk';
  g.add(impact);

  // salle : murs béton sombres, plafond haut
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x23262b, roughness: 0.92, metalness: 0.0, side: THREE.BackSide, envMapIntensity: 0.2
  });
  const room = new THREE.Mesh(new THREE.BoxGeometry(64, 24, 64), wallMat);
  room.position.y = 11.9;
  room.receiveShadow = true;
  g.add(room);

  // rampes lumineuses : hors du champ principal, elles servent de sources visibles
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xeaf1ff });
  for (let i = -1; i <= 1; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(22, 0.22, 0.6), stripMat);
    strip.position.set(0, 11.4, -6 + i * 9);
    g.add(strip);
  }

  // racks et caisses : silhouettes d'arrière-plan
  const propMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.55, metalness: 0.5 });
  for (let i = 0; i < 10; i++) {
    const h = 1.2 + rand() * 3.6;
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.2 + rand() * 2.4, h, 1.2 + rand() * 2.2), propMat);
    const a = rand() * Math.PI * 2;
    const rr = 16 + rand() * 11;
    b.position.set(Math.cos(a) * rr, h / 2, Math.sin(a) * rr);
    b.castShadow = true; b.receiveShadow = true;
    g.add(b);
  }

  // rack à haltères aligné au fond
  for (let i = 0; i < 7; i++) {
    const d = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12),
      new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.7, metalness: 0.2 })
    );
    d.rotation.z = Math.PI / 2;
    d.position.set(-9 + i * 3, 0.9, -14.5);
    d.castShadow = true;
    g.add(d);
  }

  /* --- éclairage : intensités en unités physiques (I / d²) --- */
  const key = new THREE.SpotLight(0xffffff, 2600, 46, 0.72, 0.5, 1.7);
  key.position.set(5.5, 12.5, 7);
  key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0015;
  key.shadow.normalBias = 0.02;
  g.add(key, key.target);

  const rim = new THREE.SpotLight(0xa8c8ff, 1800, 60, 0.9, 0.7, 1.6);
  rim.position.set(-13, 10, -13);
  rim.target.position.set(0, 0.6, 0);
  g.add(rim, rim.target);

  const warm = new THREE.PointLight(0xffb473, 320, 40, 1.9);
  warm.position.set(-7, 3.5, 11);
  g.add(warm);

  const fill = new THREE.HemisphereLight(0x5d7392, 0x111316, 0.35);
  g.add(fill);

  g.visible = false;
  return g;
}

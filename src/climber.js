/* L'alpiniste : vu de dos, plan serré, en contre-jour.
   Volontairement lu comme une silhouette rim-lightée — c'est ce qui vend le réalisme. */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as TEX from './textures.js';
import { smoothstep, lerp } from './noise.js';

const JACKET = 0xd0491c;      // orange himalaya
const JACKET_DARK = 0x7a2a0f;
const PANTS = 0x101216;
const GEAR = 0x1a1c20;
const HELMET = 0xe9ecef;

function mat(color, rough = 0.68, metal = 0.0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMapIntensity: 1.0 });
}

function limb(radius, length, material) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 14), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createClimber(name = 'PAULINE') {
  const root = new THREE.Group();
  root.name = 'climber';

  const jacketMat = mat(JACKET, 0.74);
  const jacketDarkMat = mat(JACKET_DARK, 0.8);
  const pantsMat = mat(PANTS, 0.62);
  const gearMat = mat(GEAR, 0.5, 0.2);
  const metalMat = mat(0x9aa2ab, 0.32, 0.92);
  const skinMat = mat(0x8a6a53, 0.8);

  /* ---- bassin + torse ---- */
  const body = new THREE.Group();
  body.position.y = 1.02;
  root.add(body);

  const torso = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.62, 0.30, 4, 0.12), jacketMat);
  torso.position.y = 0.26;
  torso.castShadow = true; torso.receiveShadow = true;
  body.add(torso);

  const hips = new THREE.Mesh(new RoundedBoxGeometry(0.40, 0.26, 0.28, 3, 0.10), pantsMat);
  hips.position.y = -0.06;
  hips.castShadow = true;
  body.add(hips);

  // baudrier + matériel qui pend
  const harness = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.035, 8, 20), gearMat);
  harness.rotation.x = Math.PI / 2;
  harness.position.y = -0.04;
  harness.scale.set(1, 0.82, 1);
  body.add(harness);

  const carabinerColors = [0x8d8f94, 0x3f4a55, 0xa8842f, 0x6f7379];
  carabinerColors.forEach((c, i) => {
    const k = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.009, 6, 12), mat(c, 0.4, 0.75));
    const a = -0.9 + i * 0.55;
    k.position.set(Math.sin(a) * 0.21, -0.16 - (i % 2) * 0.05, Math.cos(a) * 0.2);
    k.rotation.set(0.4, a, 0.2);
    body.add(k);
  });

  /* ---- jambes ---- */
  function leg(side) {
    const g = new THREE.Group();
    g.position.set(0.14 * side, -0.08, 0);
    const thigh = limb(0.105, 0.34, pantsMat);
    thigh.position.y = -0.22;
    g.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.44;
    g.add(knee);

    const shin = limb(0.085, 0.34, pantsMat);
    shin.position.y = -0.22;
    knee.add(shin);

    const boot = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.14, 0.34, 3, 0.05), mat(0x17181b, 0.55));
    boot.position.set(0, -0.46, -0.05);
    boot.castShadow = true;
    knee.add(boot);

    // crampons
    const spikes = new THREE.Group();
    spikes.position.set(0, -0.53, -0.05);
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.075, 5), metalMat);
      s.position.set(-0.05 + (i % 2) * 0.1, -0.02, -0.13 + Math.floor(i / 2) * 0.11);
      s.rotation.x = Math.PI;
      spikes.add(s);
    }
    const front = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.11, 5), metalMat);
    front.position.set(0, 0.0, -0.20);
    front.rotation.x = -Math.PI / 2;
    spikes.add(front);
    knee.add(spikes);

    g.userData = { knee };
    return g;
  }

  const legL = leg(1);
  const legR = leg(-1);
  body.add(legL, legR);

  /* ---- bras ---- */
  function arm(side) {
    const g = new THREE.Group();
    g.position.set(0.25 * side, 0.44, 0);
    const upper = limb(0.088, 0.26, jacketMat);
    upper.position.y = -0.17;
    g.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.34;
    g.add(elbow);

    const fore = limb(0.072, 0.24, jacketDarkMat);
    fore.position.y = -0.16;
    elbow.add(fore);

    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), mat(0x101114, 0.72));
    glove.position.y = -0.32;
    glove.castShadow = true;
    elbow.add(glove);

    g.userData = { elbow, glove };
    return g;
  }

  const armL = arm(1);
  const armR = arm(-1);
  body.add(armL, armR);

  /* ---- tête + casque ---- */
  const neck = new THREE.Group();
  neck.position.y = 0.62;
  body.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 16), skinMat);
  head.scale.set(1, 1.12, 1.04);
  head.castShadow = true;
  neck.add(head);

  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.155, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), jacketMat);
  hood.position.set(0, -0.02, 0.045);
  hood.scale.set(1.05, 1.0, 1.12);
  neck.add(hood);

  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.145, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.56),
    mat(HELMET, 0.34, 0.05)
  );
  helmet.position.y = 0.03;
  helmet.scale.set(1.02, 1.08, 1.06);
  helmet.castShadow = true;
  neck.add(helmet);

  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.144, 0.012, 6, 24), mat(0x2b2e33, 0.5));
  brim.rotation.x = Math.PI / 2;
  brim.position.y = 0.032;
  neck.add(brim);

  /* le détail qui compte : "PAULINE ♥" écrit sur le casque */
  const labelGeo = new THREE.SphereGeometry(
    0.1485, 40, 26,
    Math.PI / 2 - 0.62, 1.24,       // centré sur +Z (l'arrière du casque, face caméra)
    0.62, 0.52
  );
  const label = new THREE.Mesh(labelGeo, new THREE.MeshStandardMaterial({
    map: TEX.helmetLabel(name),
    transparent: true,
    roughness: 0.36,
    metalness: 0.0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2
  }));
  label.position.copy(helmet.position);
  label.scale.copy(helmet.scale);
  label.name = 'helmetLabel';
  neck.add(label);

  // lunettes de glacier, visibles de trois-quarts
  const goggles = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 8, 22), mat(0x111317, 0.4));
  goggles.rotation.x = Math.PI / 2;
  goggles.position.set(0, -0.015, 0);
  goggles.scale.set(1, 1, 0.85);
  neck.add(goggles);

  /* ---- sac à dos (d'où tombe l'haltère) ---- */
  const pack = new THREE.Group();
  pack.position.set(0, 0.30, 0.24);
  body.add(pack);

  const packBody = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.52, 0.24, 4, 0.07), mat(0x2d3138, 0.86));
  packBody.castShadow = true; packBody.receiveShadow = true;
  pack.add(packBody);

  const packTrim = new THREE.Mesh(new RoundedBoxGeometry(0.30, 0.10, 0.26, 3, 0.04), mat(0x585f68, 0.8));
  packTrim.position.y = -0.14;
  pack.add(packTrim);

  // rabat ouvert : c'est par là que ça sort
  const flap = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.20, 0.06, 3, 0.03), mat(0x22262c, 0.86));
  flap.position.set(0, 0.30, 0.06);
  flap.rotation.x = -0.95;
  flap.name = 'flap';
  pack.add(flap);

  [-1, 1].forEach((s) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.05), mat(0x1d2025, 0.9));
    strap.position.set(0.14 * s, -0.05, -0.16);
    strap.rotation.x = 0.12;
    pack.add(strap);
  });

  // piolet sanglé sur le sac
  const axe = new THREE.Group();
  axe.position.set(-0.2, -0.02, 0.1);
  axe.rotation.z = 0.22;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.56, 8), mat(0x14161a, 0.45, 0.35));
  axe.add(shaft);
  const pick = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.035, 0.02), metalMat);
  pick.position.set(0.08, 0.27, 0);
  pick.rotation.z = -0.5;
  axe.add(pick);
  pack.add(axe);

  // point d'ancrage de l'haltère dans le sac
  const anchor = new THREE.Object3D();
  anchor.position.set(0.0, 0.08, 0.03);   // rangée au fond du sac
  pack.add(anchor);

  /* ---- corde ---- */
  const ropeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.18, 1.02, 0.06),
    new THREE.Vector3(0.55, 1.55, -0.55),
    new THREE.Vector3(1.25, 2.35, -1.9),
    new THREE.Vector3(2.1, 3.6, -3.6),
    new THREE.Vector3(3.4, 5.6, -6.2)
  ]);
  const rope = new THREE.Mesh(
    new THREE.TubeGeometry(ropeCurve, 48, 0.013, 6, false),
    mat(0x1d7a44, 0.82)
  );
  rope.castShadow = true;
  root.add(rope);

  root.userData = {
    anchor, legL, legR, armL, armR, body, neck, pack, flap, helmet, label
  };

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });

  return root;
}

/* Pose animée : il monte, se hisse — c'est ce mouvement qui décroche l'haltère. */
export function poseClimber(climber, p, time) {
  const u = climber.userData;
  const reach = smoothstep(0.0, 0.085, p);          // il tend le bras droit
  const settle = smoothstep(0.085, 0.16, p);
  const breathe = Math.sin(time * 1.4) * 0.012;

  u.body.position.y = 1.02 + reach * 0.16 - settle * 0.05 + breathe;
  u.body.rotation.x = -0.12 - reach * 0.10;
  u.body.rotation.z = lerp(0.03, -0.02, reach);

  // bras droit : va chercher la prise en haut
  u.armR.rotation.x = lerp(-0.55, -2.35, reach);
  u.armR.rotation.z = lerp(0.25, 0.55, reach);
  u.armR.userData.elbow.rotation.x = lerp(-0.9, -0.25, reach);

  // bras gauche : reste planté sur le piolet
  u.armL.rotation.x = lerp(-1.75, -1.45, reach);
  u.armL.rotation.z = lerp(-0.35, -0.2, reach);
  u.armL.userData.elbow.rotation.x = -0.55;

  // jambes : la droite pousse, la gauche remonte
  u.legL.rotation.x = lerp(0.10, -0.55, reach);
  u.legL.userData.knee.rotation.x = lerp(0.45, 1.05, reach);
  u.legR.rotation.x = lerp(-0.35, -0.12, reach);
  u.legR.userData.knee.rotation.x = lerp(0.85, 0.4, reach);

  u.neck.rotation.x = lerp(-0.18, -0.42, reach);
  u.neck.rotation.y = Math.sin(time * 0.6) * 0.05;

  // le rabat s'ouvre au moment de l'effort
  u.flap.rotation.x = lerp(-0.95, -1.65, smoothstep(0.03, 0.1, p));
}

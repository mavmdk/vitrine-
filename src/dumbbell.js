/* L'haltère : têtes hexagonales arrondies en béton/caoutchouc recyclé,
   poignée chromée moletée, marquage UPWARD gravé. */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as TEX from './textures.js';

export const DUMBBELL_RADIUS = 0.19;   // demi-hauteur d'une tête, sert aux collisions

export function createDumbbell() {
  const g = new THREE.Group();
  g.name = 'dumbbell';

  const concrete = TEX.concreteSet(512);
  concrete.map.repeat.set(1.6, 1.6);
  concrete.normalMap.repeat.set(1.6, 1.6);

  const headMat = new THREE.MeshStandardMaterial({
    map: concrete.map,
    normalMap: concrete.normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.0,
    envMapIntensity: 1.0
  });

  const chrome = new THREE.MeshStandardMaterial({
    color: 0xd8dce2, roughness: 0.22, metalness: 1.0, envMapIntensity: 1.3
  });
  const knurl = new THREE.MeshStandardMaterial({
    color: 0xc9ced5, roughness: 0.38, metalness: 1.0,
    normalMap: TEX.knurlNormal(256),
    normalScale: new THREE.Vector2(0.9, 0.9),
    envMapIntensity: 1.2
  });
  knurl.normalMap.repeat.set(6, 2);

  const HEAD = 0.30;
  const headGeo = new RoundedBoxGeometry(HEAD, HEAD, HEAD, 6, 0.082);

  const stampArrow = TEX.stampTexture('arrow', 256);
  const stampWeight = TEX.stampTexture('weight', 256);

  [-1, 1].forEach((side) => {
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.x = side * 0.235;
    head.castShadow = true;
    head.receiveShadow = true;
    g.add(head);

    // marquages gravés sur les faces avant/arrière
    const tex = side < 0 ? stampWeight : stampArrow;
    [1, -1].forEach((face) => {
      const stamp = new THREE.Mesh(
        new THREE.PlaneGeometry(HEAD * 0.62, HEAD * 0.62),
        new THREE.MeshStandardMaterial({
          map: tex, transparent: true, roughness: 0.55, metalness: 0.0,
          depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3
        })
      );
      stamp.position.set(side * 0.235, 0, face * (HEAD / 2 + 0.001));
      stamp.rotation.y = face > 0 ? 0 : Math.PI;
      g.add(stamp);
    });

    // collerette chromée à la jonction
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 20), chrome);
    collar.rotation.z = Math.PI / 2;
    collar.position.x = side * 0.085;
    collar.castShadow = true;
    g.add(collar);
  });

  // poignée moletée
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.17, 24), knurl);
  grip.rotation.z = Math.PI / 2;
  grip.castShadow = true;
  g.add(grip);

  // bagues noires (le détail qui rend l'objet lisible)
  [-0.055, -0.018, 0.018, 0.055].forEach((x) => {
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0335, 0.0335, 0.012, 20),
      new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.42, metalness: 0.4 })
    );
    ring.rotation.z = Math.PI / 2;
    ring.position.x = x;
    g.add(ring);
  });

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.32, 18), chrome);
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);

  return g;
}

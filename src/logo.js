/* Le logo UPWARD qui jaillit du sol après l'impact. */

import * as THREE from 'three';
import * as TEX from './textures.js';

export function createLogo() {
  const g = new THREE.Group();
  g.name = 'logo';

  const tex = TEX.upwardLogo(1024, 256);
  const W = 7.2, H = 1.8;

  // ombre portée fake, décalée derrière : donne l'épaisseur
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: 0x000000, opacity: 0.42, depthWrite: false })
  );
  back.position.set(0.03, -0.03, -0.05);
  g.add(back);

  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  g.add(front);

  // halo diffus derrière la marque
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: TEX.dotSprite(128), color: 0xc8863f, transparent: true,
    opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  glow.scale.set(8.5, 3.6, 1);
  glow.position.z = -0.4;
  g.add(glow);

  g.userData = { front, back, glow };
  g.visible = false;
  return g;
}

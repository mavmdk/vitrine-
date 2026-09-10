/* UPWARD — vitrine scrollytelling
   Chaîne complète : ciel physique -> montagne -> chute de l'haltère ->
   traversée des nuages -> impact magnésie -> logo. */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import * as TEX from './textures.js';
import * as W from './world.js';
import { createClimber, poseClimber } from './climber.js';
import { createDumbbell, DUMBBELL_RADIUS } from './dumbbell.js';
import { createLogo } from './logo.js';
import { Burst, Trail, createChalkCloud, createShockwave } from './fx.js';
import { buildPath, spinAt, cameraAt, atmosphereAt, P } from './timeline.js';
import { clamp, smoothstep, lerp } from './noise.js';

const CLIMBER_X = 6, CLIMBER_Z = 210;   // pente locale ~48° : une face raide mais praticable
const AGE_ROCK = 26;      // conversion scroll -> secondes pour les impacts roche
const AGE_CHALK = 15;

const canvas = document.getElementById('scene');
const loaderEl = document.getElementById('loader');
const loaderBar = loaderEl.querySelector('.loader__bar i');
const flashEl = document.getElementById('flash');
const hintEl = document.getElementById('scrollhint');
const chapters = [...document.querySelectorAll('.chapter')].map((el) => ({
  el,
  panel: el.querySelector('.panel'),
  from: parseFloat(el.dataset.from),
  to: parseFloat(el.dataset.to)
}));

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = window.innerWidth < 820 || navigator.hardwareConcurrency <= 4;

/* ------------------------------------------------------------- renderer */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.35 : 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xbcd3e8, 0.0012);

const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 8000);
camera.position.set(0, 240, 130);

const composer = new EffectComposer(
  renderer,
  new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: THREE.HalfFloatType,
    samples: lowPower ? 0 : 4
  })
);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight), 0.28, 0.55, 0.86
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* --------------------------------------------------------------- montage */
const mountainGroup = new THREE.Group();
scene.add(mountainGroup);

let sunLight, climber, dumbbell, path, logo, gym, impactChalk;
const sunDir = new THREE.Vector3();
let cloudSea, fallClouds, trail, chalk, shockwave;
const rockBursts = [];
const snowBursts = [];

const step = (n, label) => new Promise((res) => {
  loaderBar.style.width = `${n}%`;
  loaderEl.querySelector('.loader__hint').textContent = label;
  requestAnimationFrame(() => setTimeout(res, 0));
});

async function build() {
  await step(8, 'ciel & lumière');

  const { sun, envMap } = W.createSky(renderer, scene);
  scene.environment = envMap;

  sunLight = new THREE.DirectionalLight(0xfff1dc, 7.6);
  sunDir.copy(sun).normalize();
  sunLight.position.copy(sunDir).multiplyScalar(300);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 220;
  sunLight.shadow.camera.left = -22;
  sunLight.shadow.camera.right = 22;
  sunLight.shadow.camera.top = 22;
  sunLight.shadow.camera.bottom = -22;
  sunLight.shadow.bias = -0.0008;
  sunLight.shadow.normalBias = 0.05;
  scene.add(sunLight, sunLight.target);

  // la neige renvoie énormément de lumière : le rebond au sol est presque aussi
  // clair que le ciel, c'est ce qui empêche les ombres de virer au noir
  const bounce = new THREE.HemisphereLight(0xa9cdf6, 0xb3bcc6, 0.62);
  scene.add(bounce);

  await step(24, 'roche & neige');
  const rockTex = TEX.rockSet(lowPower ? 256 : 512);

  await step(46, 'modelage du relief');
  mountainGroup.add(W.createMountain(rockTex));
  mountainGroup.add(W.createCliff(CLIMBER_X, CLIMBER_Z + 95, rockTex));
  mountainGroup.add(W.createDistantRange());

  await step(62, 'nuages');
  const smokeTex = TEX.smokeSprite(256);
  const dotTex = TEX.dotSprite(64);
  cloudSea = W.createCloudSea(smokeTex);
  mountainGroup.add(cloudSea);

  await step(72, 'cordée');
  climber = createClimber('PAULINE');
  const groundY = W.surfaceHeight(CLIMBER_X, CLIMBER_Z);
  climber.position.set(CLIMBER_X, groundY, CLIMBER_Z);
  // il s'appuie dans la pente
  const n = W.surfaceNormal(CLIMBER_X, CLIMBER_Z);
  climber.rotation.x = -Math.atan2(n.z, n.y) * 0.45;
  climber.rotation.y = 0.12;
  mountainGroup.add(climber);

  await step(84, 'matériel');
  dumbbell = createDumbbell();
  scene.add(dumbbell);

  const anchorWorld = new THREE.Vector3();
  climber.updateWorldMatrix(true, true);
  climber.userData.anchor.getWorldPosition(anchorWorld);
  path = buildPath(anchorWorld);

  fallClouds = W.createFallClouds(smokeTex, { x: path.last.pos.x, z: path.last.pos.z + 20 });
  mountainGroup.add(fallClouds);

  // une bouffée d'éclats + poudreuse par rebond
  path.impacts.forEach((imp, i) => {
    const rock = new Burst({
      count: 26, size: 0.10, texture: dotTex, color: 0x4a4640, speed: 7.5,
      gravity: -16, drag: 0.9, life: 1.1, opacity: 0.95, seed: 100 + i, up: 0.85
    });
    rock.setOrigin(imp.pos);
    const snow = new Burst({
      count: 34, size: 0.75, texture: smokeTex, color: 0xf2f7ff, speed: 4.4,
      gravity: -3.4, drag: 2.2, life: 1.5, opacity: 0.8, seed: 500 + i, up: 0.75, grow: 1.5
    });
    snow.setOrigin(imp.pos);
    rockBursts.push(rock);
    snowBursts.push(snow);
    mountainGroup.add(rock.points, snow.points);
  });

  trail = new Trail(smokeTex, lowPower ? 26 : 44);
  mountainGroup.add(trail.points);

  await step(94, 'la box');
  gym = W.createGym();
  scene.add(gym);
  impactChalk = gym.getObjectByName('impactChalk');

  chalk = createChalkCloud(smokeTex);
  chalk.layers.forEach((l) => l.setOrigin(new THREE.Vector3(0, 0.22, 0)));
  gym.add(chalk.group);

  shockwave = createShockwave(TEX.chalkPatch(256));
  shockwave.position.set(0, 0.05, 0);
  gym.add(shockwave);

  logo = createLogo();
  logo.position.set(0, -1.4, 0);
  gym.add(logo);

  await step(100, 'prêt');
  loaderEl.classList.add('is-done');
}

/* ------------------------------------------------------------- scroll */
let pTarget = 0, pSmooth = 0;
function readScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  pTarget = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
}
window.addEventListener('scroll', readScroll, { passive: true });
readScroll();

function updateChapters(p) {
  for (const c of chapters) {
    const inRange = p >= c.from - 0.03 && p <= c.to + 0.03;
    c.el.classList.toggle('is-live', inRange);
    if (!inRange) { c.panel.style.opacity = 0; continue; }
    const fadeIn = smoothstep(c.from - 0.022, c.from + 0.016, p);
    const fadeOut = 1 - smoothstep(c.to - 0.016, c.to + 0.022, p);
    const a = fadeIn * fadeOut;
    c.el.style.opacity = a > 0.001 ? 1 : 0;
    c.panel.style.opacity = a;
    c.panel.style.transform = `translate3d(0, ${(1 - a) * 46}px, 0)`;
  }
  hintEl.classList.toggle('is-hidden', p > 0.015);
}

/* ------------------------------------------------------------- boucle */
const camState = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 34 };
const dumbPos = new THREE.Vector3();
const anchorWorld = new THREE.Vector3();
const anchorQuat = new THREE.Quaternion();
const stowQuat = new THREE.Quaternion();
const stowEuler = new THREE.Euler();
const packUp = new THREE.Vector3();
const helmetWorld = new THREE.Vector3();
const quat = new THREE.Quaternion();
const clock = new THREE.Clock();
let time = 0;

function update(p, dt) {
  time += dt;

  /* --- haltère : dans le sac, puis en chute --- */
  if (p <= P.release) {
    climber.updateWorldMatrix(true, true);
    const anchor = climber.userData.anchor;
    anchor.getWorldPosition(anchorWorld);
    anchor.getWorldQuaternion(anchorQuat);
    // elle glisse le long de l'axe du sac, pas de l'axe du monde :
    // le dos est incliné, l'haltère doit l'être aussi
    packUp.set(0, 1, 0).applyQuaternion(anchorQuat);
    const slip = smoothstep(0.04, P.release, p);
    dumbPos.copy(anchorWorld).addScaledVector(packUp, slip * 0.34);
  } else {
    path.sample(p, dumbPos);
  }
  dumbbell.position.copy(dumbPos);
  if (p <= P.release) {
    // rangée verticalement dans le sac : elle ne dépasse pas
    // rangée dans le sac : elle suit l'orientation du sac
    const slip = smoothstep(0.04, P.release, p);
    stowEuler.set(0.10 + slip * 0.55, 0.34, Math.PI / 2 - slip * 0.30);
    stowQuat.setFromEuler(stowEuler);
    dumbbell.quaternion.copy(anchorQuat).multiply(stowQuat);
  } else {
    spinAt(p, quat);
    dumbbell.quaternion.copy(quat);
  }

  poseClimber(climber, p, time);

  /* --- caméra --- */
  climber.userData.helmet.getWorldPosition(helmetWorld);
  cameraAt(p, time, { climber: climber.position, helmet: helmetWorld, dumbbell: dumbPos, path }, camState);
  camera.position.copy(camState.pos);
  camera.lookAt(camState.look);
  if (Math.abs(camera.fov - camState.fov) > 0.01) {
    camera.fov = camState.fov;
    camera.updateProjectionMatrix();
  }

  /* --- atmosphère --- */
  const atm = atmosphereAt(p);
  scene.fog.color.copy(atm.fogColor);
  scene.fog.density = atm.fogDensity;
  scene.background = null;
  renderer.toneMappingExposure = atm.exposure;
  bloom.strength = atm.bloom;
  sunLight.intensity = 7.6 * atm.sunIntensity;
  if ('environmentIntensity' in scene) {
    scene.environmentIntensity = p < P.cut ? 1 : 0.22;
  }

  // l'ombre du soleil suit le sujet
  if (p < P.cloudEnter) {
    sunLight.target.position.copy(p < P.release + 0.05 ? climber.position : dumbPos);
    sunLight.position.copy(sunLight.target.position).addScaledVector(sunDir, 140);
    sunLight.target.updateMatrixWorld();
  }

  /* --- bascule montagne / box --- */
  const inGym = p >= P.cut;
  mountainGroup.visible = !inGym;
  gym.visible = inGym;

  /* --- nuages --- */
  if (!inGym) {
    const t = time * 0.06;
    cloudSea.children.forEach((s, i) => {
      s.position.x += Math.sin(t + i) * 0.006;
    });
    fallClouds.visible = p > 0.36;
  }

  /* --- impacts sur la roche --- */
  for (let i = 0; i < path.impacts.length; i++) {
    const age = (p - path.impacts[i].p) * AGE_ROCK;
    rockBursts[i].update(age);
    snowBursts[i].update(age);
  }

  /* --- traînée --- */
  const trailStrength = smoothstep(P.release, P.release + 0.03, p) * (1 - smoothstep(P.cloudEnter, P.cut, p));
  trail.update(p, (q, out) => path.sample(q, out), trailStrength);

  /* --- impact magnésie --- */
  const hit = (p - P.land) * AGE_CHALK;
  chalk.layers.forEach((l) => l.update(hit));

  const sw = clamp((p - P.land) / 0.05, 0, 1);
  shockwave.visible = sw > 0 && sw < 1;
  if (shockwave.visible) {
    const s = 0.6 + sw * 9;
    shockwave.scale.set(s, s, 1);
    shockwave.material.opacity = (1 - sw) * 0.28;
  }
  impactChalk.material.opacity = smoothstep(P.land, P.land + 0.02, p) * 0.55;

  /* flash d'impact */
  const flash = Math.max(0, 1 - Math.abs(p - P.land) / 0.012);
  flashEl.style.background = flash > 0.01
    ? `radial-gradient(120% 90% at 50% 45%, rgba(255,255,255,${flash * 0.55}) 0%, rgba(0,0,0,.45) 100%)`
    : 'radial-gradient(120% 90% at 50% 45%, rgba(0,0,0,0) 42%, rgba(0,0,0,.55) 100%)';

  /* --- le logo jaillit du sol --- */
  const ls = clamp((p - P.logo) / 0.085, 0, 1);
  logo.visible = ls > 0;
  if (logo.visible) {
    // rebond élastique : il sort du sol et oscille avant de se poser
    const e = ls === 1 ? 1 : 1 - Math.pow(2, -9 * ls) * Math.cos((ls * 10 - 0.85) * 2.6);
    logo.position.y = lerp(-1.4, 5.30, clamp(e, -0.2, 1.18));
    logo.rotation.x = (1 - ls) * -0.35;
    logo.userData.front.material.opacity = smoothstep(0, 0.25, ls);
    logo.userData.back.material.opacity = smoothstep(0, 0.25, ls) * 0.55;
    logo.userData.glow.material.opacity = smoothstep(0.1, 0.7, ls) * 0.22;
  }
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  pSmooth = reduced ? pTarget : lerp(pSmooth, pTarget, 1 - Math.exp(-dt * 7.5));
  if (path) update(pSmooth, dt);
  updateChapters(pSmooth);
  composer.render();
  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
});

// aide au réglage : ?p=0.42 saute directement à une étape
const deep = parseFloat(new URLSearchParams(location.search).get('p'));

build().then(() => {
  window.__UP = { scene, camera, get p() { return pSmooth; }, dumbPos, path };
  if (!Number.isNaN(deep)) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, max * clamp(deep, 0, 1));
    readScroll();
    pSmooth = pTarget;
  }
  clock.start();
  requestAnimationFrame(tick);
}).catch((err) => {
  // pas de WebGL, pilote refusé, mémoire insuffisante : on bascule en page statique
  console.error(err);
  document.body.classList.add('no3d');
  loaderEl.classList.add('is-done');
  hintEl.remove();
});

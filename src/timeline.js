/* La chorégraphie : trajectoire de l'haltère, caméra, atmosphère.
   Tout est fonction du scroll normalisé p ∈ [0,1] — donc scrubable dans les deux sens. */

import * as THREE from 'three';
import { surfaceHeight, WORLD } from './world.js';
import { DUMBBELL_RADIUS } from './dumbbell.js';
import { clamp, smoothstep, lerp, rng } from './noise.js';

export const P = {
  release: 0.105,     // l'haltère quitte le sac
  cloudEnter: 0.455,  // entrée dans la mer de nuages
  cut: 0.615,         // bascule montagne -> box crossfit (écran plein gris)
  land: 0.782,        // impact sur la magnésie
  logo: 0.858,        // le logo jaillit du sol
  end: 1.0
};

const GYM_ENTRY_Y = 12.5;   // hauteur à laquelle l'haltère réapparaît sous les nuages
const _v = new THREE.Vector3();

/* ------------------------------------------------ trajectoire rebondissante */
export function buildPath(start) {
  const rand = rng(1234);
  const stations = [{ pos: start.clone(), hop: 0 }];

  let x = start.x, z = start.z;
  const steps = [3.5, 5, 7, 9, 12, 15, 19, 24, 30, 37];
  for (const dz of steps) {
    z += dz;
    x += (rand() - 0.5) * dz * 0.55;
    const y = surfaceHeight(x, z) + 0.85;   // garde au sol : elle reste lisible
    // hauteur du rebond : quelques dizaines de centimètres, pas dix mètres
    stations.push({ pos: new THREE.Vector3(x, y, z), hop: 1.3 + rand() * 2.4 });
  }

  const lens = [];
  let total = 0;
  for (let i = 1; i < stations.length; i++) {
    const l = Math.pow(stations[i].pos.distanceTo(stations[i - 1].pos), 0.82);
    lens.push(l);
    total += l;
  }
  let acc = 0;
  stations[0].p = P.release;
  for (let i = 1; i < stations.length; i++) {
    acc += lens[i - 1];
    stations[i].p = lerp(P.release, P.cloudEnter, acc / total);
  }

  const last = stations[stations.length - 1];
  const cloudEnd = new THREE.Vector3(last.pos.x + 8, WORLD.cloudBottom - 30, last.pos.z + 40);
  const impacts = stations.slice(1).map((s) => ({ p: s.p, pos: s.pos.clone() }));

  function sample(p, out) {
    out = out || _v;

    if (p <= P.release) return out.copy(stations[0].pos);

    /* 1. rebonds sur la face */
    if (p < P.cloudEnter) {
      let i = 0;
      while (i < stations.length - 2 && p > stations[i + 1].p) i++;
      const a = stations[i], b = stations[i + 1];
      const s = clamp((p - a.p) / Math.max(1e-5, b.p - a.p), 0, 1);
      out.lerpVectors(a.pos, b.pos, s);
      // parabole entre deux impacts (le premier saut sort du sac, plus mou)
      const hop = i === 0 ? 0.35 : b.hop;
      out.y += hop * 4 * s * (1 - s);
      return out;
    }

    /* 2. chute libre dans les nuages */
    if (p < P.cut) {
      const s = (p - P.cloudEnter) / (P.cut - P.cloudEnter);
      out.lerpVectors(last.pos, cloudEnd, s * s * 0.8 + s * 0.2);
      return out;
    }

    /* 3. box crossfit — repère local recalé sur WORLD.gym.
          La coupure est invisible : l'écran est entièrement gris à cet instant. */
    const g = WORLD.gym;
    if (p < P.land) {
      const s = (p - P.cut) / (P.land - P.cut);
      const y = lerp(GYM_ENTRY_Y, DUMBBELL_RADIUS, s * s);   // accélération de la pesanteur
      out.set(g.x + lerp(-0.9, 0, s), g.y + y, g.z + lerp(1.1, 0, s));
      return out;
    }

    /* 4. impact : un rebond court puis repos */
    const s = clamp((p - P.land) / 0.07, 0, 1);
    const bounce = Math.abs(Math.sin(s * Math.PI * 1.7)) * (1 - s) * 0.55;
    out.set(g.x, g.y + DUMBBELL_RADIUS + bounce, g.z + s * 0.26);
    return out;
  }

  return { stations, impacts, sample, cloudEnd, last, entryY: GYM_ENTRY_Y };
}

/* ---------------------------------------------------------------- rotation */
const _qSpin = new THREE.Quaternion();
const _qRest = new THREE.Quaternion();
const _eSpin = new THREE.Euler();
const _eRest = new THREE.Euler(0.0, 0.42, 0.0);

export function spinAt(p, out) {
  const s = clamp((p - P.release) / (P.land - P.release), 0, 1);
  const eased = 1 - Math.pow(1 - s, 1.85);
  const a = eased * Math.PI * 2 * 19;
  _eSpin.set(a * 1.0, a * 0.19, a * 0.44);
  _qSpin.setFromEuler(_eSpin);
  _qRest.setFromEuler(_eRest);
  const settle = smoothstep(P.land - 0.008, P.land + 0.05, p);
  return out.copy(_qSpin).slerp(_qRest, settle);
}

/* ---------------------------------------------------------------- caméra */
const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();
const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();

function handheld(time, amp, out) {
  out.set(
    Math.sin(time * 1.13) * 0.6 + Math.sin(time * 2.71) * 0.25,
    Math.sin(time * 0.87 + 1.4) * 0.5 + Math.sin(time * 3.13) * 0.18,
    Math.sin(time * 0.61 + 0.7) * 0.4
  ).multiplyScalar(amp);
  return out;
}

export function cameraAt(p, time, ctx, out) {
  const { climber, helmet, dumbbell, path } = ctx;
  const g = WORLD.gym;

  /* --- A. deux temps.
     A0 : macro sur le casque — on lit « PAULINE ♥ ».
     A1 : recul au téléobjectif, le sommet écrase le grimpeur. */
  const pull = smoothstep(0.038, 0.098, p);

  // calé sur la position réelle du casque, et dans l'axe de l'étiquette
  // (le casque bascule avec la nuque : viser une hauteur fixe ne marche pas)
  // de plain-pied avec le casque : le sac reste sous l'axe et n'occulte rien
  // côté soleil : le casque doit être éclairé pour que l'étiquette se lise
  const closeP = _tmpA.set(
    helmet.x + 0.78,
    helmet.y + 0.42,
    helmet.z + 2.36
  );
  const wideP = _tmpB.set(
    climber.x + 3.6,
    climber.y - 13.0,
    climber.z + 15.5
  );
  _pos.copy(closeP).lerp(wideP, pull);

  const closeL = _tmpA.set(helmet.x - 0.46, helmet.y + 0.12, helmet.z);
  const wideL = _tmpB.set(climber.x - 1.5, climber.y + 3.5, climber.z + 0.2);
  _look.copy(closeL).lerp(wideL, pull);

  let fov = lerp(29, 30, pull);
  let shake = lerp(0.006, 0.02, pull);

  /* --- B. la caméra décroche et suit l'haltère --- */
  const follow = smoothstep(P.release, P.release + 0.06, p);
  if (follow > 0) {
    const chase = smoothstep(0.18, 0.42, p);
    _tmpB.copy(dumbbell).add(_tmpA.set(
      lerp(1.4, 2.1, chase),
      lerp(2.0, 2.9, chase),      // au-dessus : le relief ne masque jamais l'objet
      lerp(3.4, 5.0, chase)
    ));
    _pos.lerp(_tmpB, follow);

    // on vise l'objet, avec juste un soupçon d'avance : au-delà, il sort du cadre
    path.sample(Math.min(P.cloudEnter, p + 0.004), _tmpB);
    _tmpB.lerpVectors(dumbbell, _tmpB, 0.35);
    _tmpB.y -= 0.15;
    _look.lerp(_tmpB, follow);
    fov = lerp(fov, 48, follow);
    shake = lerp(shake, 0.07, follow);
  }

  /* --- C. dans les nuages : plan très serré --- */
  const inCloud = smoothstep(P.cloudEnter - 0.02, P.cloudEnter + 0.07, p);
  if (inCloud > 0) {
    _tmpB.copy(dumbbell).add(_tmpA.set(0.85, 1.05, 1.9));
    _pos.lerp(_tmpB, inCloud);
    _look.lerp(dumbbell, inCloud);
    fov = lerp(fov, 54, inCloud);
  }

  /* --- D. box crossfit : caméra basse, on suit l'objet qui tombe --- */
  if (p >= P.cut) {
    const drop = clamp((p - P.cut) / (P.land - P.cut), 0, 1);
    const fin = smoothstep(P.logo - 0.01, 0.97, p);

    // position : légère poussée vers l'avant pendant la chute
    _pos.set(
      g.x + lerp(4.6, 3.5, drop),
      g.y + lerp(1.9, 1.15, drop),
      g.z + lerp(7.6, 6.0, drop)
    );
    // on suit l'haltère, puis on redescend sur le point d'impact
    _look.copy(dumbbell);
    _look.y = lerp(dumbbell.y, g.y + 0.45, smoothstep(0.55, 1.0, drop));

    // recul + montée pour cadrer la marque
    _tmpB.set(g.x, g.y + 5.2, g.z + 15.4);
    _pos.lerp(_tmpB, fin);
    _tmpB.set(g.x, g.y + 5.1, g.z);
    _look.lerp(_tmpB, fin);

    fov = lerp(46, 36, fin);
    shake = lerp(0.045, 0.006, Math.max(drop * 0.5, fin));
  }

  handheld(time, shake, _tmpA);
  out.pos.copy(_pos).add(_tmpA);
  out.look.copy(_look).add(_tmpA.multiplyScalar(0.3));
  out.fov = fov;
  return out;
}

/* ------------------------------------------------------------- atmosphère */
const _fogColor = new THREE.Color();
const SKY_FOG = new THREE.Color(0xa9c6e4);
const GREY_FOG = new THREE.Color(0xb0b5bb);
const GYM_FOG = new THREE.Color(0x0b0d11);
const CHALK_FOG = new THREE.Color(0xd2d7dd);

export function atmosphereAt(p) {
  const toGrey = smoothstep(0.36, P.cloudEnter + 0.05, p);
  const chalk = smoothstep(P.land, P.land + 0.014, p) * (1 - smoothstep(P.land + 0.02, P.land + 0.085, p));

  let density, exposure, bloom;

  if (p < P.cut) {
    _fogColor.copy(SKY_FOG).lerp(GREY_FOG, toGrey);
    // très dense : dans le nuage, on ne doit plus voir que du gris, y compris
    // la roche à trois mètres — un brouillard "réaliste" ne suffit pas ici
    density = lerp(0.0011, 0.30, toGrey * toGrey);
    exposure = lerp(0.72, 0.95, toGrey);
    bloom = lerp(0.30, 0.55, toGrey);
  } else {
    const out = smoothstep(P.cut, P.cut + 0.05, p);
    _fogColor.copy(GREY_FOG).lerp(GYM_FOG, out);
    _fogColor.lerp(CHALK_FOG, chalk * 0.45);
    density = lerp(0.30, 0.013, out) + chalk * 0.010;
    exposure = lerp(0.95, 1.0, out);
    bloom = lerp(0.55, 0.30, out);
  }

  return {
    fogColor: _fogColor,
    fogDensity: density,
    exposure,
    bloom,
    sunIntensity: 1 - smoothstep(0.40, P.cloudEnter + 0.08, p),
    grey: toGrey
  };
}

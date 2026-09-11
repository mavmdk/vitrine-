#!/usr/bin/env node
/**
 * Reconstruit toutes les variantes d'images de la vitrine.
 *
 * Pour chaque emplacement, si `assets/img/<emplacement>.jpg` existe, ce script
 * régénère :
 *   <emplacement>.webp       grande largeur
 *   <emplacement>@<n>.webp   largeur mobile
 * et redimensionne le JPEG de repli s'il est plus large que nécessaire.
 *
 * C'est ce script que lance l'automatisation GitHub : il suffit de déposer un
 * JPEG au bon nom dans assets/img/ pour que le reste se fabrique tout seul.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); }
catch { console.error('sharp manquant :  npm install sharp'); process.exit(1); }

const EMPLACEMENTS = {
  'ascension-7300':  [1700, 1000],
  'crossfit-barre':  [1400, 900],
  'terrain-glacier': [1920, 1200],
  'ama-dablam':      [1400, 900],
  'magnesie-mains':  [1760, 1100],
  'hero-k2':         [1600, 1100],
  'crossfit-salle':  [1400, 800]
};

const DIR = 'assets/img';
const TMP = '.img-tmp';
let touchees = 0;

fs.mkdirSync(TMP, { recursive: true });

for (const [nom, [large, mobile]] of Object.entries(EMPLACEMENTS)) {
  const src = path.join(DIR, `${nom}.jpg`);
  if (!fs.existsSync(src)) { console.log(`— ${nom} : pas de JPEG source, ignoré`); continue; }

  const meta = await sharp(src).metadata();
  const cible = Math.min(large, meta.width);

  await sharp(src).resize({ width: cible, withoutEnlargement: true })
    .webp({ quality: 76, effort: 5 }).toFile(path.join(DIR, `${nom}.webp`));
  await sharp(src).resize({ width: Math.min(mobile, meta.width), withoutEnlargement: true })
    .webp({ quality: 76, effort: 5 }).toFile(path.join(DIR, `${nom}@${mobile}.webp`));

  // le JPEG de repli ne doit pas rester en pleine résolution d'appareil photo
  if (meta.width > large + 40) {
    const tmp = path.join(TMP, `${nom}.jpg`);
    await sharp(src).resize({ width: large, withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true, progressive: true }).toFile(tmp);
    fs.copyFileSync(tmp, src);
    console.log(`✓ ${nom} : ${meta.width}px → ${large}px + webp`);
  } else {
    console.log(`✓ ${nom} : webp régénérés (source ${meta.width}px)`);
  }
  touchees++;
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${touchees} emplacement(s) traité(s).`);

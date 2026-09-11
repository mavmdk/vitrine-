#!/usr/bin/env node
/**
 * Prépare une photo pour la vitrine UPWARD.
 *
 *   node tools/images.mjs <emplacement> <chemin/vers/ma-photo.jpg>
 *   node tools/images.mjs --list
 *
 * Génère, aux bonnes dimensions et au bon nom :
 *   assets/img/<emplacement>.webp        grande largeur
 *   assets/img/<emplacement>@<n>.webp    largeur mobile
 *   assets/img/<emplacement>.jpg         repli pour les vieux navigateurs
 *
 * Le fichier source n'est jamais modifié.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/* sharp n'est chargé qu'au moment d'encoder : consulter la liste des
   emplacements ne doit rien exiger. */
function chargerSharp() {
  try { return require('sharp'); }
  catch {
    console.error("\nsharp n'est pas installé. Depuis le dossier du projet :\n\n  npm install sharp\n");
    process.exit(1);
  }
}

/* Les emplacements de la page et la largeur attendue pour chacun.
   [grande largeur, largeur mobile] */
const EMPLACEMENTS = {
  'accueil-montagne': [1600, 1000, "accueil — volet droit (la montagne)"],
  'accueil-box':      [1400, 900,  "accueil — volet gauche (la box)"],
  'terrain-glacier':  [1920, 1200, "étape 01 — diagnostic"],
  'crossfit-barre':   [1400, 900,  "étape 02 — programme personnalisé"],
  'ama-dablam':       [1400, 900,  "étape 04 — traverser le brouillard"],
  'magnesie-mains':   [1760, 1100, "étape 05 — bandeau pleine largeur"],
  'hero-k2':          [1600, 1100, "étape 06 — résultats mesurés"],
  'crossfit-salle':   [1400, 800,  "vignette du menu déroulant"]
};

const QUALITE_WEBP = 76;
const QUALITE_JPEG = 72;

function liste() {
  console.log('\nEmplacements disponibles :\n');
  for (const [nom, [g, m, role]] of Object.entries(EMPLACEMENTS)) {
    console.log(`  ${nom.padEnd(17)} ${String(g).padStart(4)}px / ${String(m).padStart(4)}px   ${role}`);
  }
  console.log('\nExemple :\n  node tools/images.mjs crossfit-barre ~/Photos/ma-seance.jpg\n');
}

const [, , emplacement, source] = process.argv;

if (!emplacement || emplacement === '--list' || emplacement === '-l') { liste(); process.exit(0); }

if (!EMPLACEMENTS[emplacement]) {
  console.error(`\nEmplacement inconnu : « ${emplacement} »`);
  liste();
  process.exit(1);
}
if (!source || !fs.existsSync(source)) {
  console.error(`\nFichier introuvable : ${source || '(aucun chemin donné)'}\n`);
  process.exit(1);
}

const [large, mobile] = EMPLACEMENTS[emplacement];
const DEST = 'assets/img';
fs.mkdirSync(DEST, { recursive: true });

const sharp = chargerSharp();
const meta = await sharp(source).metadata();
if (meta.width < large) {
  console.warn(`\n  Attention : la source fait ${meta.width}px de large, l'emplacement en attend ${large}px.`);
  console.warn(`  L'image ne sera pas agrandie ; elle risque de manquer de définition sur grand écran.\n`);
}

const ecrits = [];
async function ecrire(nom, fn) {
  await fn(path.join(DEST, nom));
  const ko = Math.round(fs.statSync(path.join(DEST, nom)).size / 1024);
  ecrits.push([nom, ko]);
}

await ecrire(`${emplacement}.webp`, (out) =>
  sharp(source).resize({ width: large, withoutEnlargement: true }).webp({ quality: QUALITE_WEBP, effort: 5 }).toFile(out));
await ecrire(`${emplacement}@${mobile}.webp`, (out) =>
  sharp(source).resize({ width: mobile, withoutEnlargement: true }).webp({ quality: QUALITE_WEBP, effort: 5 }).toFile(out));
await ecrire(`${emplacement}.jpg`, (out) =>
  sharp(source).resize({ width: large, withoutEnlargement: true }).jpeg({ quality: QUALITE_JPEG, mozjpeg: true, progressive: true }).toFile(out));

console.log(`\n${emplacement} — ${EMPLACEMENTS[emplacement][2]}`);
for (const [nom, ko] of ecrits) console.log(`  ${nom.padEnd(30)} ${String(ko).padStart(4)} ko`);
console.log(`\nTotal ${ecrits.reduce((a, [, k]) => a + k, 0)} ko. Rechargez la page, c'est en place.`);
console.log(`Pensez à mettre à jour le crédit dans CREDITS.md et le pied de page si la photo change d'auteur.\n`);

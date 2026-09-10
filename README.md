# vitrine

Vitrine scrollytelling 3D pour la marque de coaching sportif **UPWARD**.

## Le principe

Une seule page. Plus on descend, plus la scène se transforme :

| Scroll | Scène |
|---|---|
| 0 → 10 % | Plan serré sur un alpiniste, de dos, sur une face enneigée. Son casque porte « PAULINE ♥ ». |
| 10 → 45 % | Une haltère s'échappe de son sac, dévale la face, rebondit sur la roche (éclats + poudreuse à chaque impact). |
| 45 → 62 % | Traversée de la mer de nuages : l'écran devient entièrement gris. |
| 62 → 80 % | Sortie sous les nuages : la box crossfit. L'haltère finit sa chute. |
| 80 % | Impact sur un tas de magnésie → explosion de poudre blanche. |
| 86 → 100 % | Le logo UPWARD jaillit du sol et se stabilise. Appel à l'action. |

Les blocs de méthodologie (diagnostic, programme personnalisé, nutrition,
suivi, résultats) apparaissent en alternance à gauche et à droite pendant
toute la descente.

## Technique

- **three.js r169** (embarqué dans `vendor/`, aucun CDN requis).
- Ciel physique (diffusion de Rayleigh/Mie) + env map PMREM générée depuis ce
  ciel : c'est ce qui donne les reflets réalistes sur le chrome et la neige.
- Relief généré proceduralement (bruit ridged multifractal), colorisé par
  pente et altitude, plus une dalle haute densité sous l'alpiniste pour le
  plan rapproché.
- Toutes les textures sont générées en canvas au chargement (roche, neige,
  béton moucheté, moletage chrome, magnésie, sol caoutchouc) : **zéro asset
  binaire dans le dépôt**.
- Rendu : tone mapping ACES filmique, ombres PCF douces, bloom, brouillard
  exponentiel animé, MSAA 4x, grain de film en surimpression.
- Toute l'animation est une **fonction pure du scroll** : on peut scruber en
  avant comme en arrière sans jamais désynchroniser la scène.
- Bruit à base de hash entier (`Math.imul`) plutôt que de `Math.sin` :
  environ 5x plus rapide, c'est ce qui dimensionne le temps de chargement.
- **Repli sans WebGL** : si le rendu 3D échoue (pilote refusé, pas de WebGL),
  la page bascule en version statique — le contenu reste lisible.
- `?p=0.42` dans l'URL saute directement à une étape : pratique pour régler
  un plan sans faire défiler.

## Lancer en local

```bash
npx http-server -p 8080 .
# puis ouvrir http://127.0.0.1:8080
```

Un simple serveur de fichiers statiques suffit (les modules ES imposent
`http://`, un double-clic sur `index.html` ne fonctionnera pas).

## Structure

```
index.html            page + blocs de contenu
assets/css/style.css  interface, panneaux, loader
src/main.js           orchestration, boucle de rendu, scroll
src/world.js          ciel, montagne, falaise, nuages, box crossfit
src/climber.js        l'alpiniste et sa pose animée
src/dumbbell.js       l'haltère
src/timeline.js       trajectoire, caméra, atmosphère
src/fx.js             particules (éclats, poudreuse, magnésie)
src/textures.js       textures procédurales
src/noise.js          bruit fbm / ridged
src/logo.js           la marque qui sort du sol
vendor/three/         three.js r169 + addons
```

## Note sur la marque

L'haltère reprend le design béton/chrome de la référence fournie, mais porte
le marquage **UPWARD** — pas de logo de marque tierce sur un support
commercial.

## À personnaliser avant mise en ligne

- `index.html` : l'adresse du bouton « Réserver mon appel »
  (`mailto:contact@upward.coach`) et le lien « Voir les formules ».
- `src/main.js` : `createClimber('PAULINE')` — le prénom écrit sur le casque.
- `src/world.js` : `WORLD.sunElevation` / `sunAzimuth` pour changer l'heure
  de la journée sur la montagne.
- Les textes des six chapitres sont dans `index.html`, chacun avec sa plage
  de scroll (`data-from` / `data-to`, en fraction de la page).

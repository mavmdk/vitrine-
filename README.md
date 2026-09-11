# UPWARD — vitrine

Site vitrine d'une activité de coaching sportif et de préparation physique.

**Page d'accueil : `index.html`** — page éditoriale statique, photographies
réelles, aucune animation au défilement, aucun JavaScript.

L'accueil est un **diptyque** : la box à gauche, la haute montagne à droite,
l'accroche centrée sur la couture. Les deux volets s'empilent en bandes sur
écran étroit.

## Pourquoi cette forme

La première version de ce dépôt était une expérience 3D pilotée au scroll
(elle reste consultable : `experience.html`). Elle a été écartée : le rendu
temps réel dans un navigateur ne peut pas atteindre le photoréalisme attendu
sur un corps humain, et le prospect d'un coach ne juge pas une démo technique,
il juge la crédibilité. Une photographie réelle bien cadrée fait le travail que
la 3D ne faisait pas.

## Structure

```
index.html              la vitrine
experience.html         l'ancienne version 3D (archivée, fonctionnelle)
assets/css/site.css     l'intégralité du style de la vitrine
assets/fonts/           Inter, auto-hébergée (voir RGPD plus bas)
assets/img/             les photographies, en WebP + repli JPEG
CREDITS.md              attribution des photographies — obligation légale
src/ vendor/            code de l'ancienne version 3D
```

## Ce qui a été décidé et pourquoi

- **Zéro JavaScript.** Pas de dépendance, pas de script à maintenir, pas de
  blocage si un script échoue. La page s'affiche même sur un mobile ancien.
- **Police auto-hébergée.** Charger Google Fonts depuis les serveurs de Google
  transmet l'adresse IP des visiteurs aux États-Unis ; un tribunal allemand
  (Munich, 2022) a jugé cette pratique non conforme au RGPD et d'autres
  décisions ont suivi en Europe. Les fichiers Inter sont donc servis depuis ce
  dépôt.
- **Images en WebP avec repli JPEG**, deux largeurs chacune : 8,8 Mo de sources
  ramenés à 2,1 Mo livrés.
- **Recadrages en CSS** (`object-position`, `transform`), jamais dans les
  fichiers : les photos sous licence CC BY-SA ne sont donc pas modifiées, ce
  qui évite l'obligation de partage à l'identique.
- **Aucun visage identifiable en gros plan.** Le droit d'auteur et le droit à
  l'image sont deux choses distinctes : une photo libre de droits peut montrer
  une personne dont le visage n'est pas exploitable commercialement sans son
  accord. Les cadrages ont été choisis en conséquence — voir `CREDITS.md`.
- **Menu déroulant à vignettes**, en CSS pur : ouverture au survol et au focus
  clavier (`:focus-within`), et accordéon `<details>` sur écran étroit.
- **Pas d'animation au défilement** : la page est lue, pas jouée.

## À personnaliser avant mise en ligne

| Où | Quoi |
|---|---|
| `index.html`, section `formules` | **les trois tarifs** — ils sont volontairement affichés « — € » |
| `index.html`, section `contact` | l'adresse e-mail (`contact@upward.coach`) et le numéro de téléphone |
| `index.html`, pied de page | l'année, la mention légale, la dédicace |
| `index.html`, en-tête | les trois vignettes du menu déroulant |
| `assets/img/` | **vos propres photos** — voir ci-dessous |

### Remplacer une photo

Chaque photo occupe un **emplacement** nommé. Pour en changer, il suffit de
fournir votre fichier : le script fabrique les trois variantes attendues
(grande largeur en WebP, largeur mobile en WebP, repli JPEG) aux bonnes
dimensions et sous les bons noms.

```bash
npm install sharp          # une seule fois
node tools/images.mjs --list                       # voir les emplacements
node tools/images.mjs crossfit-barre ~/photo.jpg   # remplacer une photo
```

| Emplacement | Où il apparaît |
|---|---|
| `ascension-7300` | accueil — volet droit (la montagne) |
| `crossfit-barre` | accueil — volet gauche (la box) et étape 02 |
| `terrain-glacier` | étape 01 — diagnostic |
| `ama-dablam` | étape 04 — traverser le brouillard |
| `magnesie-mains` | étape 05 — bandeau pleine largeur |
| `hero-k2` | étape 06 — résultats mesurés |
| `crossfit-salle` | vignette du menu déroulant |

Le fichier source n'est jamais modifié, et rien d'autre n'est à toucher dans
le code. Pensez simplement à mettre à jour `CREDITS.md` et la ligne de crédits
du pied de page si l'auteur change.

Les cadrages sont pilotés en CSS (`object-position`, `transform`) dans
`assets/css/site.css` : si votre photo doit être recadrée autrement, c'est là
que ça se règle, pas dans le fichier image.

### Les photos livrées

Celles livrées sont des images d'ambiance sous licence libre (Wikimedia
Commons), leur attribution figure dans le pied de page et **doit y rester**.
Elles tiennent la direction artistique, mais ce ne sont pas les vôtres : une
vitrine de coaching convertit sur la preuve — vous, vos clients, votre salle.
Remplacez les fichiers en gardant les mêmes noms, tout suivra.

Détail des licences et des auteurs : [`CREDITS.md`](CREDITS.md).

## Mise en ligne

Le site est entièrement statique : n'importe quel hébergement de fichiers
convient (Netlify, Cloudflare Pages, GitHub Pages, un simple FTP). Aucune
étape de compilation.

En local :

```bash
npx http-server -p 8080 .
```

## L'ancienne version 3D

`experience.html` fonctionne toujours : montagne procédurale, chute d'une
haltère en 3D, traversée des nuages, impact sur la magnésie, logo qui jaillit
du sol. Elle peut servir de page d'ambiance secondaire ou être supprimée
(`experience.html`, `src/`, `vendor/`).

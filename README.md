# AiXel VideoGenerator — reprise en code source (V0 → V0.5)

## Pourquoi cette reconstruction

Le cockpit V0 avait été construit avec Codex (agent ChatGPT), puis exporté en `.zip` pour Netlify.
En l'inspectant, ce zip s'est révélé être une **sortie compilée et minifiée** (framework interne
`vinext`, bundles JS illisibles, aucun fichier source) — impossible à modifier ou à faire évoluer.

Cette version reproduit fidèlement l'écran du cockpit BMW/BNC — MAT (mêmes 12 barrières, même carte
musicale, mêmes alertes, même look sombre cyan/magenta/or) mais en **HTML/CSS/JS vanille, éditable**,
sans étape de build — exactement le même choix technique que pour `aixeln-lyricsgenerator-web`.

## Ce qui est réel vs simulé dans cette V0

- **Réel et fonctionnel** : la navigation entre étapes, la barre de progression, la décision
  artistique Accélérer/Respirer (sélectionnable, modifiable, verrouillable, journalisée avec date
  et attribution à Axel Fisch, réouvrable), tout persisté en `localStorage` — donc le projet reprend
  son état après rechargement, comme dans la version Codex.
- **Simulé pour l'instant** : le fichier audio, la forme d'onde (générée par une formule
  déterministe, pas une vraie analyse), les métriques BPM/durée/crête, la structure en 6 sections,
  le score de préparation, les alertes de continuité et les vignettes de références — toutes ces
  données sont des données de démonstration codées en dur dans `app.js`, en attendant l'étape
  suivante.

## V0.5 — Sources et inventaire (fait)

- **Bibliothèque de projets** : écran d'accueil listant tous les projets, "+ Nouveau projet" opérationnel
  (titre + artiste), plus un sélecteur de projet dans la sidebar pour naviguer entre eux sans repasser
  par l'accueil. BMW/BNC — MAT reste le projet pilote de démonstration ; tout nouveau projet démarre vide.
- **Import réel de sources** : glisser-déposer ou sélection de fichiers (audio, images, paroles
  .txt/.pdf/.docx, vidéo, logos). Classement automatique par catégorie, rôle éditable
  (Source/Référence/Brouillon/Livrable), détection de doublons (même nom + même taille).
- **Stockage local réel** : les fichiers eux-mêmes sont gardés dans IndexedDB (le navigateur, pas
  localStorage — trop petit pour du binaire), donc ils survivent au rechargement de la page, sans
  aucun serveur ni compte. Conforme au principe "gratuit et local tant que c'est soutenable".
- **Barrière verrouillable** comme la carte musicale : "Verrouiller l'inventaire" fige les sources et
  active l'étape suivante (Audio verrouillé), réouvrable à tout moment.

## Prochaine étape (V1 — Préproduction musicale)

Brancher une vraie analyse audio locale (Web Audio API, dans l'esprit de Visual Melody) sur le fichier
audio détecté dans les sources, pour remplacer la forme d'onde et les métriques simulées de la Carte
musicale — et faire de "Audio verrouillé" une étape réellement fonctionnelle plutôt qu'un espace réservé.

## Déployer

Même méthode que pour les autres projets AiXel :

```
cd ~/Developer/aixel-videogenerator-web   # ou l'emplacement choisi
git init
git add .
git commit -m "V0 — cockpit reconstruit en code source"
gh repo create axelfisch/aixel-videogenerator-web --public --source=. --push
# (ou créer le dépôt sur github.com puis git remote add origin ... && git push -u origin main)

npx netlify-cli init
npx netlify-cli deploy --prod
```

## Structure des fichiers

- `index.html` — coquille de la page
- `styles.css` — thème sombre cyan/magenta/or, layout 3 colonnes responsive
- `app.js` — état, rendu, logique (state/render/persist, comme aixeln-lyricsgenerator-web)
- `netlify.toml` — déploiement statique simple

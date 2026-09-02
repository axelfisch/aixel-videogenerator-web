# AiXel VideoGenerator — reprise en code source (V0 → V1)

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

## V1 — Préproduction musicale : analyse audio locale réelle (fait)

- **Analyse portée depuis AiXel Visual Melody** : plutôt que réinventer l'analyse audio, le module
  `audio-analysis.js` reprend telle quelle la méthode qui tourne déjà en production sur
  [visualmelody.netlify.app](https://visualmelody.netlify.app) — décodage `AudioContext.decodeAudioData`,
  mixage mono, forme d'onde par bin de crête, énergie RMS (30 fps), estimation du BPM par intervalles
  entre pics d'enveloppe. Même méthode, réécrite en JS vanille (Visual Melody est en TypeScript/Vite,
  VideoGenerator reste volontairement sans étape de build).
- **Honnêteté préservée** : comme dans Visual Melody, le BPM est explicitement une estimation "MVP"
  par enveloppe énergétique, pas une détection musicale professionnelle — l'UI ne prétend jamais plus
  qu'elle ne fait.
- **Nouveau pour VideoGenerator** : `proposeSections`, une heuristique de regroupement de la timeline
  d'énergie en sections nommées (Intro/Couplet/Refrain/Pont/Final), absente de Visual Melody (qui n'a
  pas besoin de carte musicale). Explicitement présentée comme une **proposition à corriger**, pas une
  analyse de structure musicale au sens propre.
- **Étape "Audio verrouillé" réellement fonctionnelle** : détecte le fichier audio importé dans les
  sources, propose de lancer l'analyse locale, affiche BPM/durée/crête/profil énergétique réels une
  fois l'analyse faite, verrouillable/réouvrable comme les autres barrières.
- **Carte musicale connectée aux vraies données** : forme d'onde réelle, sections réellement détectées
  (titres éditables), lecture audio réelle (lire/pause, navigation en cliquant sur la forme d'onde,
  temps affiché en direct) — le tout persisté (IndexedDB pour le fichier, localStorage pour les
  métadonnées), donc l'analyse et la lecture survivent au rechargement de la page. Le projet pilote
  BMW/BNC reste en données de démonstration (pas de fichier audio réel stocké), donc son bouton lecture
  affiche honnêtement "fichier introuvable localement" plutôt que de faire semblant.

## Prochaine étape (V1.5 — Brief créatif et bibles visuelles)

Brancher les étapes suivantes du pipeline (brief créatif, bibles visuelles) sur les vraies données de
sources et d'analyse audio désormais disponibles, avant d'envisager toute génération IA (qui nécessitera
la même architecture "clé API jamais côté client" que pour AiXeLN).

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
- `db.js` — wrapper IndexedDB (`AiXelDB`) pour le stockage des fichiers binaires
- `audio-analysis.js` — analyse audio locale (`AiXelAudio`), portée depuis AiXel Visual Melody
- `netlify.toml` — déploiement statique simple

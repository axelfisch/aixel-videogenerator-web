# AiXel VideoGenerator — reprise en code source (V0 → V3)

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

## V1.5 — Direction artistique : brief créatif et bibles visuelles (fait)

Toujours 100% local, sans clé IA — cette tranche est de la structuration assistée par l'interface,
pas de la génération. Basée directement sur `AiXel_VideoGenerator_Product_Architecture_1.0.md` (§4, §5,
§8.4, §8.5) et sur `MAT_Avatar_Character_Bible.md` comme référence concrète pour la forme d'une bible.

- **Brief créatif** : les six directions créatives du document d'architecture (récit cinématographique,
  performance d'artiste, poésie symbolique, Visual Melody, paroles en mouvement, hybride dirigé) comme
  grammaires de départ sélectionnables, une description libre — **toujours visible, jamais écrasée** —
  et un brief structuré optionnel (émotion, public, monde, personnages, action, palette, caméra, style,
  motifs, éléments obligatoires/interdits, références, contraintes). Verrouillable/réouvrable comme les
  autres barrières ; devient la référence pour les bibles visuelles, l'histoire et le storyboard.
- **Bibles visuelles (Canon Library)** : fiches canoniques réutilisables — personnage, tenue, objet,
  véhicule, lieu, palette, style — chacune avec une image de référence optionnelle (liée aux sources
  déjà importées), et trois listes de propriétés : obligatoire / préférée / interdite. Chaque fiche a
  un état (proposé/approuvé/verrouillé) ; verrouiller l'étape fige l'ensemble pour le storyboard et le
  futur contrôle de continuité.
- **Bibliothèque de droite connectée aux vraies données** : le panneau "Références verrouillées"
  affiche désormais les fiches réellement verrouillées d'un projet (pas seulement la démo BMW/BNC).
- **Projet pilote BMW/BNC enrichi** : son brief (direction Hybride dirigé) et ses quatre bibles
  (MAT, BMW nocturne, Montréal nocturne, palette night-driving) sont maintenant des données structurées
  réelles plutôt que du texte de démonstration statique — directement dérivées de la fiche personnage
  MAT déjà rédigée.
- **Migration silencieuse** : les projets créés avant cette version (ex. "Children's In The Storm")
  reçoivent automatiquement un brief et des bibles vides au premier chargement, sans rien perdre de
  leurs sources ou de leur analyse audio.

## V2 — Histoire et storyboard (fait)

Toujours 100% local, sans clé IA — les "propositions" ci-dessous sont des heuristiques déterministes
basées sur les données déjà verrouillées (brief, carte musicale, bibles), pas de la génération.
Basée sur `AiXel_VideoGenerator_Product_Architecture_1.0.md` (§6, §8.6, §8.7).

- **Histoire & motifs (Story Engine)** : bouton "Proposer une histoire" qui génère un arc narratif
  (texte à réécrire librement, jamais imposé) et une approche créative par section musicale. Pour la
  direction "Hybride dirigé", l'approche par section suit l'exemple du document d'architecture :
  intro → Visual Melody, refrain → performance, pont → poésie, couplets/final → récit — chaque section
  reste modifiable individuellement. Motifs récurrents pré-remplis depuis le brief structuré,
  éditables. Verrouillable ; devient la référence pour le storyboard.
- **Storyboard (Storyboard Engine)** : bouton "Générer les plans" qui découpe chaque section de la
  carte musicale en plans (plans plus courts sur les passages énergiques, plus longs ailleurs — même
  logique éditoriale que la carte musicale). Chaque plan a une direction créative, action, décor,
  caméra, émotion, un brouillon de prompt, et des références tirées des bibles visuelles verrouillées.
  Le coût par plan reste honnêtement affiché comme "à définir" — aucun chiffre inventé tant qu'aucun
  connecteur de génération n'est branché (V3). Regroupé par section, verrouillable, réouvrable.
- **Garde-fous non bloquants** : histoire et storyboard restent accessibles même si le brief ou les
  bibles ne sont pas encore verrouillés (juste un rappel discret), pour ne jamais bloquer le travail —
  seule l'absence de carte musicale bloque réellement (rien à découper en plans sans elle).

## V2.5 — Image Lab et animatique (fait)

Toujours 100% local, sans clé IA — aucune génération d'image ici (le premier connecteur arrive en
V3). Basée sur `AiXel_VideoGenerator_Product_Architecture_1.0.md` (§8.8, §8.9).

- **Images tests (Image Lab)** : par plan, associe une ou plusieurs images déjà importées dans les
  sources (pas de génération) et compare-les avec une checklist manuelle en cinq dimensions —
  identité, composition, accessoires, texte, style — telle que décrite dans le document
  d'architecture. Chaque candidat a un état (proposé/à corriger/approuvé), des notes libres, et un
  rappel des propriétés obligatoires/interdites tirées des bibles visuelles liées au plan. Une image
  choisie par plan devient la référence pour l'animatique. Verrouillable/réouvrable comme les autres
  barrières.
- **Animatique (Animatic Engine)** : assemblage local et économique — lecture réelle de la musique
  verrouillée (même moteur que la carte musicale), synchronisée à une scène qui affiche l'image
  choisie de chaque plan au bon moment, avec une timeline cliquable (segments proportionnels à la
  durée de chaque plan, code couleur par plan). Pour les plans dirigés "Visual Melody", un aperçu
  **simplifié** remplace l'image statique — une pulsation dessinée en Canvas 2D à partir de la forme
  d'onde déjà analysée, honnêtement présentée comme un aperçu et non les six moteurs complets de
  [visualmelody.netlify.app](https://visualmelody.netlify.app). Si un fichier de paroles `.txt` est
  importé, un panneau optionnel les affiche en texte brut, explicitement non synchronisées. Pas
  d'export vidéo à ce stade — uniquement de quoi juger le rythme et l'enchaînement avant la
  production (V3). Le bouton "Préparer l'animatique →" de la colonne de droite y mène directement dès
  que la carte musicale est verrouillée.
- **Garde-fous non bloquants** : Images tests reste accessible dès qu'il y a des plans (même storyboard
  non verrouillé) ; l'animatique nécessite l'audio verrouillé et des plans, mais pas que les images
  tests soient verrouillées — les plans sans image affichent honnêtement un repère neutre.
- **Correctif de fond** : un projet ouvert sur un navigateur totalement neuf (aucun `localStorage`)
  recevait un projet démo sans les champs `story`/`storyboard` — un oubli de `V1.5`/`V2` qui aurait
  fait planter Histoire/Storyboard/Images/Animatique à la première visite. Corrigé en passant aussi
  le projet démo par `migrateProject()` au démarrage.

## V3 — premier connecteur de génération (images tests) (fait)

Premier vrai appel à un fournisseur d'IA payant, volontairement limité aux **images tests**
(Image Lab) plutôt qu'à la Production par plans — moins cher, plus rapide à itérer, conforme au
principe "aucun rendu coûteux comme test d'interface" (§13). La génération vidéo pour la Production
(plans approuvés uniquement, jamais en masse — §8.10) viendra dans une tranche suivante une fois ce
premier connecteur éprouvé.

- **Fournisseur** : [Replicate](https://replicate.com), modèle `black-forest-labs/flux-schnell`
  (~$0,003/image au tarif Replicate de 2026-09 — à réviser si le fournisseur change ses prix).
  Choisi pour son modèle pay-as-you-go sans abonnement et parce qu'il héberge aussi des modèles
  vidéo sous la même clé, utile pour la suite.
- **Clé API jamais côté client** : même architecture que pour AiXeLN. Deux fonctions serveur
  (`netlify/functions/generate-image.js` et `generate-image-status.js`) font office de proxy —
  elles lisent `REPLICATE_API_TOKEN` en variable d'environnement Netlify, jamais présente dans le
  dépôt ni envoyée au navigateur. Le connecteur reste normalisé côté client (prompt/negative_prompt
  en entrée, image + coût en sortie) : changer de fournisseur plus tard ne touchera que ces deux
  fichiers (§10, principe de portabilité).
- **Dans Images tests** : chaque plan a un panneau de génération avec un prompt pré-rempli à partir
  de l'action/décor/caméra du plan et des propriétés obligatoires des bibles visuelles liées
  (modifiable avant d'envoyer), le coût affiché *avant* de cliquer, et un bouton "Générer une image
  test". Le résultat est rapatrié et stocké localement (IndexedDB, comme n'importe quelle source
  importée) puis ajouté directement comme candidat du plan — badge "IA" pour le distinguer d'une
  image importée. Chaque tentative (réussie ou échouée) est journalisée dans `project.generations`
  (fournisseur, modèle, prompt, coût, date, décision — §9), et le total dépensé sur le projet
  s'affiche en haut de l'étape.
- **Configuration nécessaire avant que ça fonctionne réellement** : créer un compte
  [replicate.com](https://replicate.com), générer un jeton API, puis l'ajouter comme variable
  d'environnement `REPLICATE_API_TOKEN` dans *Site settings → Environment variables* du site Netlify
  (`aixel-videogenerator`), puis redéployer. Sans cette clé, le bouton reste utilisable mais échoue
  proprement avec un message clair plutôt qu'une erreur muette.

## Prochaine étape (V3.5 — Production par plans : génération vidéo)

Génération vidéo réelle pour l'étape Production, strictement limitée aux plans dont l'image test
est déjà approuvée — jamais en masse. Comparaison des variantes, reprise ciblée en cas d'échec,
coûts réels journalisés. Fournisseur probable : toujours Replicate (modèles vidéo), pour rester
sous la même clé et la même architecture de proxy.

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

## Sources de conception

Les documents fournis par Axel (`AiXel_VideoGenerator_Product_Architecture_1.0.md`,
`AiXel_VideoGenerator_Product_Blueprint.md`, `AiXel_Studio_Video_Workflow_Reference.md`,
`MAT_Avatar_Character_Bible.md`) restent la référence de conception pour les étapes à venir
(Histoire, Storyboard, Image Lab, Animatique, Production, Continuité, Qualité & exports) — non
reproduits ici, mais chaque décision d'architecture de ce dépôt s'y aligne.

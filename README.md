# Jiee Garden — prototype jouable

Squelette complet du jeu décrit dans le cahier des charges : un jardin-labyrinthe
en 3D (Three.js), vue aérienne inclinée avec zoom, joystick tactile, un
personnage (nounours), deux gardes en patrouille avec détection par champ de
vision + ligne de vue, un système de vies, un personnage bonus (Djê), Tonton
Jiee comme objectif, pause, PWA installable, et une architecture pensée pour
accueillir d'autres niveaux, ennemis et personnages sans réécrire le moteur.

## Lancer le projet

Il faut servir les fichiers en HTTP (les modules ES et le service worker ne
fonctionnent pas en `file://`). Depuis ce dossier :

```bash
python3 -m http.server 8080
# puis ouvrir http://localhost:8080 sur un téléphone/ordinateur sur le même réseau
```

Ou avec Node : `npx serve .`

Pour tester sur un vrai téléphone Android, servez le dossier (ou déployez-le,
voir plus bas) et ouvrez l'URL dans Chrome ; un bandeau "Ajouter à l'écran
d'accueil" doit apparaître (PWA installable).

## Déploiement

Le projet est 100% statique (HTML/CSS/JS, aucun build requis) : il se
déploie tel quel sur **GitHub Pages** ou **Netlify**. Aucune étape de
compilation n'est nécessaire — glisser le dossier suffit sur Netlify, ou
`git push` vers une branche `gh-pages` / activer Pages sur le repo.

`three.js` est chargé depuis un CDN (jsDelivr) via un *import map* dans
`index.html`. Le premier chargement nécessite donc une connexion ; ensuite
le service worker met en cache le moteur pour un usage hors-ligne.

## Architecture (cf. section 4 du cahier des charges)

```
index.html            point d'entrée, DOM du HUD et des écrans
manifest.webmanifest  PWA
sw.js                 service worker (cache de l'app shell)
css/style.css         HUD, joystick, écrans
js/
  main.js             bootstrap
  engine/
    Game.js            boucle de jeu, cycle de vie des niveaux, règles (vies, victoire)
    CameraController.js caméra aérienne inclinée + zoom lissé
    InputManager.js     joystick virtuel + pinch-zoom + molette/clavier (tests desktop)
    AudioManager.js      API audio stable (sons procéduraux en attendant les assets finaux)
  entities/
    Player.js            nounours : déplacement, animation, invincibilité
    Enemy.js              garde : mesh, étiquette de nom, relie le mesh à l'IA
    PositiveCharacter.js  Djê et futurs personnages bonus (système à `effect` extensible)
    TontonJiee.js          objectif du niveau, zone de sécurité
  ai/
    PatrolAI.js          machine à états (PATROL → ALERT → CHASE → SEARCH → RETURN)
    Detection.js          distance + cône de vision + ligne de vue
  world/
    Collision.js          monde de collision (AABB), résolution de cercle, ligne de vue
    GardenBuilder.js       construit les haies/décors 3D à partir d'un niveau
  levels/
    level01.js             données du niveau 1 (déterministe)
    LevelLoader.js          registre des niveaux
  ui/HUD.js               vies, écrans (pause/victoire/défaite/menu), indicateur "repéré"
  save/SaveManager.js     progression + réglages en localStorage (prêt pour sync JIEE PLAY)
  i18n/                   fr/en, aucun texte en dur dans les composants
```

Ajouter un niveau = créer `levelXX.js` sur le modèle de `level01.js` et
l'enregistrer dans `LevelLoader.js`. Rien d'autre à modifier.

## Historique des correctifs

- **Contact avec les gardes** : un garde blesse désormais au contact peu
  importe son état (avant, seul l'état de poursuite comptait — un garde en
  patrouille ne faisait rien).
- **Zoom arrière** : la distance maximale de caméra est passée de 16 à 38
  unités (et le brouillard a été repoussé en conséquence) pour permettre une
  vraie vue d'ensemble du jardin.
- **Trajectoires de patrouille** : resserrées pour ne plus frôler les haies
  (un garde à quelques centimètres d'un mur restait bloqué contre lui au lieu
  d'avancer).
- **Tonton Jiee** : nouvelle silhouette humaine — jambes et tête de
  proportions normales, exagération concentrée sur les trapèzes/épaules/bras
  en pose "double biceps" permanente.
- **Réalisme du décor** : herbe, chemins et haies utilisent désormais des
  textures procédurales tissées (au lieu de couleurs plates), et une ombre de
  contact douce ancre les personnages au sol.

## Ce qui est fonctionnel dès cette version

- Déplacement libre 360° avec accélération/décélération, joystick tactile fluide.
- Caméra aérienne inclinée (pas plate), zoom pincement + boutons, distance bornée.
- Jardin avec haies formant un vrai labyrinthe, arbres/bancs/statues/fontaine/pots.
- Deux gardes : patrouille sur trajectoire fixe, cône de vision + ligne de vue
  bloquée par les haies, poursuite, recherche brève puis retour en patrouille.
- Système de vies (5), invincibilité courte après un coup, feedback visuel/sonore.
- Personnage bonus DJÊ (+1 vie), objectif Tonton Jiee avec zone de sécurité.
- Pause, écran de victoire/défaite, niveau rejouable à l'identique (déterministe).
- PWA installable (manifest + service worker + icônes).
- Architecture multilingue (fr/en) et sauvegarde locale de la progression.

## Simplifications assumées pour cette première génération

Conformément à la consigne de ne rien supprimer silencieusement, voici ce qui
a été simplifié et pourquoi, avec la piste d'amélioration :

- **Déplacement des gardes en poursuite** : les gardes vont en ligne directe
  vers le joueur puis glissent le long des haies via la même résolution de
  collision que le joueur (ils ne les traversent jamais), plutôt qu'un vrai
  pathfinding A*/navmesh. Assez crédible dans ce niveau, mais à remplacer par
  un vrai système de navigation pour des labyrinthes plus denses.
- **Modèles 3D** : primitives géométriques stylisées (capsules/sphères) plutôt
  que des modèles importés avec textures détaillées, pour rester léger et
  éviter une dépendance à des assets externes indisponibles à cette étape.
  L'architecture (`GardenBuilder.js`, `Player.js`, `Enemy.js`) est prête à
  charger de vrais modèles `.glb` à la place des primitives.
- **Audio** : sons procéduraux (Web Audio) plutôt que des fichiers audio
  finaux, le temps qu'une vraie direction sonore soit produite. L'API
  (`audioManager.playX()`) ne changera pas quand de vrais fichiers arriveront.
- **Occlusion caméra** : la caméra ne fait pas encore de raycast pour éviter
  de traverser un élément de décor ; elle reste haute et inclinée, ce qui
  limite le problème en pratique mais ne le résout pas totalement.
- **Sauvegarde** : localStorage uniquement (pas de compte en ligne), comme
  demandé — le format de données est isolé dans `SaveManager.js` pour une
  synchronisation future avec le profil JIEE PLAY.

Rien n'a été retiré du cahier des charges : tout ce qui précède reste une
version *fonctionnelle mais perfectible* de la fonctionnalité demandée, pas
un remplacement par autre chose.

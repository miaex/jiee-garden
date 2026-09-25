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
    Pathfinding.js         grille de navigation + A*, utilisée en poursuite/recherche
  world/
    Collision.js          monde de collision (AABB), résolution de cercle, ligne de vue
    GardenBuilder.js       construit les haies/décors 3D à partir d'un niveau
  levels/
    level01.js, level02.js  données des niveaux (déterministes)
    LevelLoader.js          registre des niveaux
  ui/HUD.js               vies, écrans (pause/victoire/défaite/menu), indicateur "repéré"
  save/SaveManager.js     progression + réglages en localStorage (prêt pour sync JIEE PLAY)
  i18n/                   fr/en, aucun texte en dur dans les composants
```

Ajouter un niveau = créer `levelXX.js` sur le modèle de `level01.js` et
l'enregistrer dans `LevelLoader.js`. Rien d'autre à modifier.

## Historique des correctifs

- **v2 — passe complète (IA, niveau 2, polish visuel)**
  - **Navigation des gardes** : ajout d'une vraie grille de pathfinding
    (`js/ai/Pathfinding.js`, A* sur grille 0.4m). Un garde ne marche en ligne
    directe que si rien ne bloque ; sinon il calcule un chemin qui contourne
    réellement les haies, recalculé périodiquement pendant la poursuite.
  - **Niveau 2** (`level02.js`) : labyrinthe plus dense, 3 gardes (STRESS,
    GOUMIN, PANIQUE) au lieu de 2, champ de vision plus large, corridors plus
    étroits — vraie progression de difficulté, pas juste "plus rapide".
  - **Occlusion caméra** : la caméra ne traverse plus les haies/décors —
    un rayon détecte l'obstacle et rapproche la caméra devant lui.
  - **Ambiance** : particules de pollen en suspension dans le jardin.
- **v1**
  - **Contact avec les gardes** : un garde blesse désormais au contact peu
    importe son état (avant, seul l'état de poursuite comptait).
  - **Zoom arrière** : distance maximale de caméra passée de 16 à 38 unités.
  - **Trajectoires de patrouille** : resserrées pour ne plus frôler les haies.
  - **Tonton Jiee** : nouvelle silhouette humaine, exagération concentrée sur
    les trapèzes/épaules/bras en pose "double biceps" permanente.
  - **Réalisme du décor** : textures procédurales tissées + ombre de contact.

## Ce qui est fonctionnel dès cette version

- Déplacement libre 360° avec accélération/décélération, joystick tactile fluide.
- Caméra aérienne inclinée (pas plate), zoom pincement + boutons, distance
  bornée, et occlusion (ne traverse plus les haies/décors).
- Deux niveaux jouables avec une vraie progression de difficulté (plus de
  gardes, labyrinthe plus dense, champ de vision plus large au niveau 2).
- Trois gardes maximum : patrouille sur trajectoire fixe, cône de vision +
  ligne de vue bloquée par les haies, poursuite avec pathfinding réel
  (contournement des haies via A* sur grille, pas seulement en ligne droite),
  recherche brève puis retour en patrouille.
- Système de vies (5), contact avec un garde toujours dangereux (patrouille
  ou poursuite), invincibilité courte après un coup, feedback visuel/sonore.
- Personnage bonus DJÊ (+1 vie), objectif Tonton Jiee (silhouette humaine à
  la musculature du haut du corps exagérée) avec zone de sécurité.
- Pause, écran de victoire/défaite, niveaux rejouables à l'identique (déterministe).
- PWA installable (manifest + service worker + icônes).
- Architecture multilingue (fr/en) et sauvegarde locale de la progression.
- Jardin avec haies/textures procédurales, arbres/bancs/statues/fontaine/pots,
  particules d'ambiance.

## Simplifications assumées pour cette première génération

Conformément à la consigne de ne rien supprimer silencieusement, voici ce qui
a été simplifié et pourquoi, avec la piste d'amélioration :

- **Déplacement des gardes en poursuite** : navigation par grille (A*, cellules
  de 0.4m) plutôt qu'un vrai navmesh — largement suffisant pour ce type de
  labyrinthe et bon marché à recalculer sur mobile, mais moins précis qu'un
  navmesh pour des géométries très fines ou beaucoup de gardes actifs à la fois.
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

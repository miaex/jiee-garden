import * as THREE from 'three';
import { CameraController } from './CameraController.js';
import { InputManager } from './InputManager.js';
import { audioManager } from './AudioManager.js';
import { CollisionWorld } from '../world/Collision.js';
import { buildGarden } from '../world/GardenBuilder.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { PositiveCharacter } from '../entities/PositiveCharacter.js';
import { TontonJiee } from '../entities/TontonJiee.js';
import { GuardState } from '../ai/PatrolAI.js';
import { LevelLoader } from '../levels/LevelLoader.js';
import { HUD } from '../ui/HUD.js';
import { saveManager } from '../save/SaveManager.js';
import { i18n } from '../i18n/i18n.js';

const GameState = {
  LOADING: 'LOADING',
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  VICTORY: 'VICTORY',
  GAMEOVER: 'GAMEOVER'
};

export class Game {
  constructor() {
    this.hud = new HUD();
    this.state = GameState.LOADING;
    this.currentLevelId = 1;
    this.lives = 5;
    this.maxLives = 5;

    this._clock = new THREE.Clock();
    this._entities = { enemies: [], positives: [], tonton: null, player: null };

    this._initRenderer();
    this._initScene();
    this._initInput();
    this._bindUI();
  }

  _initRenderer() {
    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fb7d6);
    this.scene.fog = new THREE.Fog(0x8fb7d6, 30, 62);

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.cameraController = new CameraController(this.camera);

    this._initSceneLighting();

    this.collisionWorld = new CollisionWorld();
  }

  _initSceneLighting() {
    const hemi = new THREE.HemisphereLight(0xddeeff, 0x3a5c34, 0.65);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff2d6, 1.05);
    sun.position.set(-8, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -16;
    sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 16;
    sun.shadow.camera.bottom = -16;
    sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.002;
    this.scene.add(sun);
    this.scene.add(sun.target);
  }

  _initInput() {
    this.input = new InputManager({
      zoneEl: document.getElementById('joystick-zone'),
      baseEl: document.getElementById('joystick-base'),
      knobEl: document.getElementById('joystick-knob'),
      onZoomDelta: (delta) => this.cameraController.addZoom(delta)
    });

    document.getElementById('zoom-in').addEventListener('click', () => this.cameraController.setZoomButtonsStep(-1));
    document.getElementById('zoom-out').addEventListener('click', () => this.cameraController.setZoomButtonsStep(1));
  }

  _bindUI() {
    document.getElementById('pause-btn').addEventListener('click', () => this.pause());
    document.getElementById('resume-btn').addEventListener('click', () => this.resume());
    document.getElementById('restart-btn').addEventListener('click', () => this.restartLevel());
    document.getElementById('quit-btn').addEventListener('click', () => this.goToMenu());
    document.getElementById('sound-toggle-btn').addEventListener('click', () => this._toggleSound());

    document.getElementById('play-btn').addEventListener('click', () => {
      const startLevel = saveManager.data.highestLevelReached || 1;
      this.startLevel(Math.min(startLevel, LevelLoader.maxLevelId()));
    });

    document.getElementById('next-level-btn').addEventListener('click', () => {
      this.startLevel(Math.min(this.currentLevelId + 1, LevelLoader.maxLevelId()));
    });
    document.getElementById('victory-restart-btn').addEventListener('click', () => this.restartLevel());
    document.getElementById('gameover-restart-btn').addEventListener('click', () => this.restartLevel());

    i18n.setLang(saveManager.getSettings().lang || 'fr');
    audioManager.setEnabled(saveManager.getSettings().soundOn !== false);
    this._refreshSoundButtonLabel();
  }

  _toggleSound() {
    const next = !audioManager.enabled;
    audioManager.setEnabled(next);
    saveManager.setSetting('soundOn', next);
    this._refreshSoundButtonLabel();
  }

  _refreshSoundButtonLabel() {
    const btn = document.getElementById('sound-toggle-btn');
    btn.textContent = i18n.t('pause.sound', {
      state: i18n.t(audioManager.enabled ? 'pause.sound.on' : 'pause.sound.off')
    });
  }

  goToMenu() {
    this.state = GameState.MENU;
    this.hud.showScreen('menu');
  }

  startLevel(levelId) {
    this._clearLevel();

    const level = LevelLoader.get(levelId);
    this.currentLevelId = level.id;
    this.level = level;
    this.maxLives = level.lives;
    this.lives = level.lives;

    buildGarden(this.scene, level, this.collisionWorld);

    this._entities.player = new Player(this.scene, level.playerStart.x, level.playerStart.z);
    this._entities.enemies = level.enemies.map((cfg) => new Enemy(this.scene, cfg));
    this._entities.positives = level.positiveCharacters.map((cfg) => new PositiveCharacter(this.scene, cfg));
    this._entities.tonton = new TontonJiee(this.scene, level.tontonJiee.x, level.tontonJiee.z);

    this.cameraController.snapTo(this._entities.player.position);

    this.hud.setLevelLabel(level.id);
    this.hud.renderLives(this.lives, this.maxLives);
    this.hud.hideAllScreens();
    this.hud.hideStatus();

    this.state = GameState.PLAYING;
    this._clock.getDelta(); // reset clock so a long load doesn't create one huge dt
  }

  restartLevel() {
    this.startLevel(this.currentLevelId);
  }

  _clearLevel() {
    while (this.scene.children.length) {
      this.scene.remove(this.scene.children[0]);
    }
    this.collisionWorld = new CollisionWorld();
    this._initSceneLighting();
  }

  pause() {
    if (this.state !== GameState.PLAYING) return;
    this.state = GameState.PAUSED;
    this.hud.showScreen('pause');
    this._refreshSoundButtonLabel(); // showScreen re-applies i18n text; re-assert our manually-managed label
  }

  resume() {
    if (this.state !== GameState.PAUSED) return;
    this.state = GameState.PLAYING;
    this.hud.hideAllScreens();
    this._clock.getDelta();
  }

  start() {
    this.hud.setLoadingProgress(1, 'Prêt');
    setTimeout(() => {
      this.goToMenu();
      this._loop();
    }, 250);
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this._clock.getDelta(), 0.05);
    if (this.state === GameState.PLAYING) this._update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  _update(dt) {
    const { player, enemies, positives, tonton } = this._entities;
    if (!player) return;

    const moveVec = this.input.getMoveVector();
    player.update(dt, moveVec, this.collisionWorld);
    this.cameraController.follow(player.position, dt);

    let anyAlertOrChase = false;
    let anyTouching = false;

    enemies.forEach((enemy) => {
      const state = enemy.update(dt, { x: player.position.x, z: player.position.z }, this.collisionWorld);
      if (state === GuardState.ALERT || state === GuardState.CHASE) anyAlertOrChase = true;

      // A guard hurts the player on physical contact regardless of its
      // state — bumping into a patrolling guard is just as costly as
      // being caught mid-chase, which is what the design calls for.
      const dist = Math.hypot(player.position.x - enemy.position.x, player.position.z - enemy.position.z);
      if (dist < player.radius + enemy.radius + 0.05) anyTouching = true;
    });

    if (anyAlertOrChase) {
      this.hud.showStatus('status.spotted', 0);
    } else {
      this.hud.hideStatus();
    }

    positives.forEach((p) => {
      p.update(dt);
      if (p.tryCollect(player.position)) {
        this._applyPositiveEffect(p.config.effect);
      }
    });

    tonton.update(dt);

    if (anyTouching && !player.isInvincible()) {
      const applied = player.hit();
      if (applied) this._onPlayerHit();
    }

    if (tonton.checkReached(player.position)) {
      this._onVictory();
    }
  }

  _applyPositiveEffect(effect) {
    switch (effect) {
      case 'life':
        if (this.lives < this.maxLives) {
          this.lives += 1;
          this.hud.renderLives(this.lives, this.maxLives);
          this.hud.pulseLastHeart(this.lives - 1);
        }
        audioManager.playLifeUp();
        break;
      default:
        break;
    }
  }

  _onPlayerHit() {
    this.lives -= 1;
    this.hud.renderLives(this.lives, this.maxLives);
    this.hud.pulseLastHeart(this.lives);
    audioManager.playHit();
    if (navigator.vibrate) navigator.vibrate(120);

    if (this.lives <= 0) {
      this._onGameOver();
    }
  }

  _onVictory() {
    this.state = GameState.VICTORY;
    this._entities.player.playVictory();
    this._entities.tonton.playVictoryAnimation();
    audioManager.playVictory();
    saveManager.markLevelComplete(this.currentLevelId);

    const isLast = this.currentLevelId >= LevelLoader.maxLevelId();
    document.getElementById('next-level-btn').style.display = isLast ? 'none' : 'block';

    setTimeout(() => this.hud.showScreen('victory'), 500);
  }

  _onGameOver() {
    this.state = GameState.GAMEOVER;
    audioManager.playGameOver();
    setTimeout(() => this.hud.showScreen('gameover'), 400);
  }
}

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
import { NavGrid } from '../ai/Pathfinding.js';
import { LevelLoader } from '../levels/LevelLoader.js';
import { HUD } from '../ui/HUD.js';
import { saveManager } from '../save/SaveManager.js';
import { i18n } from '../i18n/i18n.js';
import { pickRewardMessage, candyEmojiRow } from '../i18n/rewardMessages.js';

const SUMMON_SWEEP_RADIUS = 1.3;
const SUMMON_MAX_DISTANCE = 7; // how far one summon closes the gap, not an instant win

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
    this._heartbeatTimer = 0;
    this._everDetected = false;
    this._fpsFrames = 0;
    this._fpsTimer = 0;
    this._summonAvailable = false;
    this._summonCooldownUntil = 0;

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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
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
    this.scene.background = new THREE.Color(0x9cc6de);
    this.scene.fog = new THREE.Fog(0x9cc6de, 30, 62);

    this._buildSkyDome();

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.cameraController = new CameraController(this.camera);

    this._initSceneLighting();

    this.collisionWorld = new CollisionWorld();
  }

  // A big inward-facing gradient sphere reads as an actual sky instead of
  // a flat color — cheap (one mesh, one small canvas texture, no shader
  // work) but a large jump in how "outdoor" the scene feels.
  _buildSkyDome() {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 128);
    gradient.addColorStop(0, '#4f8fc4');
    gradient.addColorStop(0.55, '#9cc6de');
    gradient.addColorStop(1, '#dcecf0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(70, 16, 16),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false })
    );
    this.skyDome = sky;
    this.scene.add(sky);
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
      onZoomDelta: (delta) => this.cameraController.addZoom(delta),
      onPanDelta: (dx, dy) => this.cameraController.pan(dx, dy)
    });

    document.getElementById('zoom-in').addEventListener('click', () => this.cameraController.setZoomButtonsStep(-1));
    document.getElementById('zoom-out').addEventListener('click', () => this.cameraController.setZoomButtonsStep(1));

    this._dashBtn = document.getElementById('dash-btn');
    this._dashRingCircle = document.querySelector('#dash-cooldown-ring circle');
    this._dashBtn.addEventListener('click', () => this._tryDash());

    this._summonBtn = document.getElementById('summon-btn');
    this._summonBtn.addEventListener('click', () => this._callTontonJiee());
  }

  _tryDash() {
    const player = this._entities.player;
    if (!player || this.state !== GameState.PLAYING) return;
    if (player.tryDash()) audioManager.playDash();
  }

  _updateDashUI() {
    const player = this._entities.player;
    if (!player || !this._dashRingCircle) return;
    const frac = player.dashCooldownFraction(); // 1 = just used, 0 = ready
    this._dashRingCircle.style.strokeDashoffset = String(frac * 100);
    this._dashBtn.classList.toggle('cooling', frac > 0);
  }

  // Random "lifeline" opportunity: occasionally offers the player the
  // choice to call Tonton Jiee in a bit closer, sweeping any guard he
  // passes out of the way as he comes. Also drives the sweep itself while
  // he's actually en route.
  _updateSummon(dt, enemies) {
    const tonton = this._entities.tonton;
    if (!tonton) return;

    if (!this._summonAvailable && !tonton.isSummoning && performance.now() > this._summonCooldownUntil) {
      this._summonAvailable = true;
      this._summonBtn.textContent = i18n.t('summon.button');
      this._summonBtn.classList.remove('hidden');
      audioManager.playSummonReady();
      if (navigator.vibrate) navigator.vibrate(60);
    }

    if (tonton.isSummoning) {
      enemies.forEach((enemy) => {
        if (enemy.defeated) return;
        const dist = Math.hypot(tonton.x - enemy.position.x, tonton.z - enemy.position.z);
        if (dist < SUMMON_SWEEP_RADIUS) {
          const dx = (enemy.position.x - tonton.x) / (dist || 1);
          const dz = (enemy.position.z - tonton.z) / (dist || 1);
          const landing = findKnockbackLanding(this.collisionWorld, enemy.position.x, enemy.position.z, dx, dz, 5);
          enemy.knockBack(landing.x, landing.z);
          audioManager.playSweep();
          if (navigator.vibrate) navigator.vibrate(40);
        }
      });
    }
  }

  _callTontonJiee() {
    if (!this._summonAvailable || this.state !== GameState.PLAYING) return;
    const tonton = this._entities.tonton;
    const player = this._entities.player;
    if (!tonton || !player || !this.navGrid) return;

    const fullPath = this.navGrid.findPath(tonton.x, tonton.z, player.position.x, player.position.z);
    const path = fullPath ? truncatePathByDistance(tonton.x, tonton.z, fullPath, SUMMON_MAX_DISTANCE) : [];

    if (path.length === 0) return; // already adjacent, or no path found — nothing to do

    tonton.startSummon(path);
    this._summonAvailable = false;
    this._summonBtn.classList.add('hidden');
    this._summonCooldownUntil = performance.now() + randomBetween(22000, 40000);
    audioManager.playVictory(); // reuse the triumphant chime — this is a "help has arrived" moment too
  }

  _bindUI() {
    document.getElementById('pause-btn').addEventListener('click', () => this.pause());
    document.getElementById('resume-btn').addEventListener('click', () => this.resume());
    document.getElementById('restart-btn').addEventListener('click', () => this.restartLevel());
    document.getElementById('quit-btn').addEventListener('click', () => this.goToMenu());
    document.getElementById('sound-toggle-btn').addEventListener('click', () => this._toggleSound());

    document.getElementById('play-btn').addEventListener('click', () => {
      const startLevel = saveManager.data.highestLevelReached || 1;
      this.startLevel(startLevel);
    });
    document.getElementById('edit-profile-btn').addEventListener('click', () => this._showOnboarding(true));

    document.getElementById('next-level-btn').addEventListener('click', () => {
      this.startLevel(this.currentLevelId + 1);
    });
    document.getElementById('victory-restart-btn').addEventListener('click', () => this.restartLevel());
    document.getElementById('gameover-restart-btn').addEventListener('click', () => this.restartLevel());

    this._bindOnboarding();

    i18n.setLang(saveManager.getSettings().lang || 'fr');
    audioManager.setEnabled(saveManager.getSettings().soundOn !== false);
    this._refreshSoundButtonLabel();
  }

  _bindOnboarding() {
    const genderRow = document.getElementById('gender-choices');
    const langRow = document.getElementById('lang-choices');

    genderRow.querySelectorAll('.choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        genderRow.querySelectorAll('.choice-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        this._pendingGender = btn.dataset.gender;
      });
    });

    langRow.querySelectorAll('.choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        langRow.querySelectorAll('.choice-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        i18n.setLang(btn.dataset.lang); // instant preview of the chosen language
      });
    });

    document.getElementById('onboarding-start-btn').addEventListener('click', () => {
      const name = document.getElementById('onboarding-name').value.trim();
      const gender = this._pendingGender || 'x';
      const lang = i18n.lang;
      saveManager.saveProfile({ name, gender, lang });
      this.goToMenu();
    });
  }

  // `isEdit` pre-fills the form with the existing profile instead of a
  // blank one, used by the "edit profile" button on the home screen.
  _showOnboarding(isEdit) {
    const profile = saveManager.getProfile();
    document.getElementById('onboarding-name').value = isEdit ? profile.name : '';

    const genderRow = document.getElementById('gender-choices');
    genderRow.querySelectorAll('.choice-btn').forEach((b) => {
      b.classList.toggle('selected', isEdit && b.dataset.gender === profile.gender);
    });
    this._pendingGender = isEdit ? profile.gender : null;

    const langRow = document.getElementById('lang-choices');
    const currentLang = isEdit ? profile.lang : i18n.lang;
    langRow.querySelectorAll('.choice-btn').forEach((b) => {
      b.classList.toggle('selected', b.dataset.lang === currentLang);
    });

    this.hud.showScreen('onboarding');
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
    const profile = saveManager.getProfile();
    this.hud.setMenuGreeting(profile.name);
    this.hud.setMenuStats(saveManager.data.highestLevelReached, saveManager.getTotalCandies());
    document.getElementById('edit-profile-btn').style.display = saveManager.getExternalProfile() ? 'none' : '';
    this.hud.showScreen('menu');
  }

  startLevel(levelId) {
    this._clearLevel();

    const level = LevelLoader.get(levelId);
    this.currentLevelId = level.id;
    this.level = level;
    this.maxLives = level.lives;
    this.lives = level.lives;
    this._everDetected = false;
    this._summonAvailable = false;
    this._summonCooldownUntil = performance.now() + randomBetween(14000, 26000);
    this._summonBtn.classList.add('hidden');

    const { hedgeGroup, decoGroup, atmosphere } = buildGarden(this.scene, level, this.collisionWorld);
    this.cameraController.setOccluders([hedgeGroup, decoGroup]);
    this._atmosphere = atmosphere;

    // Built once per level from the same collision data the player uses;
    // shared by every guard so pathfinding for chase/search stays cheap.
    this.navGrid = new NavGrid(this.collisionWorld, 0.4, 0.3);

    this._entities.player = new Player(this.scene, level.playerStart.x, level.playerStart.z);
    this._entities.enemies = level.enemies.map((cfg) => new Enemy(this.scene, cfg, this.navGrid));
    this._entities.positives = level.positiveCharacters.map((cfg) => new PositiveCharacter(this.scene, cfg));
    this._entities.tonton = new TontonJiee(this.scene, level.tontonJiee.x, level.tontonJiee.z);

    this.cameraController.snapTo(this._entities.player.position);

    this.hud.setLevelLabel(level.id);
    this.hud.renderLives(this.lives, this.maxLives);
    this.hud.hideAllScreens();
    this.hud.hideStatus();
    this.hud.setTension(0);
    this._heartbeatTimer = 0;

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
    this.scene.add(this.skyDome);
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
    this.hud.setFPSVisible(true); // shown by default during this playtesting phase
    this.hud.setLoadingProgress(1, 'Prêt');
    setTimeout(() => {
      if (saveManager.hasProfile()) {
        this.goToMenu();
      } else {
        this._showOnboarding(false);
      }
      this._loop();
    }, 250);
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(this._clock.getDelta(), 0.05);
    if (this.state === GameState.PLAYING) this._update(dt);
    this.renderer.render(this.scene, this.camera);

    // Real-device playtesting aid: a rolling FPS readout, updated twice a
    // second so it's readable rather than flickering every frame.
    this._fpsFrames++;
    this._fpsTimer += dt;
    if (this._fpsTimer >= 0.5) {
      const fps = Math.round(this._fpsFrames / this._fpsTimer);
      this.hud.updateFPS(fps, this.renderer.info?.render?.calls);
      this._fpsFrames = 0;
      this._fpsTimer = 0;
    }
  }

  _update(dt) {
    const { player, enemies, positives, tonton } = this._entities;
    if (!player) return;

    const moveVec = this.input.getMoveVector();
    player.update(dt, moveVec, this.collisionWorld);
    const isMoving = moveVec.x !== 0 || moveVec.z !== 0;
    this.cameraController.follow(player.position, dt, isMoving);
    this._updateDashUI();

    let anyAlertOrChase = false;
    let anyTouching = false;
    let danger = 0;

    enemies.forEach((enemy) => {
      const state = enemy.update(dt, { x: player.position.x, z: player.position.z }, this.collisionWorld);
      if (enemy.defeated) return; // swept aside by Tonton Jiee — no longer a threat
      if (state === GuardState.ALERT || state === GuardState.CHASE) anyAlertOrChase = true;

      // A guard hurts the player on physical contact regardless of its
      // state — bumping into a patrolling guard is just as costly as
      // being caught mid-chase, which is what the design calls for.
      const dist = Math.hypot(player.position.x - enemy.position.x, player.position.z - enemy.position.z);
      if (dist < player.radius + enemy.radius + 0.05) anyTouching = true;

      // Tension builds as the player nears an unalerted guard's detection
      // range, and maxes out the instant one is alert/chasing — this is
      // what gives the "should I even risk this path" feeling its edge.
      if (state === GuardState.ALERT || state === GuardState.CHASE) {
        danger = 1;
      } else {
        const threshold = enemy.config.viewDistance * 1.4;
        const proximity = 1 - dist / threshold;
        if (proximity > danger) danger = Math.max(0, proximity);
      }
    });

    this.hud.setTension(danger * 0.85);
    this.cameraController.setDanger(danger);

    this._heartbeatTimer -= dt * 1000;
    if (danger > 0.12 && this._heartbeatTimer <= 0) {
      audioManager.playHeartbeat(danger);
      this._heartbeatTimer = 1100 - danger * 750; // faster thumps as danger rises
    }

    if (anyAlertOrChase) {
      this._everDetected = true;
      this.hud.showStatus('status.spotted', 0);
    } else {
      this.hud.hideStatus();
    }

    positives.forEach((p) => {
      p.update(dt);
      if (p.tryCollect(player.position)) {
        this._applyPositiveEffect(p.config.effect, player);
      }
    });

    tonton.update(dt);
    this._updateSummon(dt, enemies);

    if (this._atmosphere) {
      this._atmosphere.rotation.y += dt * 0.02;
      this._atmosphere.position.y = Math.sin(this._clock.elapsedTime * 0.4) * 0.06;
    }

    if (anyTouching && !player.isInvincible()) {
      const applied = player.hit();
      if (applied) this._onPlayerHit();
    }

    if (tonton.checkReached(player.position)) {
      this._onVictory();
    }
  }

  _applyPositiveEffect(effect, player) {
    switch (effect) {
      case 'life':
        if (this.lives < this.maxLives) {
          this.lives += 1;
          this.hud.renderLives(this.lives, this.maxLives);
          this.hud.pulseLastHeart(this.lives - 1);
        }
        audioManager.playLifeUp();
        break;
      case 'speed':
        player.applySpeedBoost(6000, 1.6);
        this.hud.showBuff('speed', 6000);
        audioManager.playLifeUp();
        break;
      case 'shield':
        player.applyShield(5000);
        this.hud.showBuff('shield', 5000);
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
    this.hud.flashHit();
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

    const reward = this._computeReward();
    saveManager.addCandies(reward.count);
    this.hud.setVictoryReward(reward.candyRow, reward.message);

    setTimeout(() => this.hud.showScreen('victory'), 500);
  }

  // Tonton Jiee "decides" the candy count from how the run actually went:
  // more lives left at the end, plus a real bonus for never being spotted
  // at all — so playing carefully is rewarded, not just finishing.
  _computeReward() {
    const livesFraction = this.lives / this.maxLives;
    let count = 2 + Math.round(livesFraction * 3);
    if (!this._everDetected) count += 2;
    if (Math.random() < 0.3) count += 1;
    count = Math.max(1, Math.min(10, count));

    const profile = saveManager.getProfile();
    const message = pickRewardMessage(i18n.lang, profile.gender, profile.name, count);
    return { count, candyRow: candyEmojiRow(count), message };
  }

  _onGameOver() {
    this.state = GameState.GAMEOVER;
    audioManager.playGameOver();
    setTimeout(() => this.hud.showScreen('gameover'), 400);
  }
}

// Marches outward from (x,z) along a direction in small steps until the
// collision world says the next step wouldn't be walkable, and returns
// the last walkable point — i.e. "where something flying in this
// direction would land, just before it hits whatever is in the way".
function findKnockbackLanding(collisionWorld, x, z, dirX, dirZ, maxDist) {
  const stepSize = 0.15;
  let last = { x, z };
  for (let d = stepSize; d <= maxDist; d += stepSize) {
    const px = x + dirX * d;
    const pz = z + dirZ * d;
    if (!collisionWorld.isWalkable(px, pz, 0.25)) return last;
    last = { x: px, z: pz };
  }
  return last;
}

// Keeps only as much of `path` as fits within `maxDist` world units from
// (startX, startZ), cutting the final segment short partway if needed —
// this is what makes one summon close the gap "a bit", not all the way.
function truncatePathByDistance(startX, startZ, path, maxDist) {
  const result = [];
  let cx = startX;
  let cz = startZ;
  let remaining = maxDist;

  for (const wp of path) {
    const d = Math.hypot(wp.x - cx, wp.z - cz);
    if (d <= remaining) {
      result.push(wp);
      remaining -= d;
      cx = wp.x;
      cz = wp.z;
    } else {
      const t = d > 0 ? remaining / d : 0;
      result.push({ x: cx + (wp.x - cx) * t, z: cz + (wp.z - cz) * t });
      remaining = 0;
      break;
    }
    if (remaining <= 0) break;
  }
  return result;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

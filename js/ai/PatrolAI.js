import { canSee } from './Detection.js';

export const GuardState = {
  PATROL: 'PATROL',
  ALERT: 'ALERT', // brief "!" reaction before full chase, gives the player a frame to react
  CHASE: 'CHASE',
  SEARCH: 'SEARCH',
  RETURN: 'RETURN'
};

const WAYPOINT_REACH_DIST = 0.25;
const ALERT_DURATION_MS = 350;
const SEARCH_DURATION_MS = 2200;

/**
 * Pure state/movement logic for one guard. Knows nothing about Three.js —
 * it just outputs a desired {x,z} position each tick, so Enemy.js can
 * drive a mesh with it. This separation keeps the AI testable and reusable
 * even if the rendering layer changes.
 */
export class PatrolAI {
  constructor(config) {
    this.config = config;
    this.patrol = config.patrol;
    this.patrolIndex = 0;
    this.state = GuardState.PATROL;
    this.x = config.patrol[0].x;
    this.z = config.patrol[0].z;
    this.facing = 0;
    this.waitTimer = 0;
    this.stateTimer = 0;
    this.lastKnownPlayer = null;
  }

  get speed() {
    return this.state === GuardState.CHASE ? this.config.chaseSpeed : this.config.speed;
  }

  update(dt, playerPos, collisionWorld) {
    switch (this.state) {
      case GuardState.PATROL:
        this._doPatrol(dt);
        break;
      case GuardState.ALERT:
        this._doAlert(dt);
        break;
      case GuardState.CHASE:
        this._doChase(dt, playerPos, collisionWorld);
        break;
      case GuardState.SEARCH:
        this._doSearch(dt);
        break;
      case GuardState.RETURN:
        this._doReturn(dt);
        break;
    }

    // Guards must not walk through hedges. Full A* pathfinding is a
    // planned upgrade; for this first version we resolve against the
    // same collision world the player uses, which makes a guard slide
    // along a hedge instead of clipping through it while chasing.
    const resolved = collisionWorld.resolveCircle(this.x, this.z, this.config.radius || 0.3);
    this.x = resolved.x;
    this.z = resolved.z;

    const sees = canSee(
      { x: this.x, z: this.z, facing: this.facing },
      playerPos,
      this.config.viewDistance,
      this.config.viewAngleDeg,
      collisionWorld
    );

    this._reactToVision(sees, playerPos);

    return { x: this.x, z: this.z, facing: this.facing, state: this.state };
  }

  _reactToVision(sees, playerPos) {
    if (sees) {
      this.lastKnownPlayer = { x: playerPos.x, z: playerPos.z };
      if (this.state === GuardState.PATROL || this.state === GuardState.RETURN) {
        this.state = GuardState.ALERT;
        this.stateTimer = 0;
      } else if (this.state === GuardState.SEARCH) {
        this.state = GuardState.CHASE;
      }
    } else if (this.state === GuardState.CHASE) {
      this.state = GuardState.SEARCH;
      this.stateTimer = 0;
    }
  }

  _doPatrol(dt) {
    const target = this.patrol[this.patrolIndex];
    const arrived = this._stepToward(target, this.config.speed, dt);
    if (arrived) {
      this.waitTimer += dt * 1000;
      if (this.waitTimer >= (this.config.waitAtPointMs || 500)) {
        this.waitTimer = 0;
        this.patrolIndex = (this.patrolIndex + 1) % this.patrol.length;
      }
    }
  }

  _doAlert(dt) {
    this.stateTimer += dt * 1000;
    if (this.lastKnownPlayer) this._faceToward(this.lastKnownPlayer);
    if (this.stateTimer >= ALERT_DURATION_MS) {
      this.state = GuardState.CHASE;
    }
  }

  _doChase(dt, playerPos) {
    this.lastKnownPlayer = { x: playerPos.x, z: playerPos.z };
    this._stepToward(playerPos, this.config.chaseSpeed, dt);
  }

  _doSearch(dt) {
    this.stateTimer += dt * 1000;
    if (this.lastKnownPlayer) {
      this._stepToward(this.lastKnownPlayer, this.config.speed, dt);
    }
    if (this.stateTimer >= SEARCH_DURATION_MS) {
      this.state = GuardState.RETURN;
    }
  }

  _doReturn(dt) {
    const target = this.patrol[this.patrolIndex];
    const arrived = this._stepToward(target, this.config.speed, dt);
    if (arrived) this.state = GuardState.PATROL;
  }

  _stepToward(target, speed, dt) {
    const dx = target.x - this.x;
    const dz = target.z - this.z;
    const dist = Math.hypot(dx, dz);
    if (dist < WAYPOINT_REACH_DIST) return true;

    const nx = dx / dist;
    const nz = dz / dist;
    this.x += nx * speed * dt;
    this.z += nz * speed * dt;
    this.facing = Math.atan2(nx, nz);
    return false;
  }

  _faceToward(target) {
    const dx = target.x - this.x;
    const dz = target.z - this.z;
    if (Math.hypot(dx, dz) < 0.01) return;
    this.facing = Math.atan2(dx, dz);
  }
}

import { canSee } from './Detection.js';

export const GuardState = {
  PATROL: 'PATROL',
  ALERT: 'ALERT', // brief "!" reaction before full chase, gives the player a frame to react
  CHASE: 'CHASE',
  SEARCH: 'SEARCH',
  RETURN: 'RETURN'
};

const WAYPOINT_REACH_DIST = 0.3;
const ALERT_DURATION_MS = 350;
const SEARCH_DURATION_MS = 2200;
const PATH_RECALC_MS = 450;
const PATH_RETARGET_DIST = 0.7;

/**
 * Pure state/movement logic for one guard. Knows nothing about Three.js —
 * it just outputs a desired {x,z} position each tick, so Enemy.js can
 * drive a mesh with it. This separation keeps the AI testable and reusable
 * even if the rendering layer changes.
 *
 * `config.navGrid` (a Pathfinding.NavGrid, optional) is what lets CHASE
 * and SEARCH route around hedges instead of just sliding along them —
 * PATROL/RETURN don't need it since their waypoints are hand-authored to
 * already avoid obstacles.
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

    this._currentPath = [];
    this._pathIndex = 0;
    this._pathRecalcTimer = 0;
    this._pathTargetSnapshot = null;
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
        this._doSearch(dt, collisionWorld);
        break;
      case GuardState.RETURN:
        this._doReturn(dt);
        break;
    }

    // A guard must not walk through a hedge even mid-step (pathfinding
    // avoids most of this already, but this final resolve is a cheap
    // safety net against grid-resolution edge cases).
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

  _doChase(dt, playerPos, collisionWorld) {
    this.lastKnownPlayer = { x: playerPos.x, z: playerPos.z };
    this._followTarget(dt, playerPos, this.config.chaseSpeed, collisionWorld);
  }

  _doSearch(dt, collisionWorld) {
    this.stateTimer += dt * 1000;
    if (this.lastKnownPlayer) {
      this._followTarget(dt, this.lastKnownPlayer, this.config.speed, collisionWorld);
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

  // Moves toward an arbitrary target (the player, or their last known
  // position) using the nav grid to route around hedges when needed.
  // When nothing is in the way, it skips pathfinding entirely and walks
  // straight — cheaper, and reads more naturally in open ground.
  _followTarget(dt, target, speed, collisionWorld) {
    const radius = this.config.radius || 0.3;
    const clear = !collisionWorld.segmentBlockedByMovement(this.x, this.z, target.x, target.z, radius);

    if (clear) {
      this._currentPath = [];
      this._stepToward(target, speed, dt);
      return;
    }

    const navGrid = this.config.navGrid;
    if (!navGrid) {
      // No pathfinding available — fall back to direct movement, the
      // final collision resolve will still keep it out of the hedge.
      this._stepToward(target, speed, dt);
      return;
    }

    this._pathRecalcTimer -= dt * 1000;
    const movedFar =
      !this._pathTargetSnapshot || dist(this._pathTargetSnapshot, target) > PATH_RETARGET_DIST;
    const pathExhausted = this._pathIndex >= this._currentPath.length;

    if (this._pathRecalcTimer <= 0 || movedFar || pathExhausted) {
      const path = navGrid.findPath(this.x, this.z, target.x, target.z);
      this._currentPath = path || [];
      this._pathIndex = 0;
      this._pathRecalcTimer = PATH_RECALC_MS;
      this._pathTargetSnapshot = { x: target.x, z: target.z };
    }

    if (this._currentPath.length === 0) {
      this._stepToward(target, speed, dt);
      return;
    }

    const waypoint = this._currentPath[this._pathIndex];
    const arrived = this._stepToward(waypoint, speed, dt);
    if (arrived) this._pathIndex += 1;
  }

  _stepToward(target, speed, dt) {
    const dx = target.x - this.x;
    const dz = target.z - this.z;
    const d = Math.hypot(dx, dz);
    if (d < WAYPOINT_REACH_DIST) return true;

    const nx = dx / d;
    const nz = dz / d;
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

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

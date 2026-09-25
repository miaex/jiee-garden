// Crediblity of detection comes from three checks, all of which must pass:
// 1) the target is within detection range,
// 2) the target is within the guard's forward view cone,
// 3) nothing (a hedge, a solid decoration) blocks the line of sight.
// This means standing behind a hedge, or simply being far away or behind
// the guard, is a legitimate way to stay hidden.

/**
 * @param {{x:number,z:number,facing:number}} watcher
 * @param {{x:number,z:number}} target
 * @param {number} viewDistance
 * @param {number} viewAngleDeg full cone angle in degrees
 * @param {import('../world/Collision.js').CollisionWorld} collisionWorld
 */
export function canSee(watcher, target, viewDistance, viewAngleDeg, collisionWorld) {
  const dx = target.x - watcher.x;
  const dz = target.z - watcher.z;
  const dist = Math.hypot(dx, dz);
  if (dist > viewDistance) return false;
  if (dist < 0.001) return true;

  // Forward vector derived from facing angle (0 = +Z, matches character rotation.y convention).
  const fx = Math.sin(watcher.facing);
  const fz = Math.cos(watcher.facing);

  const toTargetX = dx / dist;
  const toTargetZ = dz / dist;

  const dot = fx * toTargetX + fz * toTargetZ;
  const angleToTarget = Math.acos(Math.min(1, Math.max(-1, dot)));
  const halfCone = (viewAngleDeg * Math.PI) / 180 / 2;
  if (angleToTarget > halfCone) return false;

  if (collisionWorld.lineOfSightBlocked(watcher.x, watcher.z, target.x, target.z)) return false;

  return true;
}
